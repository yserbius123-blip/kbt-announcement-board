from sqlmodel import SQLModel, Field
from datetime import datetime
import hashlib
from enum import Enum

class ScheduleType(Enum):
    SHABBOS = 1
    WEEKDAY = 2
    YOM_TOV = 3

def hash_password(password:str) -> str:
    salt = 'admin'
    password_salt = bytes(f"{password}{salt}".encode())
    h = hashlib.new('sha3_512')
    h.update(password_salt)
    return str(h.hexdigest())

class Admin(SQLModel, table = True):
    id: int | None = Field(default = None, primary_key = True)
    username: str
    password: str
    def __init__(self, username:str, password:str):
        self.username = username
        self.password = hash_password(password) 

class ScheduledThing(SQLModel, table = True):
    id: int | None = Field(default = None, primary_key = True)
    title: str
    time: datetime
    type: ScheduleType = Field(default = ScheduleType.WEEKDAY)

class AnnouncementThing(SQLModel, table = True):
    id: int | None = Field(default = None, primary_key = True)
    header: str | None = Field(default = None)
    text: str
