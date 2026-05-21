import { useState, useEffect } from 'react';
import { LogOut, MapPin, Users, Power, Navigation, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../index.css';

const DriverDashboard = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);

  const stops = [
    { name: 'Civil Lines', passengers: 12 },
    { name: 'Rajendra Nagar', passengers: 8 },
    { name: 'DD Puram', passengers: 15 },
    { name: 'Invertis University', passengers: 0 }
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleTripToggle = () => {
    setIsTripActive(!isTripActive);
    if (!isTripActive) {
      setCurrentStopIndex(0);
    }
  };

  const handleNextStop = () => {
    if (currentStopIndex < stops.length - 1) {
      setCurrentStopIndex(prev => prev + 1);
    } else {
      setIsTripActive(false);
      alert("Trip Completed Successfully!");
    }
  };

  return (
    <div className="h-screen flex flex-col relative" style={{ backgroundColor: 'var(--bg-color)' }}>
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', backgroundColor: '#343a40', color: 'white',
        boxShadow: 'var(--shadow)'
      }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>
            Driver Panel <span style={{ color: '#28a745' }}>• UP 25 AB 1234</span>
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#adb5bd', margin: 0 }}>Driver: {user?.name}</p>
        </div>
        <button 
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: '#ff6b6b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}
        >
          <LogOut size={20} /> Exit
        </button>
      </header>

      <main style={{ padding: '2rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* Big Action Button */}
        <button 
          onClick={handleTripToggle}
          style={{
            padding: '2rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem',
            backgroundColor: isTripActive ? '#cf1322' : '#28a745', color: 'white', border: 'none',
            fontSize: '1.5rem', fontWeight: 'bold', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          <Power size={48} />
          {isTripActive ? 'END TRIP' : 'START TRIP'}
        </button>

        {isTripActive && (
          <div className="glass animate-slide-up" style={{ padding: '2rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Navigation color="var(--primary-blue)" /> Route Progress
              </h2>
              <span style={{ fontWeight: 'bold', color: 'var(--secondary-orange)' }}>Route 4</span>
            </div>

            <div style={{ backgroundColor: '#f8f9fa', padding: '1.5rem', borderRadius: '16px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-light)', fontWeight: '600', marginBottom: '0.5rem' }}>CURRENT/NEXT STOP</p>
              <h1 style={{ color: 'var(--primary-blue)', fontSize: '2.5rem', margin: '0 0 1rem 0' }}>{stops[currentStopIndex].name}</h1>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#e6f0fa', color: 'var(--primary-blue)', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold' }}>
                <Users size={20} /> {stops[currentStopIndex].passengers} Passengers to Board
              </div>
            </div>

            <button 
              onClick={handleNextStop}
              className="btn btn-primary"
              style={{ padding: '1.5rem', fontSize: '1.2rem', fontWeight: 'bold' }}
            >
              Mark Stop as Reached →
            </button>
          </div>
        )}

        <div className="glass" style={{ padding: '1.5rem', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
             <Phone color="var(--secondary-orange)" size={24} />
             <div>
               <h3 style={{ margin: 0, color: 'var(--text-dark)' }}>Admin Support</h3>
               <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.85rem' }}>Call for emergencies or breakdown</p>
             </div>
           </div>
           <button style={{ padding: '0.75rem 1.5rem', backgroundColor: '#fff0e6', color: 'var(--secondary-orange)', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Call Now</button>
        </div>

      </main>
    </div>
  );
};

export default DriverDashboard;
