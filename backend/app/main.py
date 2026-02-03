from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from contextlib import asynccontextmanager
from app.api import users,ws,servers
from app.core.database import engine
from sqlalchemy import text
from app.init_db import init_models
from app.core.redis_client import init_redis,close_redis
import os
from dotenv import load_dotenv


load_dotenv()

NEXT_PUBLIC_URL = os.getenv("NEXT_PUBLIC_URL")
if not NEXT_PUBLIC_URL:
    raise ValueError("NEXT_PUBLIC_URL is not set")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize Database
    try:
        await init_models() 
        # Optionally ping the DB to be sure
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("✅ Database Connected & Tables Verified")
    except Exception as e:
        print(f"❌ Database Error: {e}")

    # 2. Initialize Redis
    try:
        await init_redis()
        print("✅ Redis Connected")
    except Exception as e:
        print(f"❌ Redis Error: {e}")

    yield

    # 3. Shutdown
    await close_redis()
    print("🛑 Shutdown complete")





app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000",NEXT_PUBLIC_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(ws.router,prefix="/ws",tags=["WebSocket"])
app.include_router(servers.router, prefix="/servers", tags=["Servers"])

@app.get("/")
async def hello():
    return {"message": "AtriumVerse Backend is Connected!"}


