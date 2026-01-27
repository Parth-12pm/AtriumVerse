from fastapi import Depends, HTTPException, status 
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import Async