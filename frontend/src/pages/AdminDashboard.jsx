import { useState, useEffect } from 'react';
import { Bus, Users, MapPin, Shield, LogOut, Settings, Bell, TrendingUp, AlertOctagon, CheckCircle2, MessageSquare, Trash2, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import axios from 'axios';
import '../index.css';

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
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Connect WebSockets
    const socket = io('http://localhost:8000', {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => console.log('Admin connected to socket server'));

    socket.on('sos_alert', (data) => {
      const newAlert = {
        id: Date.now(),
        route: data.route,
        student: data.student,
        time: new Date().toLocaleTimeString()
      };
      setSosAlerts(prev => [newAlert, ...prev]);
      try { new Audio('https://www.soundjay.com/buttons/beep-01a.mp3').play(); } catch (e) {}
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

    return () => socket.disconnect();
  }, []);

  // Fetch data based on active tab
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'users') {
          const res = await axios.get('http://localhost:8000/api/users');
          if (res.data.status === 'success') setUsersList(res.data.data);
        } else if (activeTab === 'grievances') {
          const res = await axios.get('http://localhost:8000/api/grievances');
          if (res.data.status === 'success') setGrievances(res.data.data);
        }
      } catch (err) {
        console.error("Error fetching admin data", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    if (activeTab !== 'overview') fetchData();
  }, [activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleResolveGrievance = async (id) => {
    try {
      await axios.put(`http://localhost:8000/api/grievance/${id}/resolve`);
      setGrievances(grievances.map(g => g._id === id ? { ...g, status: 'resolved' } : g));
      alert("Complaint marked as resolved!");
    } catch (err) {
      alert("Failed to resolve complaint");
    }
  };

  const handleDeleteGrievance = async (id) => {
    if(!window.confirm("Are you sure you want to delete this grievance?")) return;
    try {
      await axios.delete(`http://localhost:8000/api/grievance/${id}`);
      setGrievances(grievances.filter(g => g._id !== id));
    } catch (err) {
      alert("Failed to delete complaint");
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
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e0e0e0' }}>
          {[
            { id: 'overview', icon: <MapPin size={18} />, label: 'Fleet Overview' },
            { id: 'users', icon: <Users size={18} />, label: 'Student Directory' },
            { id: 'grievances', icon: <MessageSquare size={18} />, label: 'Grievance Portal' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
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
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#a8071a' }}>Route {sosAlerts[0].route} • Initiated by {sosAlerts[0].student} • {sosAlerts[0].time}</p>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ backgroundColor: '#e6f0fa', padding: '1rem', borderRadius: '12px', color: 'var(--primary-blue)' }}><Bus size={28} /></div>
                <div><p style={{ color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: '500' }}>Active Routes</p><h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-dark)' }}>4 / 4</h3></div>
              </div>
              <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ backgroundColor: '#fff0e6', padding: '1rem', borderRadius: '12px', color: 'var(--secondary-orange)' }}><Users size={28} /></div>
                <div><p style={{ color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: '500' }}>Live Attendance Count</p><h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-dark)' }}>{liveAttendance.length}</h3></div>
              </div>
              <div className="glass" style={{ padding: '1.5rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ backgroundColor: '#e6fae6', padding: '1rem', borderRadius: '12px', color: '#28a745' }}><AlertOctagon size={28} /></div>
                <div><p style={{ color: 'var(--text-light)', fontSize: '0.9rem', fontWeight: '500' }}>Pending Complaints</p><h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-dark)' }}>2</h3></div>
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

        {/* ----------------- TAB: USERS ----------------- */}
        {activeTab === 'users' && (
          <div className="animate-fade-in glass" style={{ padding: '2rem', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)' }}>Student Directory</h2>
              <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--primary-blue)', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                <UserPlus size={18} /> Add User
              </button>
            </div>
            
            {isLoading ? <p>Loading users...</p> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                    <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Name</th>
                    <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Login ID</th>
                    <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Role</th>
                    <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Route</th>
                    <th style={{ padding: '1rem', borderBottom: '2px solid #e0e0e0' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map((u, i) => (
                    <tr key={u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{u.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-light)' }}>{u.login_id}</td>
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
                        <button style={{ border: 'none', background: 'none', color: 'var(--primary-blue)', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

      </main>
    </div>
  );
};

export default AdminDashboard;
