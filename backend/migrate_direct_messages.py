"""
Database migration for direct messages.

Run this to add the direct_messages table.
"""
import asyncio
from app.core.database import engine, Base
from app.models.user import User
from app.models.server import Server
from app.models.zone import Zone
from app.models.server_member import ServerMember
from app.models.channel import Channel
from app.models.message import Message
from app.models.direct_message import DirectMessage


async def run_migration():
    """
    Create direct_messages table.
    
    This is an additive migration - it won't drop existing tables.
    """
    async with engine.begin() as conn:
        # Create only new table (direct_messages)
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Migration completed!")
    print("📊 Table created: direct_messages")
    print("🔗 Indexes created for efficient conversation queries")


if __name__ == "__main__":
    print("🚀 Starting migration for direct messages...")
    asyncio.run(run_migration())
    
    print("\n✨ All done! Direct messaging is ready.")
    print("\n💡 Next steps:")
    print("   1. Import direct_messages routes in main.py")
    print("   2. Test DM endpoints in the frontend")