"""
Zone Manager - Tracks which users are in which zones
The world drives communication through zone lifecycle events.
"""
from typing import Dict, Set, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class ZoneManager:
    """
    Manages zone membership and lifecycle.
    
    Lifecycle:
    - User enters zone -> create context if needed, add user
    - User exits zone -> remove user, cleanup if empty
    - Zone context is temporary - no persistence
    """
    
    def __init__(self):
        # zone_id -> set of user_ids currently in that zone
        self.zones: Dict[str, Set[str]] = {}
        
        # Track zone metadata
        self.zone_metadata: Dict[str, dict] = {}
        
        # Track user's current zone
        self.user_zones: Dict[str, str] = {}  # user_id -> zone_id
    
    async def enter_zone(
        self, 
        zone_id: str, 
        user_id: str, 
        username: str,
        zone_type: str = "PUBLIC"
    ) -> dict:
        """
        User enters a zone - create temporary context.
        
        Returns:
            dict: Zone state with current members
        """
        # Remove from previous zone if exists
        if user_id in self.user_zones:
            old_zone = self.user_zones[user_id]
            await self.exit_zone(old_zone, user_id)
        
        # Create zone if doesn't exist
        if zone_id not in self.zones:
            self.zones[zone_id] = set()
            self.zone_metadata[zone_id] = {
                "created_at": datetime.utcnow().isoformat(),
                "type": zone_type,
                "name": zone_id
            }
            logger.info(f"🏗️  Zone created: {zone_id} ({zone_type})")
        
        # Add user to zone
        self.zones[zone_id].add(user_id)
        self.user_zones[user_id] = zone_id
        
        logger.info(f"👋 {username} entered {zone_id} (now {len(self.zones[zone_id])} users)")
        
        return {
            "zone_id": zone_id,
            "members": list(self.zones[zone_id]),
            "metadata": self.zone_metadata[zone_id],
            "member_count": len(self.zones[zone_id])
        }
    
    async def exit_zone(self, zone_id: str, user_id: str) -> bool:
        """
        User exits a zone - destroy context if empty.
        
        Returns:
            bool: True if zone was destroyed (empty)
        """
        if zone_id not in self.zones:
            return False
        
        # Remove user
        self.zones[zone_id].discard(user_id)
        
        # Remove from user tracking
        if user_id in self.user_zones and self.user_zones[user_id] == zone_id:
            del self.user_zones[user_id]
        
        # Cleanup empty zones (temporary context destroyed)
        if not self.zones[zone_id]:
            del self.zones[zone_id]
            del self.zone_metadata[zone_id]
            logger.info(f"🧹 Zone destroyed: {zone_id} (empty)")
            return True
        
        logger.info(f"👋 User left {zone_id} ({len(self.zones[zone_id])} remaining)")
        return False
    
    def get_zone_members(self, zone_id: str) -> Set[str]:
        """Get all users currently in a zone."""
        return self.zones.get(zone_id, set()).copy()
    
    def get_user_zone(self, user_id: str) -> Optional[str]:
        """Get the zone a user is currently in."""
        return self.user_zones.get(user_id)
    
    def is_user_in_zone(self, user_id: str, zone_id: str) -> bool:
        """Check if a user is in a specific zone."""
        return zone_id in self.zones and user_id in self.zones[zone_id]
    
    def get_all_zones(self) -> Dict[str, dict]:
        """Get all active zones with member counts."""
        return {
            zone_id: {
                "member_count": len(members),
                "members": list(members),
                **self.zone_metadata.get(zone_id, {})
            }
            for zone_id, members in self.zones.items()
        }
    
    async def cleanup_user(self, user_id: str):
        """Remove user from all zones (on disconnect)."""
        zone_id = self.user_zones.get(user_id)
        if zone_id:
            await self.exit_zone(zone_id, user_id)


# Global instance
zone_manager = ZoneManager()