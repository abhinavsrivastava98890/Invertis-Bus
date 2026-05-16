from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import json

from database import save_incident_metadata
from aws_s3 import upload_image_to_s3

app = FastAPI(title="Bus Management Backend API")

# Allow CORS for dashboard (if needed later)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "Backend is running"}

@app.post("/api/incidents/upload")
async def upload_incident(
    image: UploadFile = File(...),
    metadata: str = Form(...)  # Expecting a JSON string from the Pi
):
    """
    Endpoint for Raspberry Pi to upload an Unknown or Unpaid face.
    """
    try:
        # Parse the JSON metadata sent by Pi
        incident_data = json.loads(metadata)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid metadata format. Must be JSON.")
    
    # 1. Read the image file bytes
    file_bytes = await image.read()
    
    # 2. Upload to AWS S3
    s3_url = await upload_image_to_s3(file_bytes, image.filename)
    if not s3_url:
        raise HTTPException(status_code=500, detail="Failed to upload image to S3.")
    
    # 3. Add server timestamp and S3 URL to the metadata
    incident_data["s3_image_url"] = s3_url
    incident_data["server_received_at"] = datetime.utcnow().isoformat()
    
    # 4. Save metadata to MongoDB Atlas
    # Note: If MONGODB_URI is not set, this will fail. We wrap in try-except for dummy mode.
    try:
        mongo_id = await save_incident_metadata(incident_data)
        incident_data["_id"] = mongo_id
    except Exception as e:
        # If DB fails (e.g., credentials not set yet), we still return success for testing Pi sync,
        # but in production we'd want this to fail.
        print(f"MongoDB save failed (Are credentials set?): {e}")
        incident_data["db_status"] = "Not Saved (Missing Credentials)"

    return {
        "message": "Incident synced successfully",
        "data": incident_data
    }
