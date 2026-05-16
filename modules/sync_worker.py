import time
import threading
import requests
import json
import os
import socket
from typing import Optional
from .database import AttendanceDatabase

class SyncWorker:
    """
    Background worker that reliably syncs local queue data to the cloud backend.
    Runs in a separate thread to prevent blocking the camera UI.
    """
    def __init__(self, db_path: str = "data/attendance.db", backend_url: str = "http://127.0.0.1:8000/api/incidents/upload", sync_interval: int = 10):
        self.db_path = db_path
        self.backend_url = backend_url
        self.sync_interval = sync_interval
        self.is_running = False
        self.thread: Optional[threading.Thread] = None

    def check_internet(self) -> bool:
        """Check if internet is available by trying to resolve a public DNS."""
        try:
            # Connect to Google's public DNS server
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            return True
        except OSError:
            return False

    def process_queue(self):
        """Process pending items in the database queue."""
        db = AttendanceDatabase(self.db_path)
        
        pending_items = db.get_pending_syncs(limit=5)
        
        if not pending_items:
            db.close()
            return
            
        print(f"[Sync Worker] Found {len(pending_items)} pending items to sync.")
        
        for item in pending_items:
            queue_id = item['id']
            image_path = item['image_path']
            metadata = item['metadata']
            
            # Check if image file actually exists locally
            if not os.path.exists(image_path):
                print(f"[Sync Worker] Warning: Image {image_path} missing. Skipping.")
                db.mark_sync_completed(queue_id) # Mark completed to prevent infinite retries on missing files
                continue
                
            try:
                # Send to FastAPI Backend
                with open(image_path, "rb") as image_file:
                    files = {"image": (os.path.basename(image_path), image_file, "image/jpeg")}
                    data = {"metadata": metadata}
                    
                    response = requests.post(self.backend_url, files=files, data=data, timeout=10)
                    
                    if response.status_code == 200:
                        print(f"[Sync Worker] Successfully synced item {queue_id}.")
                        # Mark as synced in local DB
                        db.mark_sync_completed(queue_id)
                        
                        # Delete local image to save disk space
                        try:
                            # Must close file before deleting in Windows
                            pass 
                        except Exception:
                            pass
                
                # File is closed here because of 'with' block, now safe to delete
                if response.status_code == 200:
                    try:
                        os.remove(image_path)
                    except Exception as e:
                        print(f"[Sync Worker] Could not delete {image_path}: {e}")

                    
            except requests.exceptions.RequestException as e:
                print(f"[Sync Worker] Network error while syncing item {queue_id}: {e}")
                db.increment_sync_retry(queue_id)
            except Exception as e:
                print(f"[Sync Worker] Unexpected error syncing item {queue_id}: {e}")
                db.increment_sync_retry(queue_id)

        db.close()

    def _sync_loop(self):
        """The main loop that runs in the background thread."""
        print("[Sync Worker] Background sync engine started.")
        while self.is_running:
            try:
                if self.check_internet():
                    self.process_queue()
                else:
                    # Optional debug logging for offline state
                    pass
            except Exception as e:
                print(f"[Sync Worker] Fatal error in sync loop: {e}")
                
            # Sleep before next sync cycle
            time.sleep(self.sync_interval)
            
    def start(self):
        """Start the background sync worker."""
        if not self.is_running:
            self.is_running = True
            self.thread = threading.Thread(target=self._sync_loop, daemon=True)
            self.thread.start()
            
    def stop(self):
        """Stop the background sync worker."""
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2.0)
            print("[Sync Worker] Stopped.")
