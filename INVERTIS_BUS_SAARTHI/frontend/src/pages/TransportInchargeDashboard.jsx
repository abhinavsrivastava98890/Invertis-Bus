import { useState, useEffect, useRef } from 'react';
import { Bus, Users, MapPin, Shield, LogOut, Settings, Bell, TrendingUp, AlertOctagon, CheckCircle2, MessageSquare, Trash2, UserPlus, Navigation, Plus, Car } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LanguageContext';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
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

const busIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
  iconSize: [35, 35],
  iconAnchor: [17, 17],
});

const TransportInchargeDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { t } = useLang();

  const formatTime = (createdAtStr) => {
    if (!createdAtStr) return 'Just now';
    const date = new Date(createdAtStr);
    if (isNaN(date.getTime())) return createdAtStr;
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const [activeTab, setActiveTab] = useState('overview'); // overview, routes, users, grievances
  const [sosAlerts, setSosAlerts] = useState([]);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [grievances, setGrievances] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // User Management
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ name: '', login_id: '', password: '', role: 'driver', phone: '' });

  // Route Management
  const [routesList, setRoutesList] = useState([]);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState(null);
  const [routeFormData, setRouteFormData] = useState({ route_id: '', route_name: '', bus_number: '', driver_id: '', stops: '', city: 'Bareilly' });

  // Fleet Tracking
  const [selectedRoute, setSelectedRoute] = useState('1');
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);
  const [isBusActive, setIsBusActive] = useState(false);
  const telemetryTimeoutRef = useRef(null);
  const [socketInstance, setSocketInstance] = useState(null);

  // Global Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socket.on('connect', () => {
      socket.emit('join_admin');
    });

    socket.on('sos_alert', (data) => {
      const newAlert = { id: Date.now(), route: data.route, student: data.student, login_id: data.login_id, time: new Date().toLocaleTimeString() };
      setSosAlerts(prev => [newAlert, ...prev]);
      try { new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg').play(); } catch (e) { }
    });

    socket.on('sos_cancelled', (data) => {
      setSosAlerts(prev => prev.filter(alert => alert.login_id !== data.login_id));
    });

    socket.on('live_attendance', (data) => {
      let displayName = data.name || data.student_name || 'Unknown Student';
      const newRecord = { name: displayName, route: data.route_id || 'Unknown', time: new Date().toLocaleTimeString() };
      setLiveAttendance(prev => [newRecord, ...prev].slice(0, 10));
    });

    socket.on('live_telemetry', (data) => {
      if (data.location && data.location.lat && data.location.lng) {
        setBusLocation([data.location.lat, data.location.lng]);
        setIsBusActive(true);
        if (telemetryTimeoutRef.current) clearTimeout(telemetryTimeoutRef.current);
        telemetryTimeoutRef.current = setTimeout(() => setIsBusActive(false), 15000);
      }
    });

    setSocketInstance(socket);
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (socketInstance) {
      socketInstance.emit('join_route', { route_id: selectedRoute });
      setIsBusActive(false);
      if (telemetryTimeoutRef.current) clearTimeout(telemetryTimeoutRef.current);
    }
  }, [selectedRoute, socketInstance]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [rRes, gRes, usersRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/routes`),
          axios.get(`${BACKEND_URL}/api/admin/grievances`),
          axios.get(`${BACKEND_URL}/api/users`)
        ]);
        if (rRes.data.status === 'success') {
          setRoutesList(rRes.data.data);
          if (rRes.data.data.length > 0 && selectedRoute === '1') setSelectedRoute(rRes.data.data[0].route_id);
        }
        if (gRes.data.status === 'success') setGrievances(gRes.data.data);
        if (usersRes.data.status === 'success') setUsersList(usersRes.data.data.filter(u => u.role === 'driver')); // Filter only drivers just in case
      } catch (err) {
        console.error("Error fetching data", err);
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
      toast.success("Complaint marked as resolved!");
    } catch (err) {
      toast.error("Failed to resolve complaint");
    }
  };

  const handleDeleteUser = async (login_id) => {
    if (!window.confirm("Are you sure you want to delete this driver?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/users/${login_id}`);
      setUsersList(usersList.filter(u => u.login_id !== login_id));
      toast.success("Driver deleted successfully!");
    } catch (err) {
      toast.error("Failed to delete driver");
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload = { ...userFormData };
        if (!payload.password) delete payload.password;
        await axios.put(`${BACKEND_URL}/api/users/${editingUser.login_id}`, payload);
        toast.success("Driver updated successfully!");
      } else {
        await axios.post(`${BACKEND_URL}/api/users`, userFormData);
        toast.success("Driver created successfully!");
      }
      setShowUserModal(false);
      const res = await axios.get(`${BACKEND_URL}/api/users`);
      if (res.data.status === 'success') setUsersList(res.data.data.filter(u => u.role === 'driver'));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save driver");
    }
  };

  const openAddUser = () => {
    setEditingUser(null);
    setUserFormData({ name: '', login_id: '', password: '', role: 'driver', phone: '' });
    setShowUserModal(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserFormData({ name: u.name, login_id: u.login_id, password: '', role: 'driver', phone: u.phone || '' });
    setShowUserModal(true);
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
      toast.error("Failed to save route");
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

  const handleDeleteRoute = async (route_id) => {
    if (!window.confirm("Delete this route?")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/routes/${route_id}`);
      setRoutesList(routesList.filter(r => r.route_id !== route_id));
    } catch (err) {
      toast.error("Failed to delete route");
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;
    setIsBroadcasting(true);
    try {
      await axios.post(`${BACKEND_URL}/api/broadcast`, {
        title: 'Transport Notice',
        message: broadcastMessage,
        sender: user?.name || 'Transport Incharge'
      });
      toast.success('Broadcast sent!');
      setBroadcastMessage('');
    } catch (err) {
      toast.error('Failed to send broadcast');
    } finally {
      setIsBroadcasting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
      {/* Header */}
      <header className="p-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--white)', boxShadow: 'var(--shadow)', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: '#28a745', padding: '0.5rem', borderRadius: '10px' }}>
            <Car size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', lineHeight: 1.2 }}>Transport <span style={{ color: '#28a745' }}>Incharge</span></h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500' }}>Welcome, {user?.name}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', position: 'relative' }}>
            <Bell size={24} />
            {sosAlerts.length > 0 && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px', backgroundColor: 'red', borderRadius: '50%', border: '2px solid white', animation: 'pulse 1.5s infinite' }}></span>}
          </button>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fff1f0', border: 'none', color: '#cf1322', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-main" style={{ marginTop: '1rem', marginBottom: '0.25rem' }}>
        <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
          {[
            { id: 'overview', icon: <MapPin size={16} />, label: 'Fleet & Tracking', color: '#0066cc', bg: '#e6f0fa' },
            { id: 'routes', icon: <Navigation size={16} />, label: 'Manage Routes', color: '#28a745', bg: '#e6fae6' },
            { id: 'users', icon: <Users size={16} />, label: 'Drivers', color: '#7c3aed', bg: '#f3e8ff' },
            { id: 'grievances', icon: <MessageSquare size={16} />, label: 'Complaints', color: '#cf1322', bg: '#fff1f0' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap', padding: activeTab === tab.id ? '0.55rem 1.1rem' : '0.55rem 1rem', borderRadius: '50px', border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid var(--border-color)', backgroundColor: activeTab === tab.id ? tab.bg : 'var(--white)', color: activeTab === tab.id ? tab.color : 'var(--text-light)', fontWeight: activeTab === tab.id ? '700' : '600', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeTab === tab.id ? `0 2px 10px ${tab.color}33` : 'var(--shadow)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', backgroundColor: activeTab === tab.id ? tab.color : 'var(--bg-color)', color: activeTab === tab.id ? 'white' : 'var(--text-light)' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <main className="p-main" style={{ flex: 1, overflowY: 'auto', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {sosAlerts.length > 0 && (
          <div className="animate-slide-up" style={{ backgroundColor: '#fff1f0', border: '2px solid #cf1322', padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}><AlertOctagon size={28} color="#cf1322" className="animate-pulse" />
              <div>
                <h3 style={{ color: '#cf1322', fontWeight: 'bold', margin: 0 }}>ACTIVE SOS ALERT</h3>
                <p style={{ margin: 0, fontSize: '0.95rem', color: '#a8071a', fontWeight: '600' }}>Route {sosAlerts[0].route}</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#a8071a' }}>Initiated anonymously • {sosAlerts[0].time}</p>
              </div>
            </div>
            <button onClick={() => setSosAlerts([])} style={{ background: '#cf1322', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Dismiss</button>
          </div>
        )}

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', margin: 0 }}>Live Fleet Tracking</h2>
              <select value={selectedRoute} onChange={(e) => setSelectedRoute(e.target.value)} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '2px solid var(--primary-blue)', fontWeight: 'bold' }}>
                {routesList.map(r => <option key={r.route_id} value={r.route_id}>{r.route_name} ({r.bus_number})</option>)}
              </select>
            </div>
            
            <div className="glass animate-slide-up" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', backgroundColor: '#e6fae6', border: '2px solid #28a745' }}>
              <div style={{ backgroundColor: '#28a745', padding: '1rem', borderRadius: '50%', color: 'white' }}><Bell size={32} /></div>
              <div style={{ flex: '1 1 200px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#155724', fontWeight: 'bold' }}>Broadcast Notice</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#155724' }}>Send message to all students.</p>
              </div>
              <form onSubmit={handleSendBroadcast} style={{ flex: '2 1 300px', display: 'flex', gap: '1rem' }}>
                <input type="text" required placeholder="Type message..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #28a745' }} />
                <button type="submit" disabled={isBroadcasting} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Broadcast</button>
              </form>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
              <div className="glass" style={{ flex: '1 1 280px', borderRadius: '20px', overflow: 'hidden', minHeight: '400px', border: '2px solid var(--primary-blue)' }}>
                <MapContainer center={busLocation} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                  <Marker position={busLocation} icon={busIcon}><Popup>Bus Location</Popup></Marker>
                </MapContainer>
              </div>
            </div>
          </div>
        )}

        {/* ROUTES */}
        {activeTab === 'routes' && (
          <div className="animate-fade-in glass p-glass" style={{ borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Manage Routes</h2>
              <button onClick={openAddRoute} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--primary-blue)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}><Plus size={18} /> Add Route</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {routesList.map(r => (
                <div key={r.route_id} style={{ backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{r.route_name} (Route {r.route_id})</h3>
                    <div>
                      <button onClick={() => openEditRoute(r)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDeleteRoute(r.route_id)} style={{ background: 'none', border: 'none', color: '#cf1322', cursor: 'pointer', marginLeft: '0.5rem' }}>Delete</button>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Bus: <b>{r.bus_number}</b> | Driver ID: <b>{r.driver_id}</b></p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-light)' }}>Stops: {r.stops}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS (DRIVERS ONLY) */}
        {activeTab === 'users' && (
          <div className="animate-fade-in glass p-glass" style={{ borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Driver Management</h2>
              <button onClick={openAddUser} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#28a745', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}><UserPlus size={18} /> Add Driver</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-color)', textAlign: 'left' }}>
                  <th style={{ padding: '1rem' }}>Name</th>
                  <th style={{ padding: '1rem' }}>Login ID</th>
                  <th style={{ padding: '1rem' }}>Phone</th>
                  <th style={{ padding: '1rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => (
                  <tr key={u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '1rem', fontWeight: '600' }}>{u.name}</td>
                    <td style={{ padding: '1rem' }}>{u.login_id}</td>
                    <td style={{ padding: '1rem' }}>{u.phone || '-'}</td>
                    <td style={{ padding: '1rem' }}>
                      <button onClick={() => openEditUser(u)} style={{ background: 'none', border: 'none', color: 'var(--primary-blue)', cursor: 'pointer', marginRight: '1rem' }}>Edit</button>
                      <button onClick={() => handleDeleteUser(u.login_id)} style={{ background: 'none', border: 'none', color: '#cf1322', cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* GRIEVANCES (ANONYMOUS) */}
        {activeTab === 'grievances' && (
          <div className="animate-fade-in">
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Student Grievances</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {grievances.map(comp => (
                <div key={comp._id} className="glass" style={{ padding: '1.5rem', borderRadius: '16px', borderLeft: comp.status === 'resolved' ? '4px solid #28a745' : '4px solid #cf1322' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold' }}>Anonymous Student</h3>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Route {comp.route} • {formatTime(comp.created_at || comp.time)}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', padding: '0.25rem 0.5rem', borderRadius: '8px', backgroundColor: comp.status === 'resolved' ? '#e6fae6' : '#fff1f0', color: comp.status === 'resolved' ? '#28a745' : '#cf1322' }}>{comp.status.toUpperCase()}</span>
                  </div>
                  <p style={{ margin: '1rem 0 0 0', fontSize: '1rem' }}>{comp.text}</p>

                  {/* Media Attachment */}
                  {comp.type === 'photo' && comp.media_url && (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center' }}>
                      <img src={comp.media_url} alt="Complaint Attachment" style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '400px', objectFit: 'contain' }} />
                    </div>
                  )}
                  {comp.type === 'video' && comp.media_url && (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', marginTop: '0.5rem', border: '1px solid var(--border-color)', backgroundColor: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <video src={comp.media_url} controls style={{ width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' }} />
                    </div>
                  )}
                  {comp.type === 'audio' && comp.media_url && (
                    <div style={{ marginTop: '0.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '30px', border: '1px solid var(--border-color)' }}>
                      <audio src={comp.media_url} controls style={{ width: '100%' }} />
                    </div>
                  )}

                  {comp.status === 'pending' && (
                    <button onClick={() => handleResolveGrievance(comp._id)} style={{ marginTop: '1rem', backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Mark Resolved</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modals can go here (simplified version: handled with window.prompt in real app, but let's assume we render forms if showRouteModal or showUserModal is true) */}
      {showUserModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0 }}>{editingUser ? 'Edit Driver' : 'Add Driver'}</h3>
            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="Name" required value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <input type="text" placeholder="Login ID" required disabled={!!editingUser} value={userFormData.login_id} onChange={e => setUserFormData({...userFormData, login_id: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <input type="password" placeholder={editingUser ? 'Leave blank to keep same' : 'Password'} required={!editingUser} value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <input type="text" placeholder="Phone" value={userFormData.phone} onChange={e => setUserFormData({...userFormData, phone: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" style={{ flex: 1, backgroundColor: '#28a745', color: 'white', padding: '0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Save</button>
                <button type="button" onClick={() => setShowUserModal(false)} style={{ flex: 1, backgroundColor: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRouteModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '400px' }}>
            <h3 style={{ marginTop: 0 }}>{editingRoute ? 'Edit Route' : 'Add Route'}</h3>
            <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" placeholder="Route ID (e.g. 1)" required disabled={!!editingRoute} value={routeFormData.route_id} onChange={e => setRouteFormData({...routeFormData, route_id: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <input type="text" placeholder="Route Name" required value={routeFormData.route_name} onChange={e => setRouteFormData({...routeFormData, route_name: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <input type="text" placeholder="Bus Number" required value={routeFormData.bus_number} onChange={e => setRouteFormData({...routeFormData, bus_number: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <input type="text" placeholder="Driver Login ID" required value={routeFormData.driver_id} onChange={e => setRouteFormData({...routeFormData, driver_id: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px' }} />
              <textarea placeholder="Stops" value={routeFormData.stops} onChange={e => setRouteFormData({...routeFormData, stops: e.target.value})} style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: '8px', minHeight: '60px' }} />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" style={{ flex: 1, backgroundColor: '#0066cc', color: 'white', padding: '0.5rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Save</button>
                <button type="button" onClick={() => setShowRouteModal(false)} style={{ flex: 1, backgroundColor: '#f0f0f0', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportInchargeDashboard;
