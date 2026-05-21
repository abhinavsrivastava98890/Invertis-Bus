import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def seed_users():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
    db = client[os.getenv("DATABASE_NAME", "bus_management_db")]
    
    # Check if users already exist
    count = await db.users.count_documents({})
    if count > 0:
        print(f"Database already has {count} users. Skipping seed.")
        return

    users = [
        {
            "login_id": "INV2023BCA01",
            "password": "password123",
            "name": "Abhinav Singh",
            "role": "student",
            "route_id": "4"
        },
        {
            "login_id": "ADMIN123",
            "password": "adminpassword",
            "name": "Admin Boss",
            "role": "admin",
            "route_id": None
        },
        {
            "login_id": "DRIVER01",
            "password": "driverpassword",
            "name": "Ramesh Singh",
            "role": "driver",
            "route_id": "4"
        }
    ]
    
    await db.users.insert_many(users)
    print("Successfully seeded 3 test users (Student, Admin, Driver) into MongoDB!")

if __name__ == "__main__":
    asyncio.run(seed_users())
