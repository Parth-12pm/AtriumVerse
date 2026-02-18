from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import traceback
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import users,ws,servers,channels,messages,direct_messages
from app.core.database import engine
from sqlalchemy import text
from app.init_db import init_models
from app.core.redis_client import init_redis,close_redis
import os
from dotenv import load_dotenv


load_dotenv()

NEXT_PUBLIC_URL = (os.getenv("NEXT_PUBLIC_URL") or "").strip()
if not NEXT_PUBLIC_URL:
    NEXT_PUBLIC_URL = "http://localhost:3000"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize Database
    try:
        await init_models() 
        # Optionally ping the DB to be sure
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("Database Connected & Tables Verified")
    except Exception as e:
        print(f"Database Error: {e}")
        print(traceback.format_exc())

    # 2. Initialize Redis
    try:
        await init_redis()
        print("Redis Connected")
    except Exception as e:
        print(f"Redis Error: {e}")
        print(traceback.format_exc())

    yield

    # 3. Shutdown
    await close_redis()
    print("Shutdown complete")


app = FastAPI(lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"\n[GLOBAL ERROR] {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "message": str(exc),
            "traceback": traceback.format_exc()
        },
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        NEXT_PUBLIC_URL, 
        "http://localhost:3000", 
        "https://atriumverse.parthsmahadik12027.workers.dev"
    ],
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

@app.get("/")
async def hello():
    return {"message": "AtriumVerse Backend is Connected!"}
