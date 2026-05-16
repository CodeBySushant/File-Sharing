from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class File(Base):
    __tablename__ = 'files'

    id = Column(Integer, primary_key=True, index=True)

    file_id = Column(String, unique=True, index=True)

    file_name = Column(String)

    file_path = Column(String)

    file_size = Column(Integer)

    file_type = Column(String)

    uploaded_at = Column(DateTime, default=datetime.utcnow)