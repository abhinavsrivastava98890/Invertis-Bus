import toast from 'react-hot-toast';
import { useState, useEffect, useRef } from 'react';
import { Bus, Menu, MapPin, Phone, User, Maximize2, X, Compass, Activity, Navigation, Wind, AlertOctagon, CalendarOff, Bell, AlarmClock, Users } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import HamburgerMenu from '../components/HamburgerMenu';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
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

const Home = () => {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [telemetry, setTelemetry] = useState({ speed: 45, heading: 45, comfort: 'Smooth' });
  const [isNotBoarding, setIsNotBoarding] = useState(false);
  const [alarmSet, setAlarmSet] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosTimer, setSosTimer] = useState(null);

  const sosTimeoutRef = useRef(null);
  const sosIntervalRef = useRef(null);

  const [crowdStatus, setCrowdStatus] = useState({ filled: 0, total: 50, status: 'Loading...' });

  // Real Data State
  const [routeInfo, setRouteInfo] = useState(null);
  const [driverInfo, setDriverInfo] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);

  // Global Broadcast State
  const [latestNotice, setLatestNotice] = useState(null);
  const [activeBroadcast, setActiveBroadcast] = useState(null);

  // Initial Bus Location (Example: Near Invertis University, Bareilly)
  const [busLocation, setBusLocation] = useState([28.3180, 79.4670]);

  // Connect to Socket.IO for real-time telemetry updates and fetch initial status
  useEffect(() => {
    // Fetch Crowd Status
    const fetchCrowdStatus = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/route_status/${user?.route_id || '4'}`);
        if (res.data.status === 'success') {
          setCrowdStatus(res.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch crowd status");
      }
    };
    fetchCrowdStatus();

    // Connect to the FastAPI Socket.IO server
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Connected to Live Tracking Server');
      // Join the route room for this user
      socket.emit('join_route', { route_id: user?.route_id || '4' });
    });

    socket.on('live_telemetry', (data) => {
      console.log('Received telemetry:', data);
      setTelemetry({
        speed: data.speed || 45,
        heading: data.heading || 45,
        comfort: data.comfort || 'Smooth'
      });
      if (data.location && data.location.lat && data.location.lng) {
        setBusLocation([data.location.lat, data.location.lng]);
      }
    });

    // Listen for Global Broadcasts
    socket.on('global_broadcast', (data) => {
      setLatestNotice(data);
      const ackId = localStorage.getItem('acknowledged_notice');
      if (ackId !== data._id) {
        setActiveBroadcast(data);
        try {
          // Play notification sound
          new Audio('https://www.soundjay.com/buttons/beep-07.mp3').play();
        } catch (e) { }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  // Fetch Latest Broadcast on Load
  useEffect(() => {
    const fetchLatestBroadcast = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/broadcast`);
        if (res.data.status === 'success' && res.data.data) {
          const data = res.data.data;
          setLatestNotice(data);
          const ackId = localStorage.getItem('acknowledged_notice');
          if (ackId !== data._id) {
            setActiveBroadcast(data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch broadcast", err);
      }
    };
    fetchLatestBroadcast();
  }, []);

  const acknowledgeBroadcast = () => {
    if (activeBroadcast) {
      localStorage.setItem('acknowledged_notice', activeBroadcast._id);
      setActiveBroadcast(null);
    }
  };

  // Fetch Route Information based on user.route_id
  useEffect(() => {
    const fetchRouteInfo = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/routes`);
        if (res.data.status === 'success') {
          const fetchedRoutes = res.data.data || [];
          const myRoute = fetchedRoutes.find(r => String(r.route_id) === String(user?.route_id || '4'));
          if (myRoute) {
            setRouteInfo(myRoute);
            // Fetch users to get driver name
            const usersRes = await axios.get(`${BACKEND_URL}/api/users`);
            if (usersRes.data.status === 'success') {
              const fetchedUsers = usersRes.data.data || [];
              const driver = fetchedUsers.find(u => u.login_id === myRoute.driver_id);
              setDriverInfo(driver || { name: 'Unknown Driver', phone: '+919999999999' });
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch route info", err);
      }
    };
    fetchRouteInfo();
  }, [user]);

  // Handle fake alarm trigger logic for demonstration
  useEffect(() => {
    if (alarmSet && busLocation[0] !== 28.3180) {
      const dist = Math.abs(busLocation[0] - 28.3500);
      if (dist < 0.005) {
        toast("Wake Up! Your bus is arriving soon!");
        setAlarmSet(false);
        try {
          new Audio('https://www.soundjay.com/buttons/beep-07.mp3').play();
        } catch (e) { }
      }
    }
  }, [busLocation, alarmSet]);

  const startSosCountdown = () => {
    setSosTimer(10);
    sosIntervalRef.current = setInterval(() => {
      setSosTimer(prev => {
        if (prev <= 1) {
          clearInterval(sosIntervalRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    sosTimeoutRef.current = setTimeout(async () => {
      try {
        await axios.post(`${BACKEND_URL}/api/sos`, {
          student: user?.name || 'Student User',
          route: user?.route_id || '4',
          login_id: user?.login_id || user?.id || 'Unknown'
        });
        setSosActive(true);
        toast.error("SOS Alert Sent! Admin has been notified.", { duration: 5000 });
      } catch (err) {
        toast.error("Failed to send SOS. Check your connection.");
      }
    }, 10000);
  };

  const handleSosClick = async () => {
    if (sosTimer !== null) {
      clearTimeout(sosTimeoutRef.current);
      clearInterval(sosIntervalRef.current);
      setSosTimer(null);
      return;
    }

    if (sosActive) {
      if (!window.confirm("Do you want to cancel the active SOS alert?")) return;
      try {
        await axios.post(`${BACKEND_URL}/api/sos/cancel`, {
          login_id: user?.login_id || user?.id || 'Unknown',
          route: user?.route_id || '4'
        });
        setSosActive(false);
        toast.success("SOS Alert Cancelled.");
      } catch (err) {
        toast.error("Failed to cancel SOS. Check connection.");
      }
      return;
    }

    startSosCountdown();
  };

  const handleNotBoarding = async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/leave`, {
        login_id: user?.id || 'Unknown',
        route: user?.route_id || '4'
      });

      if (res.data.action === 'marked') {
        setIsNotBoarding(true);
        toast.success("Leave marked! Driver notified.");
      } else {
        setIsNotBoarding(false);
        toast.success("Leave cancelled. Be on time!");
      }
    } catch (err) {
      toast.error("Failed to update leave status.");
    }
  };

  // Mock Route
  const routePolyline = [
    [28.3180, 79.4670],
    [28.3250, 79.4750],
    [28.3320, 79.4800],
    [28.3400, 79.4900],
  ];

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: 'var(--bg-color)', overflow: 'hidden' }}>
      <header className="p-header" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        /* padding: '1rem 2rem', */ backgroundColor: 'var(--white)', boxShadow: 'var(--shadow)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ backgroundColor: 'var(--primary-blue)', padding: '0.5rem', borderRadius: '10px' }}>
            <Bus size={24} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary-blue)', lineHeight: 1.2 }}>
              INVERTIS<span style={{ color: 'var(--secondary-orange)' }}> BUS SAARTHI</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: '500' }}>Welcome, {user?.name || 'Student'}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotifications(!showNotifications)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)' }}>
              <Bell size={24} />
              {(activeBroadcast || sosActive) && (
                <span style={{ position: 'absolute', top: '-4px', right: '-2px', backgroundColor: '#cf1322', width: '10px', height: '10px', borderRadius: '50%' }}></span>
              )}
            </button>
            {showNotifications && (
              <div className="glass animate-slide-up" style={{ position: 'absolute', top: '100%', right: 0, width: '250px', padding: '1rem', borderRadius: '12px', zIndex: 10, marginTop: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>Notifications</h4>
                {latestNotice ? (
                  <div style={{ padding: '0.5rem', backgroundColor: '#e6f0fa', borderRadius: '8px', fontSize: '0.85rem' }}>
                    <strong>{latestNotice.title || 'Admin'}:</strong> {latestNotice.message}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)' }}>No new updates.</p>
                )}
              </div>
            )}
          </div>
          <button onClick={() => setIsMenuOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)' }}>
            <Menu size={28} />
          </button>
        </div>
      </header>

      <main className="p-main" style={{
        flex: 1, /* padding: '1.5rem', */ display: 'flex', flexDirection: 'column', gap: '1.5rem',
        maxWidth: '1200px', margin: '0 auto', width: '100%',
        overflowY: 'auto'
      }}>

        {/* Quick Actions Bar */}
        <div className="animate-slide-up delay-100" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem', flexShrink: 0 }}>
          <button
            onClick={handleSosClick}
            style={{
              flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              backgroundColor: sosTimer !== null ? '#faad14' : (sosActive ? '#fff1f0' : '#cf1322'),
              color: sosTimer !== null ? 'white' : (sosActive ? '#cf1322' : 'white'),
              padding: '1rem 0.25rem', borderRadius: '12px', border: sosActive ? '2px solid #cf1322' : 'none',
              fontWeight: 'bold', boxShadow: '0 4px 12px rgba(207, 19, 34, 0.3)', transition: 'all 0.2s',
              cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            <AlertOctagon size={16} />
            {sosTimer !== null ? `CANCEL (${sosTimer}s)` : (sosActive ? 'CANCEL SOS' : 'EMERGENCY')}
          </button>

          <button
            onClick={() => {
              setAlarmSet(!alarmSet);
              if (!alarmSet) toast.success("Alarm set! You'll be notified 2km before your stop.");
            }}
            style={{
              flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              backgroundColor: alarmSet ? '#e6f0fa' : 'var(--white)',
              color: alarmSet ? 'var(--primary-blue)' : 'var(--text-dark)',
              padding: '1rem 0.25rem', borderRadius: '12px', border: alarmSet ? '2px solid var(--primary-blue)' : '2px solid transparent',
              fontWeight: '600', boxShadow: 'var(--shadow)', transition: 'all 0.2s', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            <AlarmClock size={16} color={alarmSet ? 'var(--primary-blue)' : 'var(--text-light)'} />
            {alarmSet ? 'Alarm ON' : 'Wake Alarm'}
          </button>

          <button
            onClick={handleNotBoarding}
            style={{
              flex: 1, minWidth: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              backgroundColor: isNotBoarding ? '#f8f9fa' : 'var(--white)',
              color: isNotBoarding ? 'var(--text-light)' : 'var(--text-dark)',
              padding: '1rem 0.25rem', borderRadius: '12px', border: isNotBoarding ? '2px solid #e0e0e0' : '2px solid transparent',
              fontWeight: '600', boxShadow: 'var(--shadow)', transition: 'all 0.2s', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            <CalendarOff size={16} color={isNotBoarding ? 'var(--text-light)' : 'var(--secondary-orange)'} />
            {isNotBoarding ? 'Leave Marked' : 'Not Boarding'}
          </button>
        </div>

        <div className="grid-cards" style={{
          display: 'grid',
          /* gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', */
          gap: '1.5rem',
          height: '100%'
        }}>

          {/* Left Column: Info & Telemetry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Bus Info Card */}
            <div className="glass animate-slide-up p-glass delay-200 hover-lift" style={{
              /* padding: '1.5rem', */ borderRadius: '20px',
              display: 'flex', flexDirection: 'column', gap: '1.25rem'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-blue)', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                Your Route Details
                <span style={{ fontSize: '0.8rem', backgroundColor: '#e6fae6', color: '#28a745', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                  Boarded ✓
                </span>
              </h2>

              {/* Seat Availability Predictor */}
              <div style={{ backgroundColor: '#fff8f6', padding: '1rem', borderRadius: '12px', border: '1px solid #ffe8e0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--secondary-orange)' }}>
                    <Users size={16} /> Live Crowd Status
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: crowdStatus.status === 'High' ? '#cf1322' : '#28a745' }}>{crowdStatus.status}</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="progress-animated" style={{ width: `${(crowdStatus.filled / crowdStatus.total) * 100}%`, height: '100%', backgroundColor: crowdStatus.status === 'High' ? '#cf1322' : '#28a745', borderRadius: '4px', transition: 'width 0.5s' }}></div>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>{crowdStatus.filled}/{crowdStatus.total} seats filled. {crowdStatus.status === 'High' ? 'Likely standing only.' : 'Seats available.'}</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#e6f0fa', padding: '0.6rem', borderRadius: '10px', color: 'var(--primary-blue)' }}>
                    <Bus size={20} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '500' }}>Route {routeInfo?.route_id || '4'}</p>
                    <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-dark)' }}>{routeInfo?.bus_number || 'UP 25 AB 1234'}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#fff0e6', padding: '0.6rem', borderRadius: '10px', color: 'var(--secondary-orange)' }}>
                    <User size={20} />
                  </div>
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '500' }}>Driver Name</p>
                    <p style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-dark)' }}>{driverInfo?.name || 'Assigning...'}</p>
                  </div>
                  <a href={`tel:${driverInfo?.phone || '+919999999999'}`} style={{ marginLeft: 'auto', background: '#e6fae6', border: 'none', padding: '0.5rem', borderRadius: '50%', color: '#28a745', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Phone size={18} />
                  </a>
                </div>
              </div>
            </div>

            {/* Live Telemetry Card */}
            <div className="glass animate-slide-up p-glass delay-300 hover-lift" style={{
              /* padding: '1.5rem', */ borderRadius: '20px',
              display: 'flex', flexDirection: 'column', gap: '1.25rem',
              animationDelay: '0.1s'
            }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary-blue)', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                Live Sensors
                <span style={{ fontSize: '0.75rem', backgroundColor: '#e6fae6', color: '#28a745', padding: '0.25rem 0.5rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span className="pulse-glow" style={{ width: '8px', height: '8px', backgroundColor: '#28a745', borderRadius: '50%', display: 'inline-block' }}></span> Live
                </span>
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '600' }}>
                    <Activity size={16} color="var(--primary-blue)" /> Speed
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-dark)' }}>
                    {telemetry.speed.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-light)' }}>km/h</span>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '600' }}>
                    <Compass size={16} color="var(--secondary-orange)" /> Direction
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Navigation size={18} style={{ transform: `rotate(${telemetry.heading}deg)`, transition: 'transform 0.5s ease' }} color="var(--text-dark)" />
                    {telemetry.heading > 315 || telemetry.heading <= 45 ? 'North' :
                      telemetry.heading > 45 && telemetry.heading <= 135 ? 'East' :
                        telemetry.heading > 135 && telemetry.heading <= 225 ? 'South' : 'West'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-color)', padding: '1rem', borderRadius: '12px', gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '600' }}>
                    <Wind size={16} color={telemetry.comfort === 'Smooth' ? '#28a745' : 'var(--secondary-orange)'} /> Ride Comfort
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: telemetry.comfort === 'Smooth' ? '#28a745' : 'var(--secondary-orange)' }}>
                    {telemetry.comfort}
                  </div>
                </div>
              </div>
            </div>

            {!showMap && (
              <button
                className="btn btn-secondary animate-slide-up"
                onClick={() => setShowMap(true)}
                style={{
                  marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', fontSize: '1.1rem', animationDelay: '0.2s'
                }}
              >
                <MapPin size={22} />
                Open Live Map
              </button>
            )}

            {/* Route ETA Timeline */}
            <div className="glass animate-slide-up p-glass delay-400 hover-lift" style={{
              /* padding: '1.5rem', */ borderRadius: '20px',
              display: 'flex', flexDirection: 'column', gap: '1rem',
              animationDelay: '0.3s'
            }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-dark)', margin: 0 }}>Upcoming Stops</h2>
              <div style={{ display: 'flex', flexDirection: 'column', position: 'relative', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                <div style={{ position: 'absolute', left: '6px', top: '10px', bottom: '20px', width: '2px', backgroundColor: '#e0e0e0', zIndex: 0 }}></div>

                {(routeInfo?.stops ? routeInfo.stops.split(',').map(s => s.trim()) : ['Civil Lines (Your Stop)', 'Rajendra Nagar', 'DD Puram', 'Invertis University']).map((stop, idx, arr) => {
                  const isActive = idx === 0;
                  let eta = isActive ? 'Arriving soon' : `${(idx * 5) + 5} mins`;
                  if (idx === arr.length - 1) eta = `${(idx * 5) + 5} mins (Destination)`;

                  return (
                    <div key={idx} style={{ position: 'relative', paddingBottom: '1.25rem', zIndex: 1 }}>
                      <div style={{
                        position: 'absolute', left: '-1.5rem', top: '2px', width: '14px', height: '14px',
                        borderRadius: '50%', backgroundColor: isActive ? 'var(--secondary-orange)' : '#e0e0e0',
                        border: '3px solid white', boxShadow: '0 0 0 1px #e0e0e0'
                      }}></div>
                      <p style={{ margin: 0, fontWeight: '600', color: isActive ? 'var(--primary-blue)' : 'var(--text-dark)', fontSize: '0.95rem' }}>{stop}</p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: isActive ? 'var(--secondary-orange)' : 'var(--text-light)', fontWeight: isActive ? 'bold' : 'normal', marginTop: '0.25rem' }}>{eta}</p>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          {/* Right Column: Real Leaflet Map */}
          {showMap && (
            <div className="glass animate-slide-up" style={{
              borderRadius: '20px', overflow: 'hidden', position: 'relative',
              display: 'flex', flexDirection: 'column', minHeight: '400px', height: '100%',
              border: '2px solid var(--primary-blue)', animationDelay: '0.3s'
            }}>
              <div style={{ padding: '1rem', backgroundColor: 'var(--primary-blue)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                  <MapPin size={18} /> GPS Tracking: <span style={{ color: '#ffd0b0' }}>2 mins away</span>
                </h3>
                <button
                  onClick={() => setIsMapExpanded(true)}
                  style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.25rem' }}
                  title="Expand Map"
                >
                  <Maximize2 size={20} />
                </button>
              </div>

              <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <MapContainer center={busLocation} zoom={14} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {/* Bus Marker */}
                  <Marker position={busLocation} icon={busIcon}>
                    <Popup>
                      <b>Bus UP 25 AB 1234</b><br />
                      Speed: {telemetry.speed.toFixed(0)} km/h
                    </Popup>
                  </Marker>
                  {/* Route Polyline */}
                  <Polyline positions={routePolyline} color="var(--primary-blue)" weight={4} opacity={0.7} />
                  {/* Stops */}
                  <Marker position={routePolyline[3]}>
                    <Popup>Invertis University</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Expanded Map Modal */}
      {isMapExpanded && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100,
          display: 'flex', flexDirection: 'column'
        }}>
          <div style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--primary-blue)' }}>
            <h2 style={{ color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin /> Full Screen Tracking
            </h2>
            <button onClick={() => setIsMapExpanded(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
              <X size={28} />
            </button>
          </div>
          <div style={{ flex: 1, zIndex: 1 }}>
            <MapContainer center={busLocation} zoom={15} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <Marker position={busLocation} icon={busIcon}>
                <Popup><b>Bus UP 25 AB 1234</b><br />Speed: {telemetry.speed.toFixed(0)} km/h</Popup>
              </Marker>
              <Polyline positions={routePolyline} color="var(--primary-blue)" weight={5} />
              <Marker position={routePolyline[3]}>
                <Popup>Invertis University (Destination)</Popup>
              </Marker>
            </MapContainer>
          </div>
        </div>
      )}

      {/* Global Broadcast Popup */}
      {activeBroadcast && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem'
        }}>
          <div className="animate-slide-up" style={{
            backgroundColor: 'var(--card-bg)', borderRadius: '24px', padding: '2rem', width: '100%', maxWidth: '400px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
          }}>
            <div style={{ backgroundColor: '#fff1f0', color: '#cf1322', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <Bell size={40} className="animate-pulse" />
            </div>
            <h2 style={{ color: '#cf1322', margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 'bold' }}>{activeBroadcast.title || 'Important Notice'}</h2>
            <p style={{ color: 'var(--text-dark)', fontSize: '1.1rem', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
              {activeBroadcast.message}
            </p>
            <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', margin: '0 0 1.5rem 0' }}>
              Sent by: {activeBroadcast.sender} • {new Date(activeBroadcast.timestamp).toLocaleTimeString()}
            </p>
            <button
              onClick={acknowledgeBroadcast}
              style={{
                backgroundColor: 'var(--primary-blue)', color: 'white', border: 'none', padding: '1rem 2rem',
                borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', width: '100%',
                boxShadow: '0 4px 12px rgba(0, 102, 204, 0.3)'
              }}
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}

      <HamburgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  );
};

export default Home;
