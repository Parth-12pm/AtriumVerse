"""
Zone Manager - Tracks which users are in which zones
The world drives communication through zone lifecycle events.
"""
from typing import Dict, Set, Optional
from datetime import datetime
import logging
import app.core.redis_client as redis_client

logger = logging.getLogger(__name__)


class ZoneManager:
    async def enter_zone(self, zone_id: str, user_id: str, username: str, zone_type: str = "PUBLIC"):
        old_zone = await redis_client.r.get(f"user:{user_id}:zone")
        if old_zone:
            await self.exit_zone(old_zone, user_id)
        
        await redis_client.r.sadd(f"zone:{zone_id}:users", user_id)
        await redis_client.r.set(f"user:{user_id}:zone", zone_id)

        members = await redis_client.r.smembers(f"zone:{zone_id}:users")
        return {
            "zone_id": zone_id,
            "members": list(members),
            "member_count": len(members)
        }

    async def exit_zone(self, zone_id: str, user_id: str) -> bool:
        await redis_client.r.srem(f"zone:{zone_id}:users", user_id)
        
        current_zone = await redis_client.r.get(f"user:{user_id}:zone")
        if current_zone == zone_id:
            await redis_client.r.delete(f"user:{user_id}:zone")
        
        # If no users left, return True (destroyed)
        count = await redis_client.r.scard(f"zone:{zone_id}:users")
        if count == 0:
            logger.info(f"🧹 Zone destroyed: {zone_id} (empty)")
            return True
        return False
    
    async def get_zone_members(self, zone_id: str):
        members = await redis_client.r.smembers(f"zone:{zone_id}:users")
        return list(members)
    
    async def get_user_zone(self, user_id: str):
        return await redis_client.r.get(f"user:{user_id}:zone")
    
    async def cleanup_user(self, user_id: str):
        zone_id = await self.get_user_zone(user_id)
        if zone_id:
            await self.exit_zone(zone_id, user_id)


# Global instance
zone_manager = ZoneManager()