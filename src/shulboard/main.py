from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import secrets
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
import jwt
from sqlmodel import SQLModel, Session, create_engine, select
from pathlib import Path
import os

import uvicorn

from shulboard.model import Admin, hash_password


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
    with Session(app.state.engine) as sesh:
        sesh.add(admin)
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


@app.get("/api")
async def api():
    return "Hi!"


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
        return RedirectResponse("/login.html") 
    else:
        return FileResponse("./static/admin.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=os.getenv("PORT"))