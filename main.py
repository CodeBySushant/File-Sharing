from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, func
from sqlalchemy.orm import Session, sessionmaker
from contextlib import asynccontextmanager
from models import Base, File as FileModel, CodeRoom
from schema import FileUploadResponse, CodeRoomCreate, CodeRoomResponse, CodeRoomMeta
import uuid
import os
import hashlib
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from collections import defaultdict


# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

UPLOAD_DIRECTORY = "./uploaded_files"
if not os.path.exists(UPLOAD_DIRECTORY):
    os.makedirs(UPLOAD_DIRECTORY)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── WebSocket connection manager ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, List[dict]] = defaultdict(list)

    def connect(self, room_id: str, ws: WebSocket, role: str):
        self.rooms[room_id].append({"ws": ws, "role": role})

    def disconnect(self, room_id: str, ws: WebSocket):
        self.rooms[room_id] = [c for c in self.rooms[room_id] if c["ws"] != ws]
        if not self.rooms[room_id]:
            del self.rooms[room_id]

    async def broadcast(self, room_id: str, message: dict, exclude: WebSocket = None):
        dead = []
        for conn in self.rooms.get(room_id, []):
            if conn["ws"] == exclude:
                continue
            try:
                await conn["ws"].send_text(json.dumps(message))
            except Exception:
                dead.append(conn["ws"])
        for ws in dead:
            self.disconnect(room_id, ws)

    def viewer_count(self, room_id: str) -> int:
        return sum(1 for c in self.rooms.get(room_id, []) if c["role"] == "viewer")

    def live_room_ids(self) -> List[str]:
        return list(self.rooms.keys())

    def total_connected(self) -> int:
        return sum(len(v) for v in self.rooms.values())


manager = ConnectionManager()


# ─── Background cleanup task ───────────────────────────────────────────────────
# Runs every hour; deletes expired CodeRoom rows and orphaned uploaded files
async def cleanup_loop():
    while True:
        await asyncio.sleep(3600)  # wait 1 hour between runs
        try:
            db = SessionLocal()
            now = datetime.utcnow()

            # 1. Delete expired code rooms
            expired_rooms = (
                db.query(CodeRoom)
                .filter(CodeRoom.expires_at != None, CodeRoom.expires_at < now)
                .all()
            )
            for room in expired_rooms:
                db.delete(room)
            if expired_rooms:
                print(f"[cleanup] Deleted {len(expired_rooms)} expired code room(s)")

            # 2. Delete file records older than 7 days + remove files from disk
            cutoff = now - timedelta(days=7)
            old_files = (
                db.query(FileModel)
                .filter(FileModel.uploaded_at < cutoff)
                .all()
            )
            for f in old_files:
                if os.path.exists(f.file_path):
                    try:
                        os.remove(f.file_path)
                    except OSError as e:
                        print(f"[cleanup] Could not delete {f.file_path}: {e}")
                db.delete(f)
            if old_files:
                print(f"[cleanup] Deleted {len(old_files)} old file(s) from disk and DB")

            db.commit()
            db.close()
        except Exception as e:
            print(f"[cleanup] Error during cleanup: {e}")


# ─── Lifespan: start/stop background tasks cleanly ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    task = asyncio.create_task(cleanup_loop())
    yield
    # Shutdown
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(title="ShareYou API", lifespan=lifespan)

