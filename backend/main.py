from fastapi import FastAPI, HTTPException, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import database
import socketio
import uvicorn

# 1. Initialize FastAPI App
fastapi_app = FastAPI(title="Bus Management System Cloud Backend")

# Enable CORS for FastAPI
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Initialize Socket.IO Async Server (The "Fast Lane")
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')
# Wrap FastAPI with Socket.IO ASGI app
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# ==========================================
# SOCKET.IO EVENTS (Real-Time Communication)
# ==========================================

@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

@sio.event
async def join_route(sid, data):
    """Client asks to join a specific route room (e.g. 'route_4')"""
    route_id = data.get("route_id")
    if route_id:
        room_name = f"route_{route_id}"
        sio.enter_room(sid, room_name)
        print(f"Client {sid} joined room: {room_name}")
        await sio.emit("message", {"text": f"Joined live tracking for Route {route_id}"}, room=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

# ==========================================
# FASTAPI ROUTES (The "Slow Lane" & History)
# ==========================================

@fastapi_app.get("/")
async def root():
    return {"message": "Bus Management System Cloud Backend is running with WebSockets!"}

@fastapi_app.post("/api/sync/encoding")
async def sync_encoding(payload: dict = Body(...)):
    try:
        # Save face encoding data to MongoDB
        payload["synced_at"] = datetime.utcnow().isoformat()
        inserted_id = await database.save_encoding(payload)
        return {"status": "success", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import httpx

@fastapi_app.post("/api/sync/attendance")
async def sync_attendance(payload: dict = Body(...)):
    try:
        payload["synced_at"] = datetime.utcnow().isoformat()
        
        # Normalize fields for compatibility
        student_id = payload.get("student_id") or payload.get("login_id")
        name = payload.get("name") or payload.get("student_name")
        route_id = payload.get("route_id")
        
        if student_id:
            payload["student_id"] = student_id
            payload["login_id"] = student_id
            
            # Lookup route and name if missing
            user = await database.get_user_by_login_id(student_id)
            if user:
                if not route_id and user.get("route_id"):
                    route_id = user.get("route_id")
                if not name and user.get("name"):
                    name = user.get("name")
        
        # Ensure we always have a route_id and name
        payload["route_id"] = route_id or "4"
        if name:
            payload["name"] = name
            payload["student_name"] = name
        else:
            # Check for person_type fallback
            person_type = payload.get("person_type")
            if person_type:
                payload["name"] = f"{person_type} Face"
                payload["student_name"] = f"{person_type} Face"
            else:
                payload["name"] = "Unknown Student"
                payload["student_name"] = "Unknown Student"
                
        # Save attendance to MongoDB
        inserted_id = await database.save_attendance(payload)
        
        # Send Webhook to Express Server (Web App) for live broadcast
        try:
            async with httpx.AsyncClient() as client:
                await client.post("https://invertis-bus.onrender.com/api/internal/webhook", json={"type": "attendance", "data": payload})
        except Exception:
            pass # Ignore if Express is offline
        
        return {"status": "success", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.post("/api/sync/sensor")
async def sync_sensor(payload: dict = Body(...)):
    try:
        payload["synced_at"] = datetime.utcnow().isoformat()
        
        # 1. Save sensor data to MongoDB (Slow Lane)
        inserted_id = await database.save_sensor_data(payload)
        
        # 2. Send Webhook to Express Server (Web App) for live broadcast
        try:
            async with httpx.AsyncClient() as client:
                await client.post("https://invertis-bus.onrender.com/api/internal/webhook", json={"type": "sensor", "data": payload})
        except Exception:
            pass # Ignore if Express is offline
            
        return {"status": "success", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import jwt

SECRET_KEY = "super_secret_bus_key_123" # In production, keep this in .env

@fastapi_app.post("/api/login")
async def login(credentials: dict = Body(...)):
    login_id = credentials.get("login_id")
    password = credentials.get("password")
    
    if not login_id or not password:
        raise HTTPException(status_code=400, detail="Missing login_id or password")
        
    user = await database.get_user_by_login_id(login_id)
    
    # Check if user exists and password matches (Simple check for now)
    if not user or user.get("password") != password:
        raise HTTPException(status_code=401, detail="Invalid Credentials")
        
    # Generate JWT Token
    token_payload = {
        "login_id": login_id,
        "role": user.get("role", "student"),
        "name": user.get("name", "Unknown"),
        "exp": datetime.utcnow().timestamp() + 3600 * 24 # 24 hours expiry
    }
    token = jwt.encode(token_payload, SECRET_KEY, algorithm="HS256")
    
    return {
        "status": "success", 
        "token": token, 
        "user": {
            "name": user.get("name"),
            "role": user.get("role"),
            "route_id": user.get("route_id")
        }
    }

# ==========================================
# GRIEVANCE (COMMUNITY) APIs
# ==========================================

@fastapi_app.post("/api/grievance")
async def create_grievance(payload: dict = Body(...)):
    try:
        payload["created_at"] = datetime.utcnow().isoformat()
        payload["status"] = "pending"
        payload["upvotes"] = 0
        inserted_id = await database.save_complaint(payload)
        return {"status": "success", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.get("/api/grievances")
async def get_grievances():
    try:
        complaints = await database.get_all_complaints()
        return {"status": "success", "data": complaints}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.put("/api/grievance/{complaint_id}/resolve")
async def resolve_grievance(complaint_id: str):
    try:
        success = await database.resolve_complaint(complaint_id)
        if not success:
            raise HTTPException(status_code=404, detail="Complaint not found")
        return {"status": "success", "message": "Resolved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.delete("/api/grievance/{complaint_id}")
async def delete_grievance(complaint_id: str):
    try:
        success = await database.delete_complaint(complaint_id)
        if not success:
            raise HTTPException(status_code=404, detail="Complaint not found")
        return {"status": "success", "message": "Deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# ADMIN POWERS APIs
# ==========================================

@fastapi_app.get("/api/users")
async def get_all_users():
    try:
        users = await database.get_all_users()
        return {"status": "success", "data": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# HOME DASHBOARD APIs
# ==========================================

@fastapi_app.post("/api/sos")
async def trigger_sos(payload: dict = Body(...)):
    try:
        payload["time"] = datetime.utcnow().isoformat()
        inserted_id = await database.save_sos_alert(payload)
        
        # IMMEDIATELY emit to admins via WebSockets
        await sio.emit("sos_alert", payload)
        
        return {"status": "success", "message": "SOS Alert Sent", "id": inserted_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.post("/api/leave")
async def toggle_leave(payload: dict = Body(...)):
    try:
        # payload should contain login_id and date
        payload["date"] = datetime.utcnow().strftime("%Y-%m-%d")
        result = await database.mark_student_leave(payload)
        return {"status": "success", "action": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@fastapi_app.get("/api/route_status/{route_id}")
async def get_route_status(route_id: str):
    try:
        status = await database.get_route_crowd_status(route_id)
        return {"status": "success", "data": status}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the wrapped ASGI app
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
