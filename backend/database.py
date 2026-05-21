import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "bus_management_db")

client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]

async def save_encoding(data: dict):
    collection = db["encodings"]
    result = await collection.insert_one(data)
    return str(result.inserted_id)

async def save_attendance(data: dict):
    collection = db["attendance"]
    result = await collection.insert_one(data)
    return str(result.inserted_id)

async def save_sensor_data(data: dict):
    collection = db["sensor_data"]
    result = await collection.insert_one(data)
    return str(result.inserted_id)
