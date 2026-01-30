from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from contextlib import asynccontextmanager
from app.api import users,rooms,ws
from app.core.database import engine
from sqlalchemy import text
from app.init_db import init_models

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing Database Tables...")
    try:
        await init_models()
    except Exception as e:
        print(f"Error creating tables: {e}")

    print("\n checking DB connection...")
    try : 
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("DB connected Successfully")
        
        print("\n--- REGISTERED ROUTES ---")
        for route in app.routes:
            print(f"{route.path} ({type(route).__name__})")
        print("-------------------------\n")
    except Exception as e:
        print(f"DB connection failed: {e}\n")

    yield

    print(" shutting down....")



r = redis.Redis(host="localhost", port=6379, db=0)

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(rooms.router, prefix="/rooms", tags=["Rooms"])
app.include_router(ws.router,prefix="/ws",tags=["WebSocket"])

@app.get("/")
async def hello():
    return {"message": "AtriumVerse Backend is Connected!"}


@app.get("/count")
async def count():
    count = await r.incr("visits")
    return {"visits": count}
