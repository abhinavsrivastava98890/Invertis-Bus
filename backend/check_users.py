import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def check():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URI"))
    db = client[os.getenv("DATABASE_NAME", "bus_management_db")]
    users = await db.users.find({}).to_list(length=10)
    for u in users:
        lid = u.get("login_id", "N/A")
        pwd = u.get("password", "N/A")
        role = u.get("role", "N/A")
        print("ID:", lid, "| Pass:", pwd, "| Role:", role)

asyncio.run(check())
