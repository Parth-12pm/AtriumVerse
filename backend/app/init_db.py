import asyncio
from app.core.database import engine, Base
from app.models.user import User
from app.models.server import Server
from app.models.zone import Zone
from app.models.server_member import ServerMember


async def init_models():
    async with engine.begin() as conn:
        # ⚠️ WARNING: process is destructive!
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created Successfully!")


if __name__ == "__main__":
    asyncio.run(init_models())

