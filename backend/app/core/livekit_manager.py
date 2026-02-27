import os 
import uuid 
from datetime import timedelta
from dotenv import load_dotenv
from livekit.api import AccessToken , VideoGrants


load_dotenv()

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL")

def audio_room_name(server_id: str) -> str:
    return f"audio_{server_id}"

def video_room_name(zone_id: str) -> str:
    return f"video_{zone_id}"



def create_user_token(
    room_name: str,
    user_id: str,
    username: str,
    can_publish: bool = True,
    can_subscribe: bool = True,
    ttl_hours: int = 1,
) -> str:


    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise ValueError("LIVEKIT_API_KEY and LIVEKIT_API_SECRET not found !!")
    
    token = (
        AccessToken(api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET)
        .with_identity(user_id)
        .with_name(username)
        .with_ttl(timedelta(hours=ttl_hours))
        .with_grants(
            VideoGrants(
                room=room_name,
                room_join=True,
                can_publish=can_publish,
                can_subscribe=can_subscribe,
            )
        )
        .to_jwt()
    )
    return token


def create_guest_token(room_name: str, guest_label: str = "Guest") -> str:
    guest_id = f"guest_{uuid.uuid4().hex[:8]}"
    guest_name = f"{guest_label}_{uuid.uuid4().hex[:4]}"
    return create_user_token(
        room_name=room_name,
        user_id=guest_id,
        username=guest_name,
        ttl_hours=24
    )


def get_livekit_url() -> str:
    if not LIVEKIT_URL:
        raise ValueError("LIVEKIT_URL not found !!")
    return LIVEKIT_URL