import { useState } from 'react';
import { ArrowLeft, Bell, Moon, Shield, Globe, Camera, ChevronRight, LogOut, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../index.css';

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [faceResetRequested, setFaceResetRequested] = useState(false);

  const handleFaceReset = () => {
    setFaceResetRequested(true);
    alert("Request Sent! Admin will contact you to rescan your face data.");
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: '#f4f7fb' }}>
      <header style={{
        padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem',
        backgroundColor: 'var(--primary-blue)', color: 'white', zIndex: 10
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Settings</h1>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto', width: '100%' }}>
        
        {/* Account Settings */}
        <div className="animate-slide-up">
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-light)', fontWeight: '600', marginBottom: '0.75rem', marginLeft: '0.5rem', textTransform: 'uppercase' }}>
            Account
          </h3>
          <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
              <Shield size={20} color="var(--primary-blue)" style={{ marginRight: '1rem' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>Change Password</p>
              </div>
              <ChevronRight size={20} color="var(--text-light)" />
            </div>
            <div 
              onClick={!faceResetRequested ? handleFaceReset : undefined}
              style={{ display: 'flex', alignItems: 'center', padding: '1rem', cursor: faceResetRequested ? 'default' : 'pointer', backgroundColor: faceResetRequested ? '#e6fae6' : 'transparent' }}
            >
              <Camera size={20} color={faceResetRequested ? '#28a745' : "var(--primary-blue)"} style={{ marginRight: '1rem' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '600', color: faceResetRequested ? '#28a745' : 'var(--text-dark)' }}>
                  {faceResetRequested ? 'Face Rescan Requested' : 'Request Face Data Reset'}
                </p>
                {!faceResetRequested && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>If face recognition is failing</p>}
              </div>
              {faceResetRequested ? <CheckCircle2 size={20} color="#28a745" /> : <ChevronRight size={20} color="var(--text-light)" />}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-light)', fontWeight: '600', marginBottom: '0.75rem', marginLeft: '0.5rem', textTransform: 'uppercase' }}>
            Preferences
          </h3>
          <div className="glass" style={{ borderRadius: '16px', overflow: 'hidden' }}>
            
            {/* Push Notifications Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
              <Bell size={20} color="var(--primary-blue)" style={{ marginRight: '1rem' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>Push Notifications</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>Bus arrival & SOS alerts</p>
              </div>
              <div 
                onClick={() => setPushNotifications(!pushNotifications)}
                style={{ 
                  width: '44px', height: '24px', backgroundColor: pushNotifications ? 'var(--secondary-orange)' : '#e0e0e0',
                  borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s'
                }}
              >
                <div style={{ 
                  width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: pushNotifications ? '22px' : '2px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>

            {/* SMS Alerts Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
              <Bell size={20} color="var(--primary-blue)" style={{ marginRight: '1rem' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>SMS Alerts</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-light)' }}>Receive updates via SMS</p>
              </div>
              <div 
                onClick={() => setSmsAlerts(!smsAlerts)}
                style={{ 
                  width: '44px', height: '24px', backgroundColor: smsAlerts ? 'var(--secondary-orange)' : '#e0e0e0',
                  borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s'
                }}
              >
                <div style={{ 
                  width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: smsAlerts ? '22px' : '2px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>

            {/* Language */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
              <Globe size={20} color="var(--primary-blue)" style={{ marginRight: '1rem' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>Language</p>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontWeight: '600', marginRight: '0.5rem' }}>English</span>
              <ChevronRight size={20} color="var(--text-light)" />
            </div>

            {/* Dark Mode Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '1rem' }}>
              <Moon size={20} color="var(--primary-blue)" style={{ marginRight: '1rem' }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>Dark Mode</p>
              </div>
              <div 
                onClick={() => setDarkMode(!darkMode)}
                style={{ 
                  width: '44px', height: '24px', backgroundColor: darkMode ? 'var(--primary-blue)' : '#e0e0e0',
                  borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: 'all 0.3s'
                }}
              >
                <div style={{ 
                  width: '20px', height: '20px', backgroundColor: 'white', borderRadius: '50%',
                  position: 'absolute', top: '2px', left: darkMode ? '22px' : '2px', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>

          </div>
        </div>

        {/* Log Out */}
        <div className="animate-slide-up" style={{ animationDelay: '0.2s', marginTop: '1rem' }}>
          <button 
            onClick={handleLogout}
            style={{ 
              width: '100%', padding: '1rem', backgroundColor: '#fff1f0', color: '#cf1322', 
              border: 'none', borderRadius: '16px', fontWeight: 'bold', fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer'
            }}
          >
            <LogOut size={20} />
            Log Out of App
          </button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
