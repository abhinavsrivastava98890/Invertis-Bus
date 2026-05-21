from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import database

app = FastAPI(title="Bus Management System Cloud Backend")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Bus Management System Cloud Backend is running."}

@app.post("/api/sync/encoding")
async def sync_encoding(payload: dict = Body(...)):
    try:
        # Save face encoding data to MongoDB
        payload["synced_at"] = datetime.utcnow().isoformat()
        inserted_id = await database.save_encoding(payload)
        return {"status": "success", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/attendance")
async def sync_attendance(payload: dict = Body(...)):
    try:
        # Save attendance record to MongoDB
        payload["synced_at"] = datetime.utcnow().isoformat()
        inserted_id = await database.save_attendance(payload)
        return {"status": "success", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/sensor")
async def sync_sensor(payload: dict = Body(...)):
    try:
        # Save sensor data to MongoDB
        payload["synced_at"] = datetime.utcnow().isoformat()
        inserted_id = await database.save_sensor_data(payload)
        return {"status": "success", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
