from fastapi import APIRouter, Depends , HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate,UserResponse
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security import create_access_token



router = APIRouter()

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


@router.post("/register" , response_model=UserResponse)
async def create_user(user: UserCreate, db: AsyncSession= Depends(get_db)):

    #check for already existing username/email 
    result = await db.execute(select(User).where((User.username == user.username)| (User.email == user.email)))
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



@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends() , db: AsyncSession = Depends(get_db)):

    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()

    if not user or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")


    access_token = create_access_token(data={"sub": user.username})


    return {"access_token": access_token, "token_type": "bearer"}

