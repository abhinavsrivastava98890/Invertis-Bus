import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def create_ti_user():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI", "mongodb+srv://user:pass@cluster.mongodb.net/test")) # Wait, I shouldn't guess URI if it's not set. But let's check .env.
    db = client[os.getenv("DATABASE_NAME", "bus_management_db")]
    
    ti_user = {
        "login_id": "TI01",
        "password": "tipassword",
        "name": "Amit Sharma (TI)",
        "role": "transport_incharge",
        "route_id": None
    }
    
    # Check if exists
    existing = await db.users.find_one({"login_id": "TI01"})
    if not existing:
        await db.users.insert_one(ti_user)
        print("Successfully created Transport Incharge user (TI01).")
    else:
        print("Transport Incharge user already exists.")

if __name__ == "__main__":
    asyncio.run(create_ti_user())
