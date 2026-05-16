# 🚌 Bus Management System - Demo Guide

Follow these steps to demonstrate the Offline-First Edge-to-Cloud architecture of the Bus Management System. 

---

## 🟢 Part 1: Online Mode Execution

**Step 1: Start the Cloud Backend (Terminal 1)**
This terminal simulates the remote cloud infrastructure that receives data from the buses.
```powershell
.\venv_win\Scripts\activate
cd backend
python -m uvicorn main:app --reload --port 8000
```
*(Wait until `Application startup complete` is displayed.)*

**Step 2: Start the Edge Device Camera (Terminal 2)**
This terminal simulates the Raspberry Pi located inside the bus.
```powershell
.\venv_win\Scripts\activate
python main.py --recognize
```
*(The camera interface will open. If an unregistered or unpaid individual is detected, the image will be captured and instantly uploaded to the cloud backend. Terminal 2 will log: `[Sync Worker] Successfully synced item`).*

---

## 🔴 Part 2: Offline-First Capability (Disconnection Simulation)
This section demonstrates the system's fault-tolerance and local queueing capabilities during network outages.

**Step 1: Simulate Network Loss (Terminal 1)**
In Terminal 1 (Backend), press **CTRL + C** to stop the server. This simulates the bus entering a low-connectivity zone.

**Step 2: Capture Data Offline**
Keep Terminal 2 running. Step in front of the camera so it detects an unknown individual.
- *Explain to the audience:* "Since the internet connection is currently down, the system does not crash or lose the data. Instead, it securely stores the image and metadata in the local SQLite database."
- *(Terminal 2 will display `Network error while syncing`, which confirms the system is attempting to sync but failing gracefully).*

**Step 3: Simulate Network Restoration (Terminal 1)**
Restart the backend server in Terminal 1 to simulate the bus re-entering a network coverage area:
```powershell
python -m uvicorn main:app --reload --port 8000
```

**Step 4: The Auto-Recovery Sync Worker**
Do not interact with Terminal 2. Simply observe the logs.
- *Explain to the audience:* "As soon as the network is restored, our background Sync Engine automatically detects the pending items in the local queue, pushes them to AWS S3 and MongoDB, and clears the local cache to save memory."
- *(Within 10-15 seconds, Terminal 2 will automatically print `[Sync Worker] Successfully synced item`).*

---

## ⏹️ Part 3: Terminating the System
Once the demonstration is complete:
1. In Terminal 2, press **'q'** to safely release the camera and close the application.
2. In Terminal 1, press **CTRL + C** to shut down the backend server.
