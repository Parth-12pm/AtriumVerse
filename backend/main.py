from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis

r = redis.Redis(host="localhost", port=6379, db=0)
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def hello():
    return {"message": "AtriumVerse Backend is Connected!"}


@app.get("/count")
async def count():
    count = await r.incr("visits")
    return {"visits": count}
