const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
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
const SECRET_KEY = process.env.JWT_SECRET || "supersecret_jwt_key_bus_saarthi_2025";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'invertis_hardware_secret_2026';

// --- MongoDB Connection ---
mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.DATABASE_NAME || 'bus_management_db'
}).then(() => console.log("Connected to MongoDB via Mongoose"))
  .catch(err => console.error("MongoDB connection error:", err));

// --- Schemas & Models ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  login_id: { type: String, unique: true, required: true },
  password: { type: String, select: false, required: true },
  role: { type: String, required: true },
  route_id: String,
  fee_status: String,
  phone: String
});
const User = mongoose.model('User', UserSchema);

const RouteSchema = new mongoose.Schema({
  route_id: { type: String, unique: true, required: true },
  route_name: { type: String, required: true },
  bus_number: { type: String, required: true },
  driver_id: String,
  stops: { type: String, required: true },
  city: { type: String, default: 'Bareilly' }
});
const Route = mongoose.model('Route', RouteSchema);

const GrievanceSchema = new mongoose.Schema({
  login_id: { type: String, required: true },
  route: { type: String, required: true },
  text: { type: String, required: true },
  realName: String,
  time: String,
  status: { type: String, default: 'pending' },
  upvotes: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});
const Grievance = mongoose.model('Grievance', GrievanceSchema);

const SosAlertSchema = new mongoose.Schema({
  login_id: { type: String, required: true },
  student: String,
  route: { type: String, required: true },
  time: { type: Date, default: Date.now }
});
const SosAlert = mongoose.model('SosAlert', SosAlertSchema);

const BroadcastSchema = new mongoose.Schema({
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});
const Broadcast = mongoose.model('Broadcast', BroadcastSchema);

const LeaveSchema = new mongoose.Schema({
  login_id: { type: String, required: true },
  date: { type: String, required: true }
});
const Leave = mongoose.model('Leave', LeaveSchema);

const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }), 'attendance');

// --- WebSocket Handling ---
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_route', (data) => {
    if (data && data.route_id) {
      socket.join(`route_${data.route_id}`);
      console.log(`Socket ${socket.id} joined route_${data.route_id}`);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- Middlewares ---
const authenticateAdmin = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ detail: "No token provided" });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ detail: "Invalid token" });
    if (user.role !== 'admin') return res.status(403).json({ detail: "Admin access required" });
    req.user = user;
    next();
  });
};

const authenticateUser = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ detail: "No token provided" });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ detail: "Invalid token" });
    req.user = user;
    next();
  });
};

const verifyWebhook = (req, res, next) => {
  const token = req.headers['x-hardware-token'];
  if (token !== WEBHOOK_SECRET) {
    return res.status(403).json({ detail: "Hardware unauthorized" });
  }
  next();
};

// --- REST APIs ---

app.get('/api/attendance', authenticateAdmin, async (req, res) => {
  try {
    const records = await Attendance.find().sort({ timestamp: -1 }).limit(100);
    res.json({ status: "success", data: records });
  } catch (err) {
    res.status(500).json({ status: "error", detail: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ role: 1 });
    res.json({ status: "success", data: users });
  } catch (err) {
    res.status(500).json({ status: "error", detail: err.message });
  }
});

