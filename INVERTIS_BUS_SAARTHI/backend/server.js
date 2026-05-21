const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 5000;
const SECRET_KEY = "supersecret_jwt_key_bus_saarthi_2025"; // Hardcoded to match python for now

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.DATABASE_NAME || 'bus_management_db'
}).then(() => console.log("Connected to MongoDB via Mongoose"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- Schemas & Models ---
const UserSchema = new mongoose.Schema({
  name: String,
  login_id: { type: String, unique: true },
  password: { type: String, select: false }, // Only fetch password when verifying
  role: String,
  route_id: String,
  fee_status: String,
  phone: String
});
const User = mongoose.model('User', UserSchema);

const RouteSchema = new mongoose.Schema({
  route_id: { type: String, unique: true },
  route_name: String,
  bus_number: String,
  driver_id: String,
  stops: String
});
const Route = mongoose.model('Route', RouteSchema);

const GrievanceSchema = new mongoose.Schema({
  login_id: String,
  route: String,
  text: String,
  realName: String,
  time: String,
  status: String,
  upvotes: Number,
  created_at: Date
});
const Grievance = mongoose.model('Grievance', GrievanceSchema);

const SosAlertSchema = new mongoose.Schema({
  login_id: String,
  student: String,
  route: String,
  time: Date
});
const SosAlert = mongoose.model('SosAlert', SosAlertSchema);

const BroadcastSchema = new mongoose.Schema({
  message: String,
  timestamp: Date
});
const Broadcast = mongoose.model('Broadcast', BroadcastSchema);

// --- WebSocket Handling ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_route', (data) => {
    if (data && data.route_id) {
      socket.join(`route_${data.route_id}`);
      console.log(`Socket ${socket.id} joined route_${data.route_id}`);
    }
  });

  // RPi pushes telemetry here
  socket.on('rpi_telemetry', (data) => {
    io.to(`route_${data.route_id}`).emit('live_telemetry', data);
  });

  // RPi pushes attendance here
  socket.on('rpi_attendance', (data) => {
    io.to(`route_${data.route_id}`).emit('live_attendance', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- REST APIs ---

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ role: 1 });
    res.json({ status: "success", data: users });
  } catch (err) {
    res.status(500).json({ status: "error", detail: err.message });
  }
});

app.get('/api/routes', async (req, res) => {
  try {
    const routes = await Route.find().sort({ route_id: 1 });
    res.json({ status: "success", data: routes });
  } catch (err) {
    res.status(500).json({ status: "error", detail: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { login_id, password } = req.body;
  try {
    const user = await User.findOne({ login_id }).select('+password');
    if (!user || user.password !== password) {
      return res.status(401).json({ detail: "Invalid Credentials" });
    }
    
    const tokenPayload = {
      login_id: user.login_id,
      role: user.role || 'student',
      name: user.name || 'Unknown',
      exp: Math.floor(Date.now() / 1000) + (3600 * 24)
    };
    
    const token = jwt.sign(tokenPayload, SECRET_KEY);
    
    res.json({
      status: "success",
      token,
      user: {
        name: user.name,
        role: user.role,
        route_id: user.route_id
      }
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/grievances', async (req, res) => {
  try {
    const complaints = await Grievance.find().sort({ created_at: -1 });
    res.json({ status: "success", data: complaints });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/grievance', async (req, res) => {
  try {
    const payload = { ...req.body, created_at: new Date(), status: 'pending', upvotes: 0 };
    const grievance = new Grievance(payload);
    await grievance.save();
    res.json({ status: "success", id: grievance._id });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/grievance/:id/resolve', async (req, res) => {
  try {
    await Grievance.findByIdAndUpdate(req.params.id, { status: 'resolved' });
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/grievance/:id/upvote', async (req, res) => {
  try {
    await Grievance.findByIdAndUpdate(req.params.id, { $inc: { upvotes: 1 } });
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/grievance/:id', async (req, res) => {
  try {
    await Grievance.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/sos', async (req, res) => {
  try {
    const payload = { ...req.body, time: new Date() };
    const sos = new SosAlert(payload);
    await sos.save();
    
    io.emit("sos_alert", { ...payload, _id: sos._id });
    res.json({ status: "success", id: sos._id });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/sos/cancel', (req, res) => {
  try {
    io.emit("sos_cancelled", req.body);
    res.json({ status: "success", message: "SOS cancelled" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/broadcast', async (req, res) => {
  try {
    const payload = { ...req.body, timestamp: new Date() };
    const broadcast = new Broadcast(payload);
    await broadcast.save();
    
    io.emit("global_broadcast", { ...payload, _id: broadcast._id });
    res.json({ status: "success", id: broadcast._id });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/broadcast', async (req, res) => {
  try {
    const latest = await Broadcast.findOne().sort({ timestamp: -1 });
    res.json({ status: "success", data: latest });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Mock Leave API (To match Python logic)
app.post('/api/leave', async (req, res) => {
  res.json({ action: 'marked' });
});

// Mock Route Status API (To match Python logic)
app.get('/api/route_status/:route_id', async (req, res) => {
  res.json({
    status: 'success',
    data: { filled: Math.floor(Math.random() * 40), total: 50, status: 'Normal' }
  });
});

// --- Internal Webhooks (From FastAPI Y-Junction) ---
app.post('/api/internal/telemetry', async (req, res) => {
  // Receives Live Telemetry from FastAPI and Broadcasts to React App
  const data = req.body;
  const route_id = data.route_id || '4'; 
  
  io.to(`route_${route_id}`).emit('live_telemetry', {
    speed: data.mpu_speed_kmh || data.gps_speed_knots * 1.852 || 0,
    heading: data.heading_deg || 0,
    comfort: 'Smooth',
    location: { lat: data.latitude, lng: data.longitude }
  });
  
  res.status(200).json({ status: "forwarded" });
});

// --- Internal Webhook for Y-Shape Architecture ---
// FastAPI (Hardware Backend) will send live data here, and Express will broadcast it to React
app.post('/api/internal/webhook', async (req, res) => {
  const { type, data } = req.body;
  if (type === 'sensor') {
    const route_id = data.route_id || '4';
    // Format the payload to match what React expects
    io.to(`route_${route_id}`).emit('live_telemetry', {
      speed: data.mpu_speed_kmh || (data.gps_speed_knots ? data.gps_speed_knots * 1.852 : 0) || 0,
      heading: data.heading_deg || 0,
      comfort: 'Smooth',
      location: { lat: data.latitude, lng: data.longitude }
    });
  } else if (type === 'attendance') {
    const route_id = data.route_id || '4';
    io.to(`route_${route_id}`).emit('live_attendance', data);
  }
  res.status(200).json({ status: "success", message: "Broadcasted via Express" });
});

server.listen(PORT, () => {
  console.log(`Express Web App Backend running on port ${PORT}`);
});
