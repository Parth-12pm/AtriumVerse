
================================================================================
ATRIUMVERSE - PROJECT SETUP & COMMANDS
================================================================================

PREREQUISITES:
-------------
1. Python 3.10+ (Check with: python --version)
2. Node.js 18+  (Check with: node -v)
3. PostgreSQL   (Check service status)
4. Redis        (Check with: redis-server --version)

--------------------------------------------------------------------------------
BACKEND SETUP (Python/FastAPI)
--------------------------------------------------------------------------------

1. NAVIGATE TO BACKEND DIRECTORY:
   cd AtriumVerse\backend

2. CREATE VIRTUAL ENVIRONMENT (If not exists):
   python -m venv .venv

3. ACTIVATE VIRTUAL ENVIRONMENT:
   .venv\Scripts\Activate

4. INSTALL DEPENDENCIES:
   pip install fastapi uvicorn[standard] sqlalchemy asyncpg python-dotenv passlib[bcrypt] python-jose[cryptography] redis aioredis websockets psutil numpy pandas

   (Or using requirements.txt if available: pip install -r requirements.txt)

5. START REDIS SERVER (Required for WebSocket):
   redis-server

6. RUN BACKEND SERVER:
   uvicorn app.main:app --reload

   Server will start at: http://localhost:8000
   API Docs available at: http://localhost:8000/docs

--------------------------------------------------------------------------------
FRONTEND SETUP (Next.js/React)
--------------------------------------------------------------------------------

1. NAVIGATE TO FRONTEND DIRECTORY:
   cd AtriumVerse\frontend

2. INSTALL DEPENDENCIES:
   pnpm install
   
   (Or if pnpm is not installed: npm install -g pnpm)

3. RUN FRONTEND SERVER:
   pnpm run dev

   App will start at: http://localhost:3000

--------------------------------------------------------------------------------
INSTALLED MODULES & VERSIONS
--------------------------------------------------------------------------------

BACKEND (Key Modules):
- FastAPI
- Uvicorn
- SQLAlchemy (Async)
- AsyncPG
- Python-Jose
- Passlib (Bcrypt)
- Redis

FRONTEND (Key Modules from package.json):
- Next.js: 16.1.5
- React: 19.2.3
- Phaser: 3.90.0
- Grid Engine: 2.48.2
- Tailwind CSS: 4.0
- Lucide React: 0.563.0
- Sonner: 2.0.7
- Date-fns: 4.1.0
- Radix UI Components (Dialog, Avatar, Select, etc.)
- Class Variance Authority (CVA)
- Tailwind Merge

--------------------------------------------------------------------------------
COMMON ISSUES & FIXES
--------------------------------------------------------------------------------
1. "Redis ConnectionError": Ensure `redis-server` is running in a separate terminal.
2. "WebSocket Error": Check if backend is running and Redis is active.
3. "Database Connection Failed": Ensure PostgreSQL service is running and credentials in `.env` are correct.
4. "Multiplayer user conflict": Use Incognito mode for the second user to avoid shared localStorage sessions.

================================================================================
