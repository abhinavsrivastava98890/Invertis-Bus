import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, User, Lock, ArrowRight, Shield, Car } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../index.css';

import axios from 'axios';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loginType, setLoginType] = useState('student'); // 'student', 'admin', 'driver'
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (userId && password) {
      setIsLoading(true);
      try {
        const response = await axios.post('http://localhost:5000/api/login', {
          login_id: userId,
          password: password
        });

        if (response.data.status === 'success') {
          const userData = {
            id: userId,
            role: response.data.user.role,
            name: response.data.user.name,
            route_id: response.data.user.route_id,
            token: response.data.token
          };
          
          login(userData);
          
          if (userData.role === 'admin') {
            navigate('/admin-dashboard', { replace: true });
          } else if (userData.role === 'driver') {
            navigate('/driver-dashboard', { replace: true });
          } else {
            navigate('/home', { replace: true });
          }
        }
      } catch (error) {
        console.error("Login failed:", error);
        alert(error.response?.data?.detail || "Invalid Credentials or Server Down");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative p-4" style={{ backgroundColor: '#f4f7fb', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', width: '400px', height: '400px',
        borderRadius: '50%', background: 'var(--primary-blue)', opacity: '0.1', filter: 'blur(40px)'
      }}></div>
      <div style={{
        position: 'absolute', bottom: '-10%', right: '-10%', width: '300px', height: '300px',
        borderRadius: '50%', background: 'var(--secondary-orange)', opacity: '0.1', filter: 'blur(40px)'
      }}></div>

      <div className="glass animate-slide-up" style={{
        width: '100%', maxWidth: '450px', padding: '3rem 2.5rem',
        borderRadius: '20px', zIndex: 1, margin: '0 1.5rem'
      }}>
        <div className="flex flex-col items-center mb-6">
          <div style={{
            background: loginType === 'admin' ? 'var(--secondary-orange)' : loginType === 'driver' ? '#28a745' : 'var(--primary-blue)', 
            padding: '1rem',
            borderRadius: '16px', marginBottom: '1rem',
            transition: 'background-color 0.3s'
          }}>
            {loginType === 'admin' ? <Shield size={32} color="white" /> : loginType === 'driver' ? <Car size={32} color="white" /> : <Bus size={32} color="white" />}
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary-blue)' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-light)', marginTop: '0.5rem' }}>Login to your account</p>
        </div>

        {/* Toggle Switch */}
        <div style={{
          display: 'flex', backgroundColor: '#e9ecef', borderRadius: '12px', padding: '4px', marginBottom: '2rem'
        }}>
          {['student', 'driver', 'admin'].map((type) => (
            <button 
              key={type}
              type="button"
              onClick={() => { setLoginType(type); setUserId(''); setPassword(''); }}
              style={{
                flex: 1, padding: '0.75rem 0.25rem', borderRadius: '10px', border: 'none', 
                backgroundColor: loginType === type ? 'white' : 'transparent',
                color: loginType === type ? (type === 'admin' ? 'var(--secondary-orange)' : type === 'driver' ? '#28a745' : 'var(--primary-blue)') : 'var(--text-light)',
                fontWeight: loginType === type ? '600' : '500',
                boxShadow: loginType === type ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer', transition: 'all 0.3s', textTransform: 'capitalize'
              }}
            >
              {type}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="flex flex-col" style={{ gap: '1.5rem' }}>
          <div className="animate-fade-in" key={loginType + 'id'}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-dark)' }}>
              {loginType === 'student' ? 'Student ID' : loginType === 'driver' ? 'Driver ID' : 'Admin ID'}
            </label>
            <div className="relative">
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}>
                <User size={18} />
              </div>
              <input 
                type="text" 
                placeholder={`Enter ${loginType} ID`}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                style={{
                  width: '100%', padding: '1rem 1rem 1rem 3rem',
                  borderRadius: '12px', border: '1px solid #e0e0e0',
                  fontSize: '1rem', outline: 'none', transition: 'border-color 0.3s'
                }}
              />
            </div>
          </div>

          <div className="animate-fade-in" key={loginType + 'pass'}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-dark)' }}>Password</label>
            <div className="relative">
              <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}>
                <Lock size={18} />
              </div>
              <input 
                type="password" 
                placeholder="Enter password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', padding: '1rem 1rem 1rem 3rem',
                  borderRadius: '12px', border: '1px solid #e0e0e0',
                  fontSize: '1rem', outline: 'none', transition: 'border-color 0.3s'
                }}
              />
            </div>
          </div>

          <button type="submit" className={`btn`} style={{
            marginTop: '1rem', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '1.1rem',
            backgroundColor: loginType === 'admin' ? 'var(--secondary-orange)' : loginType === 'driver' ? '#28a745' : 'var(--primary-blue)',
            color: 'white', border: 'none'
          }}>
            Login
            <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
