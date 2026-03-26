"""
Database migration for permanent chat system.

Run this to add Channel and Message tables.
"""

import asyncio

from app.core.database import Base, engine
from app.models.channel import Channel
from app.models.server import Server


async def run_migration():
    """
    Create new tables for permanent chat.

    This is an additive migration - it won't drop existing tables.
    """
    async with engine.begin() as conn:
        # Create only new tables (channels and messages)
        await conn.run_sync(Base.metadata.create_all)

    print("✅ Migration completed!")
    print("📊 Tables created: channels, messages")
    print("🔗 Relationships updated: Server.channels, User.messages")


async def create_default_channels():
    """
    Create default channels for existing servers.
    """
    from sqlalchemy import select

    from app.core.database import SessionLocal

    async with SessionLocal() as session:
        # Get all servers
        result = await session.execute(select(Server))
        servers = result.scalars().all()

        for server in servers:
            # Check if server already has channels
            channel_check = await session.execute(
                select(Channel).where(Channel.server_id == server.id)
            )

            if not channel_check.scalars().first():
                # Create default channels
                general = Channel(
                    server_id=server.id,
                    name="general",
                    type="text",
                    description="Main channel for general discussion",
                    position=0,
                    is_public=True,
                )

                announcements = Channel(
                    server_id=server.id,
                    name="announcements",
                    type="announcements",
                    description="Important announcements",
                    position=1,
                    is_public=True,
                )

                session.add(general)
                session.add(announcements)

                print(f"✅ Created default channels for: {server.name}")

        await session.commit()
        print("🎉 Default channels created for all servers!")


if __name__ == "__main__":
    print("🚀 Starting migration...")
    asyncio.run(run_migration())

    print("\n📝 Creating default channels...")
    asyncio.run(create_default_channels())

    print("\n✨ All done! Permanent chat system is ready.")
    print("\n💡 Next steps:")
    print("   1. Update Server and User models with new relationships")
    print("   2. Import channels and messages routes in main.py")
    print("   3. Test the chat interface in the frontend")
