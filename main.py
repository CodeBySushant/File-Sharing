import shutil
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
engine = create_engine(DATABASE_URL)
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
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIRECTORY, file_id + "_" + file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    db_file = FileModel(file_id=file_id, file_path=file_path)
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    return FileUploadResponse(file_id=file_id, file_path=file_path)

@app.get("/file/{file_id}")
async def get_file(file_id: str, db: Session = Depends(get_db)):
    db_file = db.query(FileModel).filter(FileModel.file_id == file_id).first()
    if db_file is None:
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(path=db_file.file_path)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)