from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from models import Base, File as FileModel
from schema import FileUploadResponse
import uuid
import os

app = FastAPI()

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


app.mount("/web", StaticFiles(directory="static"), name="static")


@app.get("/")
async def root():
    return RedirectResponse(url="/web/index.html")


@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...), db: Session = Depends(get_db)):
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB

    file_id = str(uuid.uuid4())

    contents = await file.read()

    # File size validation
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 100MB limit")

    # Create safe file path
    file_path = os.path.join(UPLOAD_DIRECTORY, f"{file_id}_{file.filename}")

    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    # Store in database
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
    if db_file is None:
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        path=db_file.file_path, filename=db_file.file_name, media_type=db_file.file_type
    )


@app.get("/recent-files")
async def get_recent_files(db: Session = Depends(get_db)):

    files = db.query(FileModel).order_by(FileModel.uploaded_at.desc()).limit(10).all()

    return [
        {
            "file_id": file.file_id,
            "file_name": file.file_name,
            "file_size": file.file_size,
            "file_type": file.file_type,
            "uploaded_at": file.uploaded_at.isoformat(),
        }
        for file in files
    ]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
