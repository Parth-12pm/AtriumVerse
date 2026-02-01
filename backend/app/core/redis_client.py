import redis.asyncio as redis

r = None

async def init_redis():
    global r 
    r = await redis.from_url(
        "redis://localhost:6379",
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