# ─── Static files ─────────────────────────────────────────────────────────────
app.mount("/web", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return RedirectResponse(url="/web/index.html")


# ─── File upload ──────────────────────────────────────────────────────────────
@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    MAX_FILE_SIZE = 100 * 1024 * 1024
    file_id  = str(uuid.uuid4())
    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 100MB limit")

    file_path = os.path.join(UPLOAD_DIRECTORY, f"{file_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    db_file = FileModel(
        file_id=file_id,
        file_name=file.filename,
        file_path=file_path,
        file_size=len(contents),
        file_type=file.content_type,
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)

    return FileUploadResponse(
        file_id=file_id,
        file_name=db_file.file_name,
        file_size=db_file.file_size,
        file_type=db_file.file_type,
        uploaded_at=db_file.uploaded_at,
    )


@app.get("/file/{file_id}")
async def get_file(file_id: str, db: Session = Depends(get_db)):
    db_file = db.query(FileModel).filter(FileModel.file_id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(db_file.file_path):
        raise HTTPException(status_code=404, detail="File no longer available")
    return FileResponse(
        path=db_file.file_path,
        filename=db_file.file_name,
        media_type=db_file.file_type,
    )


@app.get("/recent-files")
async def get_recent_files(db: Session = Depends(get_db)):
    files = db.query(FileModel).order_by(FileModel.uploaded_at.desc()).limit(10).all()
    return [
        {
            "file_id":     f.file_id,
            "file_name":   f.file_name,
            "file_size":   f.file_size,
            "file_type":   f.file_type,
            "uploaded_at": f.uploaded_at.isoformat(),
        }
        for f in files
    ]


# ─── Stats endpoint ────────────────────────────────────────────────────────────
@app.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    total_files = db.query(func.count(FileModel.id)).scalar() or 0
    total_size  = db.query(func.sum(FileModel.file_size)).scalar() or 0

    cutoff    = datetime.utcnow() - timedelta(hours=24)
    rooms_24h = (
        db.query(func.count(CodeRoom.id))
        .filter(CodeRoom.created_at >= cutoff)
        .scalar() or 0
    )

    live_rooms   = len(manager.live_room_ids())
    live_viewers = manager.total_connected()

    earliest = db.query(func.min(FileModel.uploaded_at)).scalar()
    uptime_days = None
    if earliest:
        uptime_days = (datetime.utcnow() - earliest).days

    return {
        "total_files":      total_files,
        "total_size_bytes": total_size,
        "rooms_24h":        rooms_24h,
        "live_rooms":       live_rooms,
        "live_viewers":     live_viewers,
        "uptime_days":      uptime_days,
    }


# ─── Code rooms ───────────────────────────────────────────────────────────────
def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


@app.post("/code/new", response_model=CodeRoomResponse)
async def create_code_room(body: CodeRoomCreate, db: Session = Depends(get_db)):
    room_id = str(uuid.uuid4())[:8]

    expires_at = None
    if body.expiry_hours:
        expires_at = datetime.utcnow() + timedelta(hours=body.expiry_hours)

    room = CodeRoom(
        room_id=room_id,
        language=body.language,
        title=body.title,
        password_hash=_hash(body.password) if body.password else None,
        expires_at=expires_at,
        content="",
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    return CodeRoomResponse(
        room_id=room.room_id,
        language=room.language,
        title=room.title,
        has_password=room.password_hash is not None,
        expires_at=room.expires_at,
        created_at=room.created_at,
    )


@app.get("/code/{room_id}", response_model=CodeRoomMeta)
async def get_code_room(
    room_id: str,
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    room = db.query(CodeRoom).filter(CodeRoom.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    if room.expires_at and datetime.utcnow() > room.expires_at:
        raise HTTPException(status_code=410, detail="Room has expired")

    if room.password_hash:
        if not password or _hash(password) != room.password_hash:
            raise HTTPException(status_code=403, detail="Invalid password")

    return CodeRoomMeta(
        room_id=room.room_id,
        language=room.language,
        title=room.title,
        has_password=room.password_hash is not None,
        expires_at=room.expires_at,
        content=room.content or "",
    )


# ─── WebSocket ────────────────────────────────────────────────────────────────
@app.websocket("/ws/code/{room_id}")
async def code_ws(
    websocket: WebSocket,
    room_id: str,
    role: str = Query("viewer"),
    password: Optional[str] = Query(None),
):
    db = SessionLocal()
    try:
        room = db.query(CodeRoom).filter(CodeRoom.room_id == room_id).first()
        if not room:
            await websocket.close(code=4004)
            return

        if room.expires_at and datetime.utcnow() > room.expires_at:
            await websocket.close(code=4010)
            return

        if room.password_hash and (not password or _hash(password) != room.password_hash):
            await websocket.close(code=4003)
            return

        await websocket.accept()
        manager.connect(room_id, websocket, role)

        await websocket.send_text(json.dumps({
            "type":    "snapshot",
            "content": room.content or "",
            "language": room.language,
            "title":   room.title,
            "viewers": manager.viewer_count(room_id),
        }))

        await manager.broadcast(room_id, {
            "type":  "viewers",
            "count": manager.viewer_count(room_id),
        }, exclude=websocket)

        try:
            while True:
                raw = await websocket.receive_text()
                msg = json.loads(raw)

                if role == "editor":
                    if msg.get("type") == "update":
                        new_content = msg.get("content", "")
                        room.content = new_content
                        # FIX: explicitly set updated_at; the before_update
                        # event listener in models.py also stamps it
                        room.updated_at = datetime.utcnow()
                        db.commit()

                        await manager.broadcast(room_id, {
                            "type":       "update",
                            "content":    new_content,
                            "updated_at": datetime.utcnow().isoformat(),
                        }, exclude=websocket)

                    elif msg.get("type") == "meta":
                        if "language" in msg:
                            room.language = msg["language"]
                        if "title" in msg:
                            room.title = msg["title"]
                        room.updated_at = datetime.utcnow()
                        db.commit()

                        await manager.broadcast(room_id, {
                            "type":     "meta",
                            "language": room.language,
                            "title":    room.title,
                        }, exclude=websocket)

        except WebSocketDisconnect:
            manager.disconnect(room_id, websocket)
            await manager.broadcast(room_id, {
                "type":  "viewers",
                "count": manager.viewer_count(room_id),
            })
    finally:
        db.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)