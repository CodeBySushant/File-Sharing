from pydantic import BaseModel

class FileUploadResponse(BaseModel):
    file_id: str
    file_path: str
