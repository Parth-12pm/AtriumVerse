from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import users,ws,servers,channels,messages,direct_messages,livekit,devices,device_linking,channel_keys
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
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("✅ Database Connected")
    except Exception as e:
        print(f"❌ Database Error: {e}")

    try:
        await init_redis()
        print("✅ Redis Connected")
    except Exception as e:
        print(f"❌ Redis Error: {e}")

    yield
    await close_redis()
    print("🛑 Shutdown complete")



app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[NEXT_PUBLIC_URL,"https://atriumverse.vercel.app","http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(ws.router,prefix="/ws",tags=["WebSocket"])
app.include_router(servers.router, prefix="/servers", tags=["Servers"])
app.include_router(channels.router,prefix="/channels", tags=["Channels"])
app.include_router(messages.router,prefix="/messages",tags=["Messages"])
app.include_router(direct_messages.router,prefix="/DM",tags=["Direct-Messages"])
app.include_router(livekit.router,prefix="/livekit", tags=["Livekit"])
app.include_router(devices.router, prefix="/devices", tags=["Devices"])
app.include_router(device_linking.router, prefix="/device-linking", tags=["Device Linking"])
app.include_router(channel_keys.router)

@app.get("/")
async def hello():
    return {"message": "AtriumVerse Backend is Connected!"}


