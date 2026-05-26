import { useState, useRef } from 'react';
import { ArrowLeft, User, MapPin, Bus, Shield, Camera, QrCode, CheckCircle2, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { BACKEND_URL } from '../config';
import toast from 'react-hot-toast';
import { useLang } from '../context/LanguageContext';
import '../index.css';

const Profile = () => {
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { t, translateName } = useLang();
  const [showIdCard, setShowIdCard] = useState(false);
  const [profilePic, setProfilePic] = useState(user?.profile_pic || null);
  const fileInputRef = useRef(null);

  const handleProfilePicUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const loadingToast = toast.loading('Uploading profile picture...');
    try {
      const res = await axios.post(`${BACKEND_URL}/api/upload/profile_pic`, formData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.data.status === 'success') {
        setProfilePic(res.data.url);
        // Persist the updated profile_pic in local storage via AuthContext
        if (login && user) {
          login({ ...user, profile_pic: res.data.url });
        }
        toast.success('Profile picture updated!', { id: loadingToast });
      } else {
        toast.error('Upload failed: ' + (res.data.detail || 'Unknown error'), { id: loadingToast });
      }
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Network error';
      toast.error('Failed to upload image: ' + msg, { id: loadingToast });
      console.error('Profile pic upload error:', err.response?.data || err);
    }
  };

  // Mock attendance data for last 7 days
  const attendanceHistory = [
    { day: 'Mon', status: 'present', date: '12' },
    { day: 'Tue', status: 'absent', date: '13' },
    { day: 'Wed', status: 'present', date: '14' },
    { day: 'Thu', status: 'present', date: '15' },
    { day: 'Fri', status: 'present', date: '16' },
  ];

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: 'var(--bg-color)', overflowY: 'auto' }}>
      {/* Header */}
      <header className="p-header" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'var(--primary-blue)', color: 'white', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <ArrowLeft size={24} />
          </button>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>{t('myProfile')}</h1>
        </div>
        <button 
          onClick={() => setShowIdCard(!showIdCard)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', padding: '0.5rem', borderRadius: '10px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <QrCode size={18} /> {showIdCard ? t('hidePass') : t('busPass')}
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
            {profilePic ? (
              <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={50} color="var(--primary-blue)" />
            )}
            <button 
              onClick={() => fileInputRef.current.click()}
              style={{
                position: 'absolute', bottom: 0, right: 0, backgroundColor: 'var(--secondary-orange)',
                color: 'white', border: 'none', borderRadius: '50%', padding: '0.4rem', cursor: 'pointer'
              }}>
              <Camera size={16} />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept="image/*" 
              onChange={handleProfilePicUpload} 
            />
          </div>
        </div>

        <div className="p-main" style={{ paddingTop: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
          
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-dark)', margin: '0 0 0.25rem 0' }}>
              {translateName(user?.name) || t('studentProfile')}
            </h2>
            <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.9rem', fontWeight: '500', marginBottom: '0.5rem' }}>
              {user?.role === 'admin' ? t('administrator') : user?.role === 'driver' ? `${t('driver')} ID: DRV-8942` : `ID: INV-2023-BCA`}
            </p>
            {user?.role === 'student' && (
              <span style={{ backgroundColor: '#e6fae6', color: '#28a745', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {t('feePaidStatus')}
              </span>
            )}
          </div>

          {/* Digital ID Card (Toggleable) */}
          {showIdCard && (
            <div className="animate-slide-up" style={{
              backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '20px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '2px solid var(--primary-blue)',
              textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
            }}>
              <h3 style={{ margin: 0, color: 'var(--primary-blue)' }}>{t('digitalBusPass')}</h3>
              {/* Fake QR Code */}
              <div style={{ width: '150px', height: '150px', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}>
                <QrCode size={100} color="var(--text-dark)" />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', margin: 0 }}>{t('scanQrHint')}</p>
            </div>
          )}

          {/* Weekly Attendance (For Students) */}
          {user?.role === 'student' && (
            <div className="glass animate-slide-up p-glass" style={{ borderRadius: '20px' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: 'var(--primary-blue)' }}>{t('weeklyAttendance')}</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {attendanceHistory.map((record, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 'bold' }}>{t(record.day.toLowerCase())}</span>
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

          {/* Details Card */}          <div className="glass animate-slide-up p-glass" style={{ borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary-blue)' }}>{t('personalDetails')}</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--secondary-orange)', fontWeight: 'bold', cursor: 'pointer' }}>{t('edit')}</button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '10px', color: 'var(--text-light)' }}>
                <Bus size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{t('myRoute')}</p>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>{t('route')} {user?.route_id || '4'}</p>
              </div>
            </div>
 
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '10px', color: 'var(--text-light)' }}>
                <MapPin size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{t('defaultPickupStop')}</p>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>Civil Lines, Bareilly</p>
              </div>
            </div>
 
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ backgroundColor: '#e9ecef', padding: '0.5rem', borderRadius: '10px', color: 'var(--text-light)' }}>
                <Shield size={20} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-light)' }}>{t('emergencyContact')}</p>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text-dark)' }}>+91 98765 43210 ({t('father')})</p>
            </div>
          </div>
        </div>
      </div>
      </main>
    </div>
  );
};

export default Profile;
