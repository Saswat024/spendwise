from fastapi import APIRouter, HTTPException, status

from ..db import users
from ..models import LoginIn, SignupIn, TokenOut, UserOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(doc: dict) -> UserOut:
    return UserOut(id=str(doc["_id"]), email=doc["email"], name=doc["name"])


@router.post("/signup", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupIn):
    email = body.email.lower()
    if await users.find_one({"email": email}):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    doc = {"email": email, "name": body.name, "password_hash": hash_password(body.password)}
    result = await users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return TokenOut(access_token=create_access_token(str(result.inserted_id)), user=user_out(doc))


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn):
    doc = await users.find_one({"email": body.email.lower()})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return TokenOut(access_token=create_access_token(str(doc["_id"])), user=user_out(doc))
