import asyncio
from app.core.database import engine, Base

# Import ALL models here so SQLAlchemy's mapper registry has them all
# registered before any query runs. Without this, relationship() calls
# that reference other models by string name (e.g. "Server") will fail.
from app.models.user import User  # noqa: F401
from app.models.server import Server  # noqa: F401
from app.models.server_member import ServerMember  # noqa: F401
from app.models.channel import Channel  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.direct_message import DirectMessage  # noqa: F401
from app.models.zone import Zone  # noqa: F401


async def init_models():
    async with engine.begin() as conn:
        # ⚠️ WARNING: process is destructive!
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created Successfully!")


if __name__ == "__main__":
    asyncio.run(init_models())

