import asyncio
from app.core.database import engine, Base

# Import all models to register them with Base.metadata
from app.models.user import User
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.channel import Channel
from app.models.message import Message
from app.models.direct_message import DirectMessage
from app.models.zone import Zone
from app.models.device import Device
from app.models.device_link_request import DeviceLinkRequest
from app.models.channel_encryption import ChannelEncryption
from app.models.channel_device_key import ChannelDeviceKey
from app.models.dm_device_key import DmDeviceKey
from app.models.dm_epoch import DmEpoch
from app.models.key_backup import KeyBackup
async def init_models():
    async with engine.begin() as conn:
        # ⚠️ WARNING: process is destructive!
        # await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created Successfully!")


if __name__ == "__main__":
    asyncio.run(init_models())

