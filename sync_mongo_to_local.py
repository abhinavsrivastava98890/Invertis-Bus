import os
import sqlite3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import config

# Load MongoDB configuration from backend/.env
load_dotenv(os.path.join(os.path.dirname(__file__), "backend/.env"))

MONGODB_URI = os.getenv("MONGODB_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME", "bus_management_db")
LOCAL_DB_PATH = getattr(config, "DATABASE_PATH", "data/attendance.db")

async def sync():
    print("=== STARTING CLOUD-TO-LOCAL SYNC ===")
    
    if not MONGODB_URI:
        print("Error: MONGODB_URI is not set in backend/.env!")
        return
        
    print(f"Connecting to MongoDB: {DATABASE_NAME}")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    # 1. Connect to SQLite Local DB
    print(f"Connecting to SQLite local database: {LOCAL_DB_PATH}")
    os.makedirs(os.path.dirname(LOCAL_DB_PATH) or ".", exist_ok=True)
    sqlite_conn = sqlite3.connect(LOCAL_DB_PATH)
    sqlite_cursor = sqlite_conn.cursor()
    
    # Ensure SQLite tables exist (just in case)
    sqlite_cursor.execute("""
        CREATE TABLE IF NOT EXISTS students (
            student_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            fee_status TEXT DEFAULT 'unpaid',
            registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            phone TEXT,
            email TEXT
        )
    """)
    sqlite_cursor.execute("""
        CREATE TABLE IF NOT EXISTS embeddings (
            embedding_id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id TEXT NOT NULL,
            embedding TEXT NOT NULL,
            capture_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            quality_score REAL DEFAULT 0.0,
            FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
        )
    """)
    sqlite_conn.commit()
    
    # 2. Fetch Students from MongoDB (role: student)
    print("Fetching students from MongoDB users collection...")
    cursor = db.users.find({"role": "student"})
    mongo_students = await cursor.to_list(length=1000)
    print(f"Found {len(mongo_students)} student(s) in MongoDB.")
    
    students_synced = 0
    student_map = {} # Keep map of student_id to name for formatting
    
    for student in mongo_students:
        student_id = student.get("login_id")
        name = student.get("name")
        fee_status = student.get("fee_status", "unpaid")
        phone = student.get("phone", "")
        email = student.get("email", "")
        
        if not student_id or not name:
            continue
            
        student_map[student_id] = name
        
        # Upsert student into local SQLite
        sqlite_cursor.execute("""
            INSERT OR REPLACE INTO students (student_id, name, fee_status, phone, email)
            VALUES (?, ?, ?, ?, ?)
        """, (student_id, name, fee_status, phone, email))
        students_synced += 1
        
    sqlite_conn.commit()
    print(f"Successfully upserted {students_synced} student profiles to SQLite.")
    
    # 3. Fetch Encodings from MongoDB
    print("Fetching face encodings from MongoDB encodings collection...")
    cursor = db.encodings.find({})
    mongo_encodings = await cursor.to_list(length=5000)
    print(f"Found {len(mongo_encodings)} face encoding record(s) in MongoDB.")
    
    embeddings_synced = 0
    embeddings_skipped = 0
    
    for record in mongo_encodings:
        student_id = record.get("student_id")
        embedding_str = record.get("embedding")
        quality_score = record.get("quality_score", 0.0)
        
        if not student_id or not embedding_str:
            continue
            
        # If student not in local students table (e.g. they exist in encodings but not users)
        if student_id not in student_map:
            # Let's verify if they are in SQLite students table
            sqlite_cursor.execute("SELECT name FROM students WHERE student_id = ?", (student_id,))
            exists = sqlite_cursor.fetchone()
            if not exists:
                fallback_name = f"Student {student_id}"
                sqlite_cursor.execute("""
                    INSERT INTO students (student_id, name, fee_status, phone, email)
                    VALUES (?, ?, 'unpaid', '', '')
                """, (student_id, fallback_name))
                sqlite_conn.commit()
                student_map[student_id] = fallback_name
                print(f"Registered placeholder profile for student_id: {student_id}")
        
        # Check if this exact embedding already exists for this student in SQLite
        sqlite_cursor.execute("""
            SELECT 1 FROM embeddings WHERE student_id = ? AND embedding = ?
        """, (student_id, embedding_str))
        
        if sqlite_cursor.fetchone():
            embeddings_skipped += 1
            continue
            
        # Insert new embedding
        sqlite_cursor.execute("""
            INSERT INTO embeddings (student_id, embedding, quality_score)
            VALUES (?, ?, ?)
        """, (student_id, embedding_str, quality_score))
        embeddings_synced += 1
        
    sqlite_conn.commit()
    sqlite_conn.close()
    
    print("\n=== SYNC SUMMARY ===")
    print(f"Students profile upserted: {students_synced}")
    print(f"New face embeddings imported: {embeddings_synced}")
    print(f"Existing embeddings skipped: {embeddings_skipped}")
    print("Sync complete successfully!")

if __name__ == "__main__":
    asyncio.run(sync())
