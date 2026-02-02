from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.zone import Zone
from typing import Dict, List, Optional

class SpatialManager:
    def __init__(self):
        # Cache structure: { "server_id": [List of Zone Dicts] }
        self.zone_cache: Dict[str, List[dict]] = {}

    async def load_zones(self, server_id: str, db: AsyncSession):
        """
        Fetches zones from DB and caches them in memory (RAM).
        Call this when a user joins a server for the first time.
        """
        # Optimization: Only load if not already in cache
        if server_id in self.zone_cache:
            return

        print(f"🔄 Loading zones for server {server_id}...")
        
        result = await db.execute(select(Zone).where(Zone.server_id == server_id))
        zones = result.scalars().all()
        
        # We convert to a simple dict so accessing bounds is fast
        self.zone_cache[str(server_id)] = []
        for z in zones:
            self.zone_cache[str(server_id)].append({
                "id": str(z.id),
                "name": z.name,
                "type": z.type,
                "bounds": z.bounds # {x, y, width, height}
            })
            
        print(f"✅ Cached {len(zones)} zones for {server_id}")

    def check_zone(self, x: float, y: float, server_id: str) -> Optional[dict]:
        """Checks if (x,y) is inside any cached zone."""
        if str(server_id) not in self.zone_cache:
            return None # Server not loaded yet or invalid
            
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
spatial_manager = SpatialManager()