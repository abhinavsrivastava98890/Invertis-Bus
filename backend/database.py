import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "bus_management_db")

client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]
incidents_collection = db["incidents"]

async def save_incident_metadata(incident_data: dict):
    """
    Saves the incident metadata (including S3 URL) into MongoDB.
    """
    result = await incidents_collection.insert_one(incident_data)
    return str(result.inserted_id)
