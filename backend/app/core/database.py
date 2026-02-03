from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker , declarative_base
import os 
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set")


engine = None

if DATABASE_URL:
    from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
    
    parsed = urlparse(DATABASE_URL)
    
    if parsed.scheme in ["postgres", "postgresql"]:
        parsed = parsed._replace(scheme="postgresql+asyncpg")
        
    qs = parse_qs(parsed.query)
    connect_args = {}
    
    if "sslmode" in qs:
        sslmode = qs.pop("sslmode")[0]
        if sslmode == "require":
            connect_args["ssl"] = "require"
        
    new_query = urlencode(qs, doseq=True)
    parsed = parsed._replace(query=new_query)
    
    FINAL_URL = urlunparse(parsed)
    
    engine = create_async_engine(FINAL_URL, echo=True, connect_args=connect_args)

SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    async with SessionLocal() as session:
        yield session