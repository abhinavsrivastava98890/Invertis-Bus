import { X, Users, Home, User, Settings, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../index.css';

const HamburgerMenu = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  if (!isOpen) return null;

  return (
    <>
      <div 
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)', zIndex: 40, transition: 'opacity 0.3s'
        }}
        onClick={onClose}
      />
      <div 
        style={{
          position: 'fixed', top: 0, right: 0, height: '100vh',
          width: '70%', maxWidth: '350px', backgroundColor: 'var(--white)',
          boxShadow: 'var(--shadow-lg)', zIndex: 50,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          display: 'flex', flexDirection: 'column'
        }}
        className="animate-slide-up"
      >
        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dark)' }}>
            <X size={28} />
          </button>
        </div>

        <div style={{ padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          <button 
            onClick={() => { onClose(); navigate('/community'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1.25rem', backgroundColor: 'var(--secondary-orange)',
              color: 'var(--white)', borderRadius: '12px', border: 'none',
              fontSize: '1.2rem', fontWeight: '600', cursor: 'pointer',
              boxShadow: '0 4px 14px 0 rgba(255, 102, 0, 0.3)',
              marginBottom: '1rem', transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Users size={24} />
            Bus Community
          </button>

          {[
            { icon: Home, label: 'Home', action: () => { onClose(); navigate('/home'); } },
            { icon: User, label: 'Profile', action: () => { onClose(); navigate('/profile'); } },
            { icon: Settings, label: 'Settings', action: () => { onClose(); navigate('/settings'); } },
          ].map((item, index) => (
            <button 
              key={index}
              onClick={item.action}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem', backgroundColor: 'transparent',
                color: 'var(--text-dark)', borderRadius: '10px', border: 'none',
                fontSize: '1.05rem', fontWeight: '500', cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-color)';
                e.currentTarget.style.color = 'var(--primary-blue)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-dark)';
              }}
            >
              <item.icon size={22} />
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '1.5rem', borderTop: '1px solid #f0f0f0' }}>
          <button 
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
              onClose();
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              padding: '1rem', width: '100%', backgroundColor: '#fff1f0',
              color: '#cf1322', borderRadius: '10px', border: 'none',
              fontSize: '1.05rem', fontWeight: '600', cursor: 'pointer'
            }}
          >
            <LogOut size={22} />
            Log Out
          </button>
        </div>
      </div>
    </>
  );
};

export default HamburgerMenu;
