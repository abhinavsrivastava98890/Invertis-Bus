const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Cloudinary Configuration ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'bus_saarthi_media',
    resource_type: 'auto'
  }
});

const upload = multer({ storage: storage });


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

// --- Web Push Configuration ---
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@invertisbus.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

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
  phone: String,
  profile_pic: String,
  location: {
    lat: Number,
    lng: Number
  },
  wake_alarm_enabled: { type: Boolean, default: false }
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
  media_url: String,
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

const PushSubscriptionSchema = new mongoose.Schema({
  login_id: { type: String, required: true },
  subscription: { type: Object, required: true },
  device_type: String
});
const PushSubscription = mongoose.model('PushSubscription', PushSubscriptionSchema);

const Attendance = mongoose.model('Attendance', new mongoose.Schema({}, { strict: false }), 'attendance');

const TelemetrySchema = new mongoose.Schema({
  route_id: { type: String, default: '4' },
  latitude: Number,
  longitude: Number,
  gps_speed_knots: Number,
  mpu_speed_kmh: Number,
  heading_deg: Number,
  timestamp: { type: Date, default: Date.now }
});
const Telemetry = mongoose.model('Telemetry', TelemetrySchema);

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

const sendPushNotification = async (loginIdOrRole, payload) => {
  try {
    let users = [];
    if (loginIdOrRole === 'admin') {
      users = await User.find({ role: 'admin' });
    } else {
      users = [{ login_id: loginIdOrRole }];
    }
    
    const loginIds = users.map(u => u.login_id);
    const subscriptions = await PushSubscription.find({ login_id: { $in: loginIds } });
    
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.findByIdAndDelete(sub._id);
        } else {
          console.error("Push Error:", err);
        }
      }
    }
  } catch (err) {
    console.error("sendPushNotification Error:", err);
  }
};

// --- Haversine Distance (meters) ---
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// --- Check wake alarms for students on a route ---
const checkWakeAlarms = async (route_id, busLat, busLng) => {
  try {
    if (!busLat || !busLng) return;
    const students = await User.find({
      role: 'student',
      route_id: String(route_id),
      wake_alarm_enabled: true,
      'location.lat': { $exists: true },
      'location.lng': { $exists: true }
    });
    for (const student of students) {
      const dist = haversineDistance(busLat, busLng, student.location.lat, student.location.lng);
      if (dist <= 2000) { // 2 km
        await sendPushNotification(student.login_id, {
          title: '⏰ Wake Up! Bus is Near',
          body: `Your bus on Route ${route_id} is ${Math.round(dist / 100) / 10} km away. Get ready!`,
          url: '/'
        });
        // Disable after firing so it doesn't spam
        await User.findOneAndUpdate({ login_id: student.login_id }, { wake_alarm_enabled: false });
      }
    }
  } catch (err) {
    console.error('Wake alarm check error:', err);
  }
};

// --- REST APIs ---

app.post('/api/upload', authenticateUser, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: "No file uploaded" });
    }
    res.json({ status: "success", url: req.file.path });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/upload/profile_pic', authenticateUser, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: "No file uploaded" });
    }
    // Update user profile pic in db
    await User.findOneAndUpdate({ login_id: req.user.login_id }, { profile_pic: req.file.path });
    res.json({ status: "success", url: req.file.path });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

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

