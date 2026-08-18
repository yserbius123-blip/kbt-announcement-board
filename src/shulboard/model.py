from typing import Optional

from sqlmodel import Relationship, SQLModel, Field
from datetime import datetime
import hashlib
from enum import Enum

class ColumnType(str, Enum):
    DAILY = 'daily'
    ANNOUNCEMENTS = 'announcements'
    SHABBOS_YT = 'shabbos_yt'

class ItemType(str, Enum):
    SCHEDULED = 'scheduled'
    ANNOUNCEMENT = 'announcement'

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

class Item(SQLModel, table = True):    
    id: int | None = Field(default = None, primary_key = True)
    ordinal: int
    item_type: ItemType
    title: str
    time: str
    text: str
    page_id: int = Field(default=None, foreign_key="page.id")
    page: Page = Relationship(back_populates="items")


class Page(SQLModel, table = True):
    id: int | None = Field(default = None, primary_key = True)
    ordinal: int
    type: ColumnType
    items:  list[Item] = Relationship(back_populates="page") 