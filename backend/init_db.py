import asyncio
from app.core.database import engine, Base
from app.api import *  # Import all routers to register models

async def create_tables():
    async with engine.begin() as conn:
        print("Creating all missing tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully!")

if __name__ == "__main__":
    asyncio.run(create_tables())