app.put('/api/users/location', authenticateUser, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await User.findOneAndUpdate(
      { login_id: req.user.login_id }, 
      { location: { lat, lng } }
    );
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/users/wake_alarm', authenticateUser, async (req, res) => {
  try {
    const { enabled } = req.body;
    await User.findOneAndUpdate(
      { login_id: req.user.login_id },
      { wake_alarm_enabled: enabled }
    );
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

function handleFailedLogin(ip) {
  const record = loginAttempts.get(ip) || { count: 0, blockUntil: null };
  record.count += 1;
  if (record.count >= 10 && !record.blockUntil) {
    record.blockUntil = Date.now() + 15 * 60 * 1000;
  }
  loginAttempts.set(ip, record);
}

app.post('/api/login', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const record = loginAttempts.get(ip) || { count: 0, blockUntil: null };
  
  if (record.blockUntil) {
    const timeLeftMs = record.blockUntil - Date.now();
    if (timeLeftMs > 0) {
      return res.status(429).json({ 
        detail: "Too many login attempts. Please wait.", 
        blockedUntil: record.blockUntil 
      });
    } else {
      loginAttempts.delete(ip);
    }
  }

  const { login_id, password, role } = req.body;
  if (!login_id || !password) {
    handleFailedLogin(ip);
    return res.status(400).json({ detail: "Missing credentials" });
  }

  try {
    const user = await User.findOne({ login_id: String(login_id) }).select('+password');
    if (!user) {
      handleFailedLogin(ip);
      return res.status(401).json({ detail: "Invalid Credentials" });
    }
    
    let validPassword = false;
    if (user.password && user.password.startsWith('$2b$')) {
      validPassword = await bcrypt.compare(String(password), user.password);
    } else {
      validPassword = (user.password === password);
    }
    
    if (!validPassword) {
      handleFailedLogin(ip);
      return res.status(401).json({ detail: "Invalid Credentials" });
    }
    
    if (role && user.role !== role) {
      handleFailedLogin(ip);
      return res.status(401).json({ detail: `Access denied. Please login via the ${user.role} portal.` });
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

app.get('/api/admin/grievances', async (req, res) => {
  try {
    const complaints = await Grievance.find().sort({ created_at: -1 });
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
    const updatedGrievance = await Grievance.findByIdAndUpdate(req.params.id, { status: 'resolved' }, { new: true });
    
    if (updatedGrievance) {
      await sendPushNotification(updatedGrievance.login_id, {
        title: '✅ Grievance Resolved',
        body: `Your grievance regarding route ${updatedGrievance.route} has been marked as resolved.`,
        url: '/profile'
      });
    }

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
    
    await sendPushNotification('admin', {
      title: '🚨 SOS ALERT',
      body: `Student ${payload.student || req.user.name} triggered an SOS on route ${payload.route}`,
      url: '/admin-dashboard'
    });
    
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

app.post('/api/push/subscribe', authenticateUser, async (req, res) => {
  try {
    const { subscription, device_type } = req.body;
    
    const existing = await PushSubscription.findOne({ 'subscription.endpoint': subscription.endpoint });
    if (!existing) {
      const newSub = new PushSubscription({
        login_id: req.user.login_id,
        subscription,
        device_type: device_type || 'web'
      });
      await newSub.save();
    }
    res.json({ status: "success" });
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
      data: { filled: count, total: 50, status: count > 45 ? 'High' : (count > 30 ? 'Moderate' : 'Low') }
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/internal/telemetry', verifyWebhook, async (req, res) => {
  const data = req.body;
  const route_id = data.route_id || '4'; 
  
  const telemetryDoc = new Telemetry({
    route_id,
    latitude: data.latitude,
    longitude: data.longitude,
    gps_speed_knots: data.gps_speed_knots,
    mpu_speed_kmh: data.mpu_speed_kmh,
    heading_deg: data.heading_deg,
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
  });
  await telemetryDoc.save().catch(err => console.error("Failed to save telemetry", err));

  let comfortStatus = 'Smooth';
  if (data.accel_x !== undefined && data.accel_y !== undefined && data.accel_z !== undefined) {
    const totalG = Math.sqrt(data.accel_x ** 2 + data.accel_y ** 2 + data.accel_z ** 2);
    if (totalG > 1.3 || totalG < 0.7) comfortStatus = 'Rough';
    else if (totalG > 1.1 || totalG < 0.9) comfortStatus = 'Bumpy';
  }

  io.to(`route_${route_id}`).emit('live_telemetry', {
    speed: data.mpu_speed_kmh || data.gps_speed_knots * 1.852 || 0,
    heading: data.heading_deg || 0,
    comfort: comfortStatus,
    location: { lat: data.latitude, lng: data.longitude }
  });

  // Check wake alarms for students near the bus
  checkWakeAlarms(route_id, data.latitude, data.longitude);
  
  res.status(200).json({ status: "forwarded" });
});

app.post('/api/internal/webhook', verifyWebhook, async (req, res) => {
  const { type, data } = req.body;
  if (type === 'sensor') {
    const route_id = data.route_id || '4';
    
    // Save to Mongo
    const telemetryDoc = new Telemetry({
      route_id,
      latitude: data.latitude,
      longitude: data.longitude,
      gps_speed_knots: data.gps_speed_knots,
      mpu_speed_kmh: data.mpu_speed_kmh,
      heading_deg: data.heading_deg,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
    });
    await telemetryDoc.save().catch(err => console.error("Failed to save telemetry to mongo", err));

    let comfortStatus = 'Smooth';
    if (data.accel_x !== undefined && data.accel_y !== undefined && data.accel_z !== undefined) {
      const totalG = Math.sqrt(data.accel_x ** 2 + data.accel_y ** 2 + data.accel_z ** 2);
      if (totalG > 1.3 || totalG < 0.7) comfortStatus = 'Rough';
      else if (totalG > 1.1 || totalG < 0.9) comfortStatus = 'Bumpy';
    }

    io.to(`route_${route_id}`).emit('live_telemetry', {
      speed: data.mpu_speed_kmh || (data.gps_speed_knots ? data.gps_speed_knots * 1.852 : 0) || 0,
      heading: data.heading_deg || 0,
      comfort: comfortStatus,
      location: { lat: data.latitude, lng: data.longitude }
    });

    // Check wake alarms for students near the bus
    checkWakeAlarms(route_id, data.latitude, data.longitude);
  } else if (type === 'attendance') {
    const route_id = data.route_id || '4';
    
    // Save to Mongo
    const attendanceDoc = new Attendance({
      ...data,
      route_id,
      timestamp: data.timestamp || data.check_in_time ? new Date(data.timestamp || data.check_in_time) : new Date()
    });
    await attendanceDoc.save().catch(err => console.error("Failed to save attendance to mongo", err));

    io.to(`route_${route_id}`).emit('live_attendance', data);
    io.emit('global_attendance', data);
  }
  res.status(200).json({ status: "success", message: "Broadcasted via Express" });
});

server.listen(PORT, () => {
  console.log(`Express Web App Backend running on port ${PORT}`);
});
