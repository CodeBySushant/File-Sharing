from sqlalchemy import Column, Integer, String, DateTime, Text, event
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone

Base = declarative_base()


def utcnow():
    """Naive UTC datetime — compatible with existing SQLite rows."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class File(Base):
    __tablename__ = "files"

    id          = Column(Integer, primary_key=True, index=True)
    file_id     = Column(String, unique=True, index=True)
    file_name   = Column(String)
    file_path   = Column(String)
    file_size   = Column(Integer)
    file_type   = Column(String)
    uploaded_at = Column(DateTime, default=utcnow)


class CodeRoom(Base):
    __tablename__ = "code_rooms"

    id            = Column(Integer, primary_key=True, index=True)
    room_id       = Column(String, unique=True, index=True)
    content       = Column(Text, default="")
    language      = Column(String, default="plaintext")
    title         = Column(String, default="Untitled")
    password_hash = Column(String, nullable=True)
    expires_at    = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=utcnow)
    updated_at    = Column(DateTime, default=utcnow)


@event.listens_for(CodeRoom, "before_update")
def _stamp_updated_at(mapper, connection, target):
    target.updated_at = utcnow()