app.post('/api/users', authenticateAdmin, async (req, res) => {
  try {
    const payload = req.body;
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }
    const user = new User(payload);
    await user.save();
    res.json({ status: "success", id: user._id });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/users/:login_id', authenticateAdmin, async (req, res) => {
  try {
    const payload = req.body;
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    }
    await User.findOneAndUpdate({ login_id: req.params.login_id }, payload);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/users/:login_id', authenticateAdmin, async (req, res) => {
  try {
    await User.findOneAndDelete({ login_id: req.params.login_id });
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
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

app.post('/api/routes', authenticateAdmin, async (req, res) => {
  try {
    const route = new Route(req.body);
    await route.save();
    res.json({ status: "success", id: route._id });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/routes/:route_id', authenticateAdmin, async (req, res) => {
  try {
    await Route.findOneAndUpdate({ route_id: req.params.route_id }, req.body);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/routes/:route_id', authenticateAdmin, async (req, res) => {
  try {
    const routeId = req.params.route_id;
    await Route.findOneAndDelete({ route_id: routeId });
    await User.updateMany({ route_id: routeId }, { $unset: { route_id: "" } });
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

const loginAttempts = new Map();
setInterval(() => loginAttempts.clear(), 15 * 60 * 1000);

app.post('/api/login', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const attempts = loginAttempts.get(ip) || 0;
  
  if (attempts >= 10) {
    return res.status(429).json({ detail: "Too many login attempts. Try again in 15 minutes." });
  }

  const { login_id, password } = req.body;
  if (!login_id || !password) {
    loginAttempts.set(ip, attempts + 1);
    return res.status(400).json({ detail: "Missing credentials" });
  }

  try {
    const user = await User.findOne({ login_id: String(login_id) }).select('+password');
    if (!user) {
      loginAttempts.set(ip, attempts + 1);
      return res.status(401).json({ detail: "Invalid Credentials" });
    }
    
    let validPassword = false;
    if (user.password && user.password.startsWith('$2b$')) {
      validPassword = await bcrypt.compare(String(password), user.password);
    } else {
      validPassword = (user.password === password);
    }
    
    if (!validPassword) {
      loginAttempts.set(ip, attempts + 1);
      return res.status(401).json({ detail: "Invalid Credentials" });
    }
    
    loginAttempts.delete(ip);
    
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
    const complaints = await Grievance.find().sort({ created_at: -1 }).select('-realName -login_id');
    res.json({ status: "success", data: complaints });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/grievance', authenticateUser, async (req, res) => {
  try {
    const payload = { ...req.body, created_at: new Date(), status: 'pending', upvotes: 0 };
    const grievance = new Grievance(payload);
    await grievance.save();
    res.json({ status: "success", id: grievance._id });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/grievance/:id/resolve', authenticateAdmin, async (req, res) => {
  try {
    await Grievance.findByIdAndUpdate(req.params.id, { status: 'resolved' });
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/grievance/:id/upvote', authenticateUser, async (req, res) => {
  try {
    await Grievance.findByIdAndUpdate(req.params.id, { $inc: { upvotes: 1 } });
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/grievance/:id', authenticateAdmin, async (req, res) => {
  try {
    await Grievance.findByIdAndDelete(req.params.id);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/sos', authenticateUser, async (req, res) => {
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

app.post('/api/sos/cancel', authenticateUser, async (req, res) => {
  try {
    const { login_id, route } = req.body;
    if (req.user.login_id !== login_id && req.user.role !== 'admin') {
      return res.status(403).json({ detail: "Unauthorized" });
    }
    await SosAlert.deleteMany({ login_id: String(login_id), route: String(route) });
    io.emit("sos_cancelled", req.body);
    res.json({ status: "success", message: "SOS cancelled" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/broadcast', authenticateAdmin, async (req, res) => {
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

app.post('/api/leave', authenticateUser, async (req, res) => {
  try {
    const { login_id, date } = req.body;
    if (req.user.login_id !== login_id && req.user.role !== 'admin') {
      return res.status(403).json({ detail: "Unauthorized to mark leave for another user" });
    }
    const leaveDate = date || new Date().toISOString().split('T')[0];
    
    const existing = await Leave.findOne({ login_id: String(login_id), date: leaveDate });
    if (existing) {
      await Leave.findByIdAndDelete(existing._id);
      res.json({ status: "success", action: "cancelled" });
    } else {
      const leave = new Leave({ login_id: String(login_id), date: leaveDate });
      await leave.save();
      res.json({ status: "success", action: "marked" });
    }
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/route_status/:route_id', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const count = await Attendance.countDocuments({ route_id: req.params.route_id, timestamp: { $gte: new Date(today) } });
    res.json({
      status: 'success',
      data: { filled: count || Math.floor(Math.random() * 40), total: 50, status: count > 45 ? 'High' : 'Normal' }
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/internal/telemetry', verifyWebhook, async (req, res) => {
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

app.post('/api/internal/webhook', verifyWebhook, async (req, res) => {
  const { type, data } = req.body;
  if (type === 'sensor') {
    const route_id = data.route_id || '4';
    io.to(`route_${route_id}`).emit('live_telemetry', {
      speed: data.mpu_speed_kmh || (data.gps_speed_knots ? data.gps_speed_knots * 1.852 : 0) || 0,
      heading: data.heading_deg || 0,
      comfort: 'Smooth',
      location: { lat: data.latitude, lng: data.longitude }
    });
  } else if (type === 'attendance') {
    const route_id = data.route_id || '4';
    io.to(`route_${route_id}`).emit('live_attendance', data);
    io.emit('global_attendance', data);
  }
  res.status(200).json({ status: "success", message: "Broadcasted via Express" });
});

server.listen(PORT, () => {
  console.log(\`Express Web App Backend running on port \${PORT}\`);
});
