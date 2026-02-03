import asyncio
import sys
import os

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from app.core.database import engine
from sqlalchemy import text

async def main():
    print("Checking DB connection...")
    try:
        # Check if engine is None (if DATABASE_URL was missing, though code raises error)
        if engine is None:
             print("Engine is None (DATABASE_URL missing?)")
             return

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("DB connected Successfully")
    except Exception as e:
        print(f"DB connection failed type: {type(e)}")
        print(f"DB connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
