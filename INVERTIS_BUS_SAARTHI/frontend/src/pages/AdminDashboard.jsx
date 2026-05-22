import { useState, useEffect } from 'react';
import { Bus, Users, MapPin, Shield, LogOut, Settings, Bell, TrendingUp, AlertOctagon, CheckCircle2, MessageSquare, Trash2, UserPlus, Navigation, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import '../index.css';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Bus Icon
const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [35, 35],
  iconAnchor: [17, 17],
});

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  // State for Navigation
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, grievances

  // State for Data
  const [sosAlerts, setSosAlerts] = useState([]);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Attendance Filters
  const [attFilterCity, setAttFilterCity] = useState('All');
  const [attFilterRoute, setAttFilterRoute] = useState('All');
  const [attFilterDate, setAttFilterDate] = useState(new Date().toISOString().split('T')[0]);

  // User Management Modal State
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ name: '', login_id: '', password: '', role: 'student', route_id: '1', fee_status: 'paid', phone: '' });
  const [userFilter, setUserFilter] = useState('student');

  // Specific Route Complaints Modal
  const [showRouteComplaintsModal, setShowRouteComplaintsModal] = useState(false);

  // Route Management State
  const [routesList, setRoutesList] = useState([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeFormData, setRouteFormData] = useState({ route_id: '', route_name: '', bus_number: '', driver_id: '', stops: '', city: 'Bareilly' });

  // Fleet Tracking State
  const [selectedRoute, setSelectedRoute] = useState('1');
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);
  const [socketInstance, setSocketInstance] = useState(null);

  // Global Broadcast State
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    // Connect WebSockets
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => console.log('Admin connected to socket server'));

    socket.on('sos_alert', (data) => {
      const newAlert = {
        id: Date.now(),
        route: data.route,
        student: data.student,
        login_id: data.login_id,
        time: new Date().toLocaleTimeString()
      };
      setSosAlerts(prev => [newAlert, ...prev]);
      try { new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg').play(); } catch (e) { }
    });

    socket.on('sos_cancelled', (data) => {
      setSosAlerts(prev => prev.filter(alert => alert.login_id !== data.login_id));
    });

    socket.on('live_attendance', (data) => {
      const newRecord = {
        name: data.student_name || 'Unknown Student',
        route: data.route_id || 'Unknown',
        status: 'Boarded',
        time: new Date().toLocaleTimeString()
      };
      setLiveAttendance(prev => [newRecord, ...prev].slice(0, 10)); // Keep last 10
    });

    socket.on('global_attendance', (data) => {
      setAttendanceLogs(prev => [data, ...prev]);
    });

    socket.on('live_telemetry', (data) => {
      if (data.location && data.location.lat && data.location.lng) {
        setBusLocation([data.location.lat, data.location.lng]);
      }
    });

    setSocketInstance(socket);

    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (socketInstance) {
      socketInstance.emit('join_route', { route_id: selectedRoute });
    }
  }, [selectedRoute, socketInstance]);

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch routes globally for dropdowns
        const rRes = await axios.get(`${BACKEND_URL}/api/routes`);
        if (rRes.data.status === 'success') {
          setRoutesList(rRes.data.data);
          if (rRes.data.data.length > 0 && selectedRoute === '1') {
            setSelectedRoute(rRes.data.data[0].route_id);
          }
        }

        // Fetch grievances for stats regardless of tab
        const gRes = await axios.get(`${BACKEND_URL}/api/grievances`);
        if (gRes.data.status === 'success') setGrievances(gRes.data.data);

        // Fetch attendance logs
        const attRes = await axios.get(`${BACKEND_URL}/api/attendance`);
        if (attRes.data.status === 'success') setAttendanceLogs(attRes.data.data);

        // Fetch users globally for driver lookups and user management
        const res = await axios.get(`${BACKEND_URL}/api/users`);
        if (res.data.status === 'success') setUsersList(res.data.data);
      } catch (err) {
        console.error("Error fetching admin data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleResolveGrievance = async (id) => {
    try {
      await axios.put(`${BACKEND_URL}/api/grievance/${id}/resolve`);
      setGrievances(grievances.map(g => g._id === id ? { ...g, status: 'resolved' } : g));
      alert("Complaint marked as resolved!");
    } catch (err) {
      alert("Failed to resolve complaint");
    }
  };

  const handleDeleteGrievance = async (id) => {
    if (!window.confirm("Are you sure you want to delete this grievance?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/grievance/${id}`);
      setGrievances(grievances.filter(g => g._id !== id));
    } catch (err) {
      alert("Failed to delete complaint");
    }
  };

  const handleDeleteUser = async (login_id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/users/${login_id}`);
      setUsersList(usersList.filter(u => u.login_id !== login_id));
      alert("User deleted successfully!");
    } catch (err) {
      alert("Failed to delete user");
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = { ...userFormData };
        if (!payload.password) delete payload.password;
        await axios.put(`${BACKEND_URL}/api/users/${editingUser.login_id}`, payload);
        alert("User updated successfully!");
      } else {
        await axios.post(`${BACKEND_URL}/api/users`, userFormData);
        alert("User created successfully!");
      }
      setShowUserModal(false);
      const res = await axios.get(`${BACKEND_URL}/api/users`);
      if (res.data.status === 'success') setUsersList(res.data.data);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to save user");
    }
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserFormData({ name: '', login_id: '', password: '', role: 'student', route_id: routesList[0]?.route_id || '1', fee_status: 'paid', phone: '' });
    setShowUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserFormData({ name: u.name, login_id: u.login_id, password: '', role: u.role, route_id: u.route_id || '', fee_status: u.fee_status || 'paid', phone: u.phone || '' });
    setShowUserModal(true);
  };

  const handleDeleteRoute = async (route_id) => {
    if (!window.confirm("Delete this route permanently?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/routes/${route_id}`);
      setRoutesList(routesList.filter(r => r.route_id !== route_id));
    } catch (err) {
      alert("Failed to delete route");
    }
  };

  const handleSaveRoute = async (e) => {
    e.preventDefault();
    try {
      if (editingRoute) {
        await axios.put(`${BACKEND_URL}/api/routes/${editingRoute.route_id}`, routeFormData);
      } else {
        await axios.post(`${BACKEND_URL}/api/routes`, routeFormData);
      }
      setShowRouteModal(false);
      const res = await axios.get(`${BACKEND_URL}/api/routes`);
      if (res.data.status === 'success') setRoutesList(res.data.data);
    } catch (err) {
      alert(err.response?.data?.detail || err.message || "Failed to save route");
    }
  };

  const openAddRoute = () => {
    setEditingRoute(null);
    setRouteFormData({ route_id: '', route_name: '', bus_number: '', driver_id: '', stops: '', city: 'Bareilly' });
    setShowRouteModal(true);
  };

  const openEditRoute = (r) => {
    setEditingRoute(r);
    setRouteFormData({ ...r });
    setShowRouteModal(true);
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setIsBroadcasting(true);
    try {
      await axios.post(`${BACKEND_URL}/api/broadcast`, {
        title: 'Admin Notice',
        message: broadcastMessage,
        sender: user?.name || 'Admin'
      });
      alert('Global Broadcast sent successfully to all students!');
      setBroadcastMessage('');
    } catch (err) {
      alert('Failed to send broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', backgroundColor: 'var(--white)', boxShadow: 'var(--shadow)', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--secondary-orange)', padding: '0.5rem', borderRadius: '10px' }}>
            <Shield size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', lineHeight: 1.2 }}>
              Admin <span style={{ color: 'var(--secondary-orange)' }}>Dashboard</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500' }}>Welcome, {user?.name}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', position: 'relative' }}>
            <Bell size={24} />
            {sosAlerts.length > 0 && (
              <span style={{
                position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px',
                backgroundColor: 'red', borderRadius: '50%', border: '2px solid white', animation: 'pulse 1.5s infinite'
              }}></span>
            )}
          </button>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff1f0', border: 'none', color: '#cf1322', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ padding: '0 2rem', marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e0e0e0', overflowX: 'auto' }}>
          {[
            { id: 'overview', icon: <MapPin size={18} />, label: 'Fleet Overview' },
            { id: 'routes', icon: <Navigation size={18} />, label: 'Route Management' },
            { id: 'users', icon: <Users size={18} />, label: 'User Directory' },
            { id: 'grievances', icon: <MessageSquare size={18} />, label: 'Grievance Portal' },
            { id: 'attendance', icon: <CheckCircle2 size={18} />, label: 'Daily Attendance' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap',
                padding: '0.75rem 1.5rem', background: 'none',
                border: 'none', borderBottom: activeTab === tab.id ? '3px solid var(--primary-blue)' : '3px solid transparent',
                color: activeTab === tab.id ? 'var(--primary-blue)' : 'var(--text-light)',
                fontWeight: activeTab === tab.id ? 'bold' : '600',
                cursor: 'pointer', transition: 'all 0.2s', marginBottom: '-2px'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>

        {/* SOS Alerts View (Global) */}
        {sosAlerts.length > 0 && (
          <div className="animate-slide-up" style={{
            backgroundColor: '#fff1f0', border: '2px solid #cf1322', padding: '1rem 1.5rem',
            borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '2rem', boxShadow: '0 4px 12px rgba(207, 19, 34, 0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <AlertOctagon size={28} color="#cf1322" className="animate-pulse" />
              <div>
                <h3 style={{ color: '#cf1322', fontWeight: 'bold', margin: 0 }}>ACTIVE SOS ALERT</h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#a8071a', fontWeight: '600' }}>
                  Bus {routesList.find(r => String(r.route_id) === String(sosAlerts[0].route))?.bus_number || 'Unknown'} (Route {sosAlerts[0].route}) • Driver: {usersList.find(u => u.login_id === routesList.find(r => String(r.route_id) === String(sosAlerts[0].route))?.driver_id)?.name || 'Unknown'}
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#a8071a' }}>
                  Initiated by {sosAlerts[0].student} (ID: {sosAlerts[0].login_id}) • {sosAlerts[0].time}
                </p>
              </div>
            </div>
            <button onClick={() => setSosAlerts([])} style={{ background: '#cf1322', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Dismiss
            </button>
          </div>
        )}

        {/* ----------------- TAB: OVERVIEW ----------------- */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', margin: 0 }}>Live Fleet Tracking</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-light)' }}>Select Bus: </span>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '2px solid var(--primary-blue)', fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}
                >
                  {routesList.map(r => (
                    <option key={r.route_id} value={r.route_id}>{r.route_name} ({r.bus_number})</option>
                  ))}
                  {routesList.length === 0 && <option value="1">No Routes Found</option>}
                </select>
              </div>
            </div>

            {/* Global Broadcast Panel */}
            <div className="glass animate-slide-up" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', backgroundColor: '#e6fae6', border: '2px solid #28a745' }}>
              <div style={{ backgroundColor: '#28a745', padding: '1rem', borderRadius: '50%', color: 'white' }}>
                <Bell size={32} />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#155724', fontWeight: 'bold' }}>Global Broadcast (Notice Board)</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#155724' }}>Send an instant push notification to all student apps.</p>
              </div>
              <form onSubmit={handleSendBroadcast} style={{ flex: '2 1 300px', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                <input
                  type="text"
                  required
                  placeholder="E.g. Bus Route 4 will be delayed by 15 mins today..."
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  style={{ flex: 1, minWidth: '200px', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #28a745', fontSize: '1rem' }}
                />
                <button type="submit" disabled={isBroadcasting} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: isBroadcasting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                  {isBroadcasting ? 'Sending...' : 'Broadcast Now'}
                </button>
              </form>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'stretch' }}>

              {/* Left side: Map */}
              <div className="glass" style={{ flex: '2 1 400px', borderRadius: '20px', overflow: 'hidden', minHeight: '400px', border: '2px solid var(--primary-blue)', position: 'relative', zIndex: 1 }}>
                <MapContainer center={busLocation} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <Marker position={busLocation} icon={busIcon}>
                    <Popup><b>Bus Route {selectedRoute}</b><br />Live Location</Popup>
                  </Marker>
                </MapContainer>
              </div>

              {/* Right side: Stats for selected bus */}
              <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <div style={{ backgroundColor: '#e6f0fa', padding: '1rem', borderRadius: '12px', color: 'var(--primary-blue)' }}><Users size={28} /></div>
                  <div>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '500', margin: 0 }}>Students Boarded (Route {selectedRoute})</p>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-dark)', margin: 0 }}>
                      {liveAttendance.filter(a => String(a.route) === String(selectedRoute)).length}
                    </h3>
                  </div>
                </div>

                <div
                  className="glass"
                  onClick={() => setShowRouteComplaintsModal(true)}
                  style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ backgroundColor: '#fff0e6', padding: '1rem', borderRadius: '12px', color: 'var(--secondary-orange)' }}><AlertOctagon size={28} /></div>
                  <div>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '500', margin: 0 }}>Pending Complaints</p>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-dark)', margin: 0 }}>
                      {grievances.filter(g => String(g.route) === String(selectedRoute) && g.status === 'pending').length}
                    </h3>
                  </div>
                </div>

                <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  <div style={{ backgroundColor: '#e6fae6', padding: '1rem', borderRadius: '12px', color: '#28a745' }}><CheckCircle2 size={28} /></div>
                  <div>
                    <p style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '500', margin: 0 }}>Route Status</p>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#28a745', margin: 0 }}>Active & Running</h3>
                  </div>
                </div>
              </div>

            </div>

            <div className="glass" style={{ padding: '2rem', borderRadius: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '1.5rem' }}>Live Boarding Feed</h2>
              {liveAttendance.length === 0 ? (
                <p style={{ color: 'var(--text-light)' }}>Waiting for students to board...</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {liveAttendance.map((student, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: 'var(--primary-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                          {student.name.charAt(0)}
                        </div>
                        <div><p style={{ fontWeight: '600', fontSize: '0.95rem', margin: 0 }}>{student.name}</p><p style={{ fontSize: '0.75rem', color: 'var(--text-light)', margin: 0 }}>Route {student.route} • {student.time}</p></div>
                      </div>
                      <CheckCircle2 color="#28a745" size={20} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------- TAB: ROUTES ----------------- */}
        {activeTab === 'routes' && (
          <div className="animate-fade-in glass" style={{ padding: '2rem', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)' }}>Fleet & Route Management</h2>
              <button onClick={openAddRoute} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--primary-blue)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                <Plus size={18} /> Add New Route
              </button>
            </div>

            {isLoading ? <p>Loading routes...</p> : routesList.length === 0 ? <p>No routes configured yet. Add your first bus route!</p> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {routesList.map((r, i) => {
                  const driverName = usersList.find(u => u.login_id === r.driver_id)?.name || 'Unassigned';
                  return (
                    <div key={i} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', backgroundColor: 'var(--secondary-orange)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>Route {r.route_id}</span>
                          <h3 style={{ margin: '0.5rem 0 0 0', fontSize: '1.1rem', color: 'var(--text-dark)' }}>{r.route_name}</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => openEditRoute(r)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Edit</button>
                          <button onClick={() => handleDeleteRoute(r.route_id)} style={{ background: 'none', border: 'none', color: '#cf1322', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>Delete</button>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-light)' }}>Bus Number:</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-dark)' }}>{r.bus_number}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                          <span style={{ color: 'var(--text-light)' }}>Assigned Driver:</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary-blue)' }}>{driverName}</span>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '600' }}>Waypoints:</span>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-dark)', lineHeight: 1.5 }}>
                          {r.stops || 'No stops defined'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB: USERS ----------------- */}
        {activeTab === 'users' && (
          <div className="animate-fade-in glass" style={{ padding: '2rem', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)' }}>User Directory</h2>
              <button onClick={openAddUser} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--primary-blue)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                <UserPlus size={18} /> Add User
              </button>
            </div>

            {/* Sub-Tabs for filtering Students, Drivers, and Admins */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button onClick={() => setUserFilter('student')} style={{ padding: '0.5rem 1.5rem', backgroundColor: userFilter === 'student' ? 'var(--primary-blue)' : '#f0f0f0', color: userFilter === 'student' ? 'white' : 'var(--text-dark)', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s' }}>
                Students
              </button>
              <button onClick={() => setUserFilter('driver')} style={{ padding: '0.5rem 1.5rem', backgroundColor: userFilter === 'driver' ? 'var(--primary-blue)' : '#f0f0f0', color: userFilter === 'driver' ? 'white' : 'var(--text-dark)', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s' }}>
                Drivers
              </button>
              <button onClick={() => setUserFilter('admin')} style={{ padding: '0.5rem 1.5rem', backgroundColor: userFilter === 'admin' ? 'var(--primary-blue)' : '#f0f0f0', color: userFilter === 'admin' ? 'white' : 'var(--text-dark)', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s' }}>
                Admins
              </button>
            </div>

            {isLoading ? <p>Loading users...</p> : (
              <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                      <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Name</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Login ID</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Role</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Route</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>{userFilter === 'student' ? 'Fee Status' : 'Phone'}</th>
                      <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersList.filter(u => u.role === userFilter).map((u, i) => (
                      <tr key={u._id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '1rem', fontWeight: '600', whiteSpace: 'nowrap' }}>{u.name}</td>
                        <td style={{ padding: '1rem', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{u.login_id}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            backgroundColor: u.role === 'admin' ? '#fff0e6' : u.role === 'driver' ? '#e6fae6' : '#e6f0fa',
                            color: u.role === 'admin' ? 'var(--secondary-orange)' : u.role === 'driver' ? '#28a745' : 'var(--primary-blue)',
                            padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'capitalize'
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: '1rem' }}>{u.route_id || 'N/A'}</td>
                        <td style={{ padding: '1rem' }}>
                          {u.role === 'student' ? (
                            <span style={{ color: u.fee_status === 'paid' ? '#28a745' : '#cf1322', fontWeight: 'bold', textTransform: 'capitalize' }}>
                              {u.fee_status || 'Pending'}
                            </span>
                          ) : (
                            <span style={{ whiteSpace: 'nowrap' }}>{u.phone || '-'}</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => openEditUser(u)} style={{ border: 'none', background: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                          <button onClick={() => handleDeleteUser(u.login_id)} style={{ border: 'none', background: 'none', color: '#cf1322', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB: GRIEVANCES ----------------- */}
        {activeTab === 'grievances' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', marginBottom: '0.5rem' }}>Grievance God Mode</h2>
            <p style={{ color: 'var(--text-light)', marginTop: '-1rem', marginBottom: '1rem' }}>You can see real names of anonymous posters.</p>

            {isLoading ? <p>Loading complaints...</p> : grievances.length === 0 ? <p>No complaints yet!</p> : grievances.map((comp) => (
              <div key={comp._id} className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: comp.status === 'resolved' ? '4px solid #28a745' : '4px solid var(--secondary-orange)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-dark)' }}>
                      <span style={{ color: 'var(--primary-blue)' }}>{comp.realName}</span> <span style={{ color: 'var(--text-light)', fontSize: '0.8rem', fontWeight: 'normal' }}>(ID: {comp.login_id})</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{comp.route} • {comp.time}</p>
                  </div>
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px',
                    backgroundColor: comp.status === 'resolved' ? '#e6fae6' : '#fff1f0',
                    color: comp.status === 'resolved' ? '#28a745' : '#cf1322'
                  }}>
                    {comp.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-dark)' }}>{comp.text}</p>

                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #f0f0f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  {comp.status === 'pending' && (
                    <button onClick={() => handleResolveGrievance(comp._id)} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={16} /> Mark Resolved
                    </button>
                  )}
                  <button onClick={() => handleDeleteGrievance(comp._id)} style={{ backgroundColor: '#fff1f0', color: '#cf1322', border: '1px solid #cf1322', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Trash2 size={16} /> Delete Post
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----------------- TAB: ATTENDANCE ----------------- */}
        {activeTab === 'attendance' && (() => {
          const uniqueCities = [...new Set(routesList.map(r => r.city || 'Bareilly'))];
          const filteredAttendanceLogs = attendanceLogs.filter(log => {
            // Check Date
            const logDate = new Date(log.timestamp || log.synced_at || log.created_at || Date.now()).toISOString().split('T')[0];
            if (attFilterDate && logDate !== attFilterDate) return false;

            // Check Route
            if (attFilterRoute !== 'All' && String(log.route_id) !== String(attFilterRoute)) return false;

            // Check City
            if (attFilterCity !== 'All') {
              const routeInfo = routesList.find(r => String(r.route_id) === String(log.route_id));
              const logCity = routeInfo?.city || 'Bareilly';
              if (logCity !== attFilterCity) return false;
            }

            return true;
          });

          return (
            <div className="animate-fade-in glass" style={{ padding: '2rem', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)' }}>Daily Attendance Logs</h2>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', marginBottom: '0.25rem' }}>City</label>
                    <select value={attFilterCity} onChange={e => { setAttFilterCity(e.target.value); setAttFilterRoute('All'); }} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }}>
                      <option value="All">All Cities</option>
                      {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Route</label>
                    <select value={attFilterRoute} onChange={e => setAttFilterRoute(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }}>
                      <option value="All">All Routes</option>
                      {routesList.filter(r => attFilterCity === 'All' || (r.city || 'Bareilly') === attFilterCity).map(r => (
                        <option key={r.route_id} value={r.route_id}>Route {r.route_id} ({r.route_name})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-light)', marginBottom: '0.25rem' }}>Date</label>
                    <input type="date" value={attFilterDate} onChange={e => setAttFilterDate(e.target.value)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc', outline: 'none' }} />
                  </div>
                </div>
              </div>

              {isLoading ? <p>Loading attendance logs...</p> : (
                <div style={{ overflowX: 'auto', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Student ID / Name</th>
                        <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Route ID</th>
                        <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Time</th>
                        <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendanceLogs.length === 0 ? (
                        <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-light)' }}>No attendance logs found.</td></tr>
                      ) : filteredAttendanceLogs.map((log, i) => (
                        <tr key={log._id || i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '1rem', fontWeight: '600' }}>{log.student_name || log.login_id || 'Unknown'}</td>
                          <td style={{ padding: '1rem' }}>{log.route_id || 'N/A'}</td>
                          <td style={{ padding: '1rem', color: 'var(--text-light)' }}>{new Date(log.timestamp || log.synced_at || log.created_at || Date.now()).toLocaleString()}</td>
                          <td style={{ padding: '1rem' }}>
                            <span style={{
                              backgroundColor: '#e6fae6', color: '#28a745',
                              padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold'
                            }}>
                              Hardware (Face/RFID)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })()}

      </main>

      {/* Route Specific Pending Complaints Modal */}
      {showRouteComplaintsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="animate-slide-up glass" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', borderRadius: '20px', backgroundColor: 'white', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff0e6' }}>
              <h2 style={{ margin: 0, color: 'var(--secondary-orange)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
                <AlertOctagon /> Route {selectedRoute} Complaints
              </h2>
              <button onClick={() => setShowRouteComplaintsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} color="var(--text-dark)" /></button>
            </div>

            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {grievances.filter(g => String(g.route) === String(selectedRoute) && g.status === 'pending').length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-light)', marginTop: '2rem' }}>No pending complaints for this route! 🎉</p>
              ) : (
                grievances.filter(g => String(g.route) === String(selectedRoute) && g.status === 'pending').map((comp) => (
                  <div key={comp._id} style={{ border: '1px solid #e0e0e0', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong style={{ color: 'var(--primary-blue)' }}>{comp.realName} (ID: {comp.login_id})</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>{comp.time}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-dark)' }}>{comp.text}</p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <button onClick={() => {
                        handleResolveGrievance(comp._id);
                      }} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                        <CheckCircle2 size={16} /> Mark Resolved
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-up glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '20px', backgroundColor: 'white' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-dark)' }}>{editingUser ? 'Edit User' : 'Add New User'}</h2>
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Full Name</label>
                <input required type="text" value={userFormData.name} onChange={e => setUserFormData({ ...userFormData, name: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Login ID</label>
                <input required disabled={!!editingUser} type="text" value={userFormData.login_id} onChange={e => setUserFormData({ ...userFormData, login_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: editingUser ? '#f0f0f0' : 'white' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Password {editingUser && '(Leave blank to keep current)'}</label>
                <input required={!editingUser} type="text" value={userFormData.password} onChange={e => setUserFormData({ ...userFormData, password: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Role</label>
                  <select value={userFormData.role} onChange={e => setUserFormData({ ...userFormData, role: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}>
                    <option value="student">Student</option>
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Route</label>
                  <select value={userFormData.route_id} onChange={e => setUserFormData({ ...userFormData, route_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white' }}>
                    {routesList.map(r => (
                      <option key={r.route_id} value={r.route_id}>Route {r.route_id} - {r.route_name}</option>
                    ))}
                    {routesList.length === 0 && <option value="">No Routes Found</option>}
                  </select>
                </div>
              </div>
              {userFormData.role === 'student' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Fee Status</label>
                  <select value={userFormData.fee_status} onChange={e => setUserFormData({ ...userFormData, fee_status: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending / Unpaid</option>
                  </select>
                </div>
              )}
              {userFormData.role === 'driver' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Phone Number</label>
                  <input type="tel" placeholder="+91 9876543210" value={userFormData.phone} onChange={e => setUserFormData({ ...userFormData, phone: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary-blue)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>{editingUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Route Modal */}
      {showRouteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-slide-up glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', borderRadius: '20px', backgroundColor: 'white' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-dark)' }}>{editingRoute ? 'Edit Route' : 'Add New Route'}</h2>
            <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Route ID</label>
                  <input required disabled={!!editingRoute} placeholder="e.g. 1" type="text" value={routeFormData.route_id} onChange={e => setRouteFormData({ ...routeFormData, route_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: editingRoute ? '#f0f0f0' : 'white' }} />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Route Name</label>
                  <input required placeholder="e.g. City Station to Campus" type="text" value={routeFormData.route_name} onChange={e => setRouteFormData({ ...routeFormData, route_name: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Bus Number</label>
                  <input required placeholder="e.g. UP 14 AB 1234" type="text" value={routeFormData.bus_number} onChange={e => setRouteFormData({ ...routeFormData, bus_number: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Assign Driver</label>
                  <select value={routeFormData.driver_id} onChange={e => setRouteFormData({ ...routeFormData, driver_id: e.target.value })} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', backgroundColor: 'white' }}>
                    <option value="">Select a Driver</option>
                    {usersList.filter(u => u.role === 'driver').map(d => (
                      <option key={d.login_id} value={d.login_id}>{d.name} ({d.login_id})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Stops / Waypoints (Comma separated)</label>
                <textarea required placeholder="Civil Lines, DD Puram, University" value={routeFormData.stops} onChange={e => setRouteFormData({ ...routeFormData, stops: e.target.value })} rows="3" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowRouteModal(false)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', background: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                <button type="submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: 'var(--primary-blue)', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}>{editingRoute ? 'Update Route' : 'Save Route'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
