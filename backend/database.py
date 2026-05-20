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

# --- NEW COLLECTIONS FOR PHASE 2 & 3 ---

async def create_user(user_data: dict):
    """Save a new user (Student, Admin, Driver)"""
    collection = db["users"]
    result = await collection.insert_one(user_data)
    return str(result.inserted_id)

async def get_user_by_login_id(login_id: str):
    """Find a user by their Roll Number (Students) or Employee ID (Admin/Driver)"""
    collection = db["users"]
    user = await collection.find_one({"login_id": login_id})
    return user

async def save_complaint(complaint_data: dict):
    """Save a new grievance/complaint"""
    collection = db["complaints"]
    result = await collection.insert_one(complaint_data)
    return str(result.inserted_id)

async def get_all_complaints():
    """Fetch all complaints for the Community feed"""
    collection = db["complaints"]
    cursor = collection.find({}).sort("created_at", -1) # Sort by newest
    complaints = await cursor.to_list(length=100)
    
    # Convert ObjectId to string for JSON serialization
    for comp in complaints:
        comp["_id"] = str(comp["_id"])
    return complaints

# --- NEW COLLECTIONS FOR ADMIN POWERS ---

from bson.objectid import ObjectId

async def resolve_complaint(complaint_id: str):
    """Mark a complaint as resolved in MongoDB"""
    collection = db["complaints"]
    result = await collection.update_one(
        {"_id": ObjectId(complaint_id)},
        {"$set": {"status": "resolved"}}
    )
    return result.modified_count > 0

async def delete_complaint(complaint_id: str):
    """Delete a complaint completely"""
    collection = db["complaints"]
    result = await collection.delete_one({"_id": ObjectId(complaint_id)})
    return result.deleted_count > 0

async def get_all_users():
    """Fetch all users (Students, Drivers, Admins) for the Admin Dashboard"""
    collection = db["users"]
    cursor = collection.find({}).sort("role", 1)
    users = await cursor.to_list(length=1000)
    
    for u in users:
        u["_id"] = str(u["_id"])
        if "password" in u:
            del u["password"] # Don't send passwords to frontend
    return users

# --- NEW COLLECTIONS FOR HOME PAGE (SOS, LEAVES) ---

async def save_sos_alert(sos_data: dict):
    """Save SOS alert to history"""
    collection = db["sos_alerts"]
    result = await collection.insert_one(sos_data)
    return str(result.inserted_id)

async def mark_student_leave(leave_data: dict):
    """Mark a student as not boarding for today"""
    collection = db["leaves"]
    # Check if already marked
    existing = await collection.find_one({"login_id": leave_data["login_id"], "date": leave_data["date"]})
    if existing:
        # Toggle leave
        await collection.delete_one({"_id": existing["_id"]})
        return "cancelled"
    else:
        await collection.insert_one(leave_data)
        return "marked"

async def get_route_crowd_status(route_id: str):
    """Calculate how many seats are filled based on attendance today"""
    # Simple mockup for now. In real-world, count attendance for today where route == route_id
    collection = db["attendance"]
    # ... placeholder logic ...
    return {"total_seats": 50, "filled": 42, "status": "High"}

