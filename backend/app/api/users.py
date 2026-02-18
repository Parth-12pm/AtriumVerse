from fastapi import APIRouter, Depends , HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.schemas.user import UserCreate,UserResponse
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from datetime import timedelta
import traceback

# Import all related models to ensure SQLAlchemy mapper registry is fully
# populated before any query runs (fixes relationship() resolution errors)
from app.models.server import Server  # noqa: F401
from app.models.server_member import ServerMember  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.channel import Channel  # noqa: F401
from app.models.direct_message import DirectMessage  # noqa: F401
from app.models.zone import Zone  # noqa: F401
from app.models.user import User

# Explicitly configure mappers to catch errors early
from sqlalchemy.orm import configure_mappers
configure_mappers()


router = APIRouter()

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


@router.post("/register" , response_model=UserResponse)
async def create_user(user: UserCreate, db: AsyncSession= Depends(get_db)):
    try:
        # Check for already existing username/email 
        result = await db.execute(
            select(User).where((User.username == user.username)| (User.email == user.email))
        )
        existing_user = result.scalars().first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Username or Email already registered")

        hashed_pw = pwd_context.hash(user.password)

        new_user = User(
            username = user.username,
            email = user.email,
            hashed_password = hashed_pw
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        return new_user
    except HTTPException:
        raise
    except Exception as e:
        print("REGISTER ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends() , db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(User).where(User.username == form_data.username))
        user = result.scalars().first()

        if not user or not pwd_context.verify(form_data.password, user.hashed_password):
            raise HTTPException(status_code=400, detail="Incorrect username or password")

        # Create access token with explicit expiration
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, 
            expires_delta=access_token_expires
        )

        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user_id": user.id,
            "username": user.username
        }
    except Exception as e:
        print("LOGIN ERROR:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
