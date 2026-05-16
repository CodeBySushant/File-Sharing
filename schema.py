from pydantic import BaseModel
from datetime import datetime

class FileUploadResponse(BaseModel):
    file_id: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_at: datetime