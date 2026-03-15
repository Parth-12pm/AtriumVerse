import asyncio

from sqlalchemy import text

from app.core.database import engine


async def migrate():
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN character_id VARCHAR DEFAULT 'bob' NOT NULL"
            )
        )
        print("✅ Successfully added character_id column to users table!")


if __name__ == "__main__":
    asyncio.run(migrate())
