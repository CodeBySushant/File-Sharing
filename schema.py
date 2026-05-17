from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class FileUploadResponse(BaseModel):
    file_id: str
    file_name: str
    file_size: int
    file_type: str
    uploaded_at: datetime


class CodeRoomCreate(BaseModel):
    language: str = "plaintext"
    title: str = "Untitled"
    password: Optional[str] = None      # raw password; hashed before storing
    expiry_hours: Optional[int] = None  # None = never expires


class CodeRoomResponse(BaseModel):
    room_id: str
    language: str
    title: str
    has_password: bool
    expires_at: Optional[datetime]
    created_at: datetime


class CodeRoomMeta(BaseModel):
    room_id: str
    language: str
    title: str
    has_password: bool
    expires_at: Optional[datetime]
    content: str                        # current snapshot on join