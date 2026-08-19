from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import json
import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
import jwt
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.orm import selectinload
from pathlib import Path
import logging
import os

import uvicorn

from shulboard.model import Admin, ColumnType, Item, ItemType, Page, PageRead, hash_password

logger = logging.getLogger(__name__)
@asynccontextmanager
async def lifespan(app: FastAPI):
    if "SECRET_KEY" not in dir(app.state):
        app.state.SECRET_KEY = secrets.token_hex(64)
    db_dir = Path.home() / "shulboard"
    db_file = db_dir / "shul.db"
    #db_uri = f"sqlite:///{str(db_file)}"
    db_uri = "sqlite://"
    app.state.engine = create_engine(db_uri)
    if not db_dir.exists() or not db_file.exists():
        os.mkdir(db_dir)
    SQLModel.metadata.create_all(app.state.engine)

    admin = Admin(username="admin", password="shulpassword")
    daily_items = [
        Item(item_type=ItemType.ANNOUNCEMENT, ordinal = 4, title= "Don't forget", text="V'Sein Bracha"),
        Item(item_type=ItemType.SCHEDULED, ordinal = 0, title= "Shacharis", time = "6:30am"),
        Item(item_type=ItemType.SCHEDULED, ordinal = 1, title= "Daf (Rov)", time = "7:30am"),
        Item(item_type=ItemType.SCHEDULED, ordinal = 2, title= "Mincha Maariv", time = "7:45pm"),
        Item(item_type=ItemType.SCHEDULED, ordinal = 3, title= "Additional Maariv", time = "10:00pm"),
    ]
    ann_items = [
        Item(item_type=ItemType.ANNOUNCEMENT, ordinal = 2, title= "Mazal Tov", text="To Yitzchak Avinu on the engagement of his son Yaakov"),
        Item(item_type=ItemType.ANNOUNCEMENT, ordinal = 3, title= "Yartzeit", text="Someone, probably"),
        Item(item_type=ItemType.ANNOUNCEMENT, ordinal = 4, title= "Kiddush Sponsor", text="Hopefully"),
        Item(item_type=ItemType.ANNOUNCEMENT, ordinal = 5, title= "Thank you", text="For your patience"),
    ]
    shabbos_items = [
        Item(item_type=ItemType.SCHEDULED, ordinal = 0, title= "Kabbolas Shabbos", time = "7:30pm"),
        Item(item_type=ItemType.SCHEDULED, ordinal = 1, title= "Shacharis I", time = "7:00am"),
        Item(item_type=ItemType.SCHEDULED, ordinal = 2, title= "Shacharis II", time = "8:45am"),
    ]
    page = Page(ordinal = 0, type = ColumnType.DAILY, items = daily_items )
    ann_page = Page(ordinal = 0, type = ColumnType.ANNOUNCEMENTS, items = ann_items[0:2] )
    ann_page2 = Page(ordinal = 2, type = ColumnType.ANNOUNCEMENTS, items = ann_items[2:4] )
    shabbos_page = Page(ordinal = 0, type = ColumnType.SHABBOS_YT, items = shabbos_items )
    with Session(app.state.engine) as sesh:
        sesh.add(admin)
        sesh.add(page)
        sesh.add(ann_page)
        sesh.add(ann_page2)
        sesh.add(shabbos_page)
        sesh.commit()

    yield
    app.state.engine.dispose()


async def is_admin(token):
    try:
        payload = jwt.decode(token, app.state.SECRET_KEY, algorithms=["ES256"])
        username = payload.get("sub")
        if username is None:
            return False
    except jwt.InvalidTokenError:
        raise Exception("Invalid token")
    if username != "admin":
        return False
    return True


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, app.state.SECRET_KEY, algorithm="HS256")
    return encoded_jwt


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/token")
app = FastAPI(lifespan=lifespan)
app.frontend("/", directory="./static")


@app.get("/api", response_model=str)
async def api():
    return "Hi!"

@app.get("/api/pages/update")
async def update(
    page: list[PageRead]
):
    pass
@app.get("/api/pages", response_model=list[PageRead])
async def pages(
    column: ColumnType|None = None
):
    with Session(app.state.engine) as sesh:
        base_statement = select(Page).options(selectinload(Page.items))
        if column:
            statement = base_statement.where(Page.type == column).order_by(Page.ordinal)
        else:
            statement = base_statement.order_by(Page.ordinal)
        all_pages = sesh.exec(statement).all()
        logger.error(all_pages)
        return all_pages
    raise HTTPException(500, "Error getting session pages")
        

@app.post("/api/token")
async def token(
    response: Response, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
):
    with Session(app.state.engine) as sesh:
        user_stmt = select(Admin).where(Admin.username == form_data.username)
        admin = sesh.exec(user_stmt).first()
        if not admin:
            raise HTTPException(
                status_code=400, detail="Incorrect username or password"
            )
        hashed_password = hash_password(form_data.password)
        if hashed_password != admin.password:
            raise HTTPException(
                status_code=400, detail="Incorrect username or password"
            )

    access_token_expires = timedelta(minutes=60)
    access_token = create_access_token(
        data={"sub": admin.username}, expires_delta=access_token_expires
    )
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=900,
        httponly=True,
        samesite="strict",
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/admin")
async def admin(is_admin: Annotated[str, Depends(is_admin)]):

    if is_admin():
        return "Admin"
    else:
        raise HTTPException(status_code=400, detail="Unauthorized")


@app.get("/admin.html")
async def admin_html(request: Request):
    token = request.cookies.get("access_token")
    if token is None or not is_admin(token):
        return RedirectResponse("/login.html?redirected_from=%2Fadmin.html") 
    else:
        return FileResponse("./static/admin.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=os.getenv("PORT", 8000))