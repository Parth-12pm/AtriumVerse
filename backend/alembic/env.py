from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
from dotenv import load_dotenv

load_dotenv()

from app.core.database import Base
from app.models.user import User
from app.models.server import Server
from app.models.server_member import ServerMember
from app.models.channel import Channel
from app.models.message import Message
from app.models.direct_message import DirectMessage
from app.models.zone import Zone
# E2EE models
from app.models.device import Device
from app.models.device_link_request import DeviceLinkRequest
from app.models.channel_encryption import ChannelEncryption
from app.models.channel_device_key import ChannelDeviceKey
from app.models.dm_device_key import DmDeviceKey
from app.models.dm_epoch import DmEpoch
from app.models.key_backup import KeyBackup

config = context.config
fileConfig(config.config_file_name)
target_metadata = Base.metadata


def get_url():
    url = os.getenv("DATABASE_URL", "")
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    url = url.replace("postgres://", "postgresql://")
    return url


def run_migrations_offline():
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()

    url = get_url()
    connect_args = {}
    if any(host in url for host in ["render.com", "neon.tech", "supabase"]):
        connect_args["sslmode"] = "require"

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()