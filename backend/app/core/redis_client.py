import redis.asyncio as redis
import os 
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    raise ValueError("REDIS_URL is not set")

r = None

async def init_redis():
    global r 
    r = await redis.from_url(
        REDIS_URL,
        encoding="utf-8",
        decode_responses=True
    )

    await r.ping()
    print("Redis Connected")


async def close_redis():
    global r 
    if r:
        await r.close()
        print("Redis Disconnected")