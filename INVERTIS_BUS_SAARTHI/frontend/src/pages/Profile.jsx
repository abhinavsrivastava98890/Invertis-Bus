import { useState } from 'react';
import { ArrowLeft, User, MapPin, Bus, Shield, Camera, QrCode, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../index.css';

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showIdCard, setShowIdCard] = useState(false);

  // Mock attendance data for last 7 days
  const attendanceHistory = [
    { day: 'Mon', status: 'present', date: '12' },
    { day: 'Tue', status: 'absent', date: '13' },
    { day: 'Wed', status: 'present', date: '14' },
    { day: 'Thu', status: 'present', date: '15' },
    { day: 'Fri', status: 'present', date: '16' },
  ];

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: '#f4f7fb', overflowY: 'auto' }}>
      {/* Header */}
      <header style={{
        padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'var(--primary-blue)', color: 'white', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>My Profile</h1>
        </div>
        <button 
          onClick={() => setShowIdCard(!showIdCard)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '0.5rem', borderRadius: '10px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <QrCode size={18} /> {showIdCard ? 'Hide Pass' : 'Bus Pass'}
        </button>
      </header>

      <main style={{ paddingBottom: '2rem' }}>
        {/* Profile Banner */}
        <div style={{
          backgroundColor: 'var(--primary-blue)', height: '100px',
          borderBottomLeftRadius: '30px', borderBottomRightRadius: '30px',
          position: 'relative', marginBottom: '4rem'
        }}>
          {/* Avatar */}
          <div style={{
            position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)',
            width: '100px', height: '100px', backgroundColor: 'var(--white)', borderRadius: '50%',
            boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '4px solid white', overflow: 'hidden'
          }}>
            <User size={50} color="var(--primary-blue)" />
            <button style={{
              position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--secondary-orange)',
              color: 'white', border: 'none', borderRadius: '50%', padding: '0.4rem', cursor: 'pointer'
            }}>
              <Camera size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-dark)', margin: '0 0 0.25rem 0' }}>
              {user?.name || 'Student Name'}
            </h2>
            <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              {user?.role === 'admin' ? 'Administrator' : user?.role === 'driver' ? 'Driver ID: DRV-8942' : 'ID: INV-2023-BCA'}
            </p>
            {user?.role === 'student' && (
              <span style={{ backgroundColor: '#e6fae6', color: '#28a745', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                ✓ Transport Fee Paid (Sem 4)
              </span>
            )}
          </div>

          {/* Digital ID Card (Toggleable) */}
          {showIdCard && (
            <div className="animate-slide-up" style={{
              backgroundColor: 'white', padding: '1.5rem', borderRadius: '20px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '2px solid var(--primary-blue)',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
            }}>
              <h3 style={{ margin: 0, color: 'var(--primary-blue)' }}>DIGITAL BUS PASS</h3>
              {/* Fake QR Code */}
              <div style={{ width: '150px', height: '150px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                <QrCode size={100} color="var(--text-dark)" />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: 0 }}>Scan this code if face recognition is unavailable.</p>
            </div>
          )}

          {/* Weekly Attendance (For Students) */}
          {user?.role === 'student' && (
            <div className="glass animate-slide-up" style={{ padding: '1.5rem', borderRadius: '20px' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--primary-blue)' }}>Weekly Attendance</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {attendanceHistory.map((record, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 'bold' }}>{record.day}</span>
                    <div style={{
                      width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: record.status === 'present' ? '#e6fae6' : '#fff1f0',
                      color: record.status === 'present' ? '#28a745' : '#cf1322'
                    }}>
                      {record.status === 'present' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dark)' }}>{record.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="glass animate-slide-up" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-blue)' }}>Personal Details</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--secondary-orange)', fontWeight: 'bold', cursor: 'pointer' }}>Edit</button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '10px', color: 'var(--text-light)' }}>
                <Bus size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Assigned Route</p>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>Route 4</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '10px', color: 'var(--text-light)' }}>
                <MapPin size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Default Pickup Stop</p>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>Civil Lines, Bareilly</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '10px', color: 'var(--text-light)' }}>
                <Shield size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>Emergency Contact</p>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>+91 98765 43210 (Father)</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
