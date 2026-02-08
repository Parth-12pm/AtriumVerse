from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.zone import Zone
from typing import Optional
from collections import OrderedDict

class SpatialManager:
    def __init__(self, max_servers=100):
        # Cache structure: { "server_id": [List of Zone Dicts] }
        # Using OrderedDict for LRU (Least Recently Used) eviction
        self.zone_cache: OrderedDict = OrderedDict()
        self.max_servers = max_servers

    async def load_zones(self, server_id: str, db: AsyncSession):
        """
        Fetches zones from DB and caches them in memory (RAM).
        Call this when a user joins a server for the first time.
        """
        # Optimization: Only load if not already in cache
        if server_id in self.zone_cache:
            self.zone_cache.move_to_end(server_id) # Mark as recently used
            return

        print(f"🔄 Loading zones for server {server_id}...")
        
        result = await db.execute(select(Zone).where(Zone.server_id == server_id))
        zones = result.scalars().all()
        
        # Enforce LRU Limit
        if len(self.zone_cache) >= self.max_servers:
            removed_id, _ = self.zone_cache.popitem(last=False) # Remove oldest (FIFO based on insertion/access)
            print(f"🧹 Evicted server {removed_id} from zone cache")

        # We convert to a simple dict so accessing bounds is fast
        zone_list = []
        for z in zones:
            zone_list.append({
                "id": str(z.id),
                "name": z.name,
                "type": z.type,
                "bounds": z.bounds # {x, y, width, height}
            })
            
        self.zone_cache[str(server_id)] = zone_list
            
        print(f"✅ Cached {len(zones)} zones for {server_id}")

    def check_zone(self, x: float, y: float, server_id: str) -> Optional[dict]:
        """Checks if (x,y) is inside any cached zone."""
        if str(server_id) not in self.zone_cache:
            return None # Server not loaded yet or invalid

        # Mark as recently used
        self.zone_cache.move_to_end(str(server_id))
            
        for zone in self.zone_cache[str(server_id)]:
            b = zone["bounds"]
            # Rectangle Collision Logic (AABB)
            # Check X first (fail fast)
            if (x >= b["x"]) and (x <= b["x"] + b["width"]):
                # Check Y
                if (y >= b["y"]) and (y <= b["y"] + b["height"]):
                    return zone # Found a match!
                
        return None # In open space

# Create a global instance
spatial_manager = SpatialManager(max_servers=50)