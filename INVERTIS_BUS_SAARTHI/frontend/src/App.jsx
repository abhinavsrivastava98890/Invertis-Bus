import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Splash from './pages/Splash';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import { Toaster } from 'react-hot-toast';
import './index.css';

// Apply dark mode immediately from localStorage (before first render)
if (localStorage.getItem('pref_dark') === 'true') {
  document.body.classList.add('dark-mode');
}

// Lazy loading pages for better performance
const Home = lazy(() => import('./pages/Home'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));
const Community = lazy(() => import('./pages/Community'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));


// A component to redirect authenticated users away from Login page
const PublicRoute = ({ children }) => {
  const { user } = useAuth();
  if (user) {
    if (user.role === 'admin') return <Navigate to="/admin-dashboard" replace />;
    if (user.role === 'driver') return <Navigate to="/driver-dashboard" replace />;
    return <Navigate to="/home" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontWeight: '500',
                fontSize: '0.9rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              },
              success: { style: { background: '#e6fae6', color: '#28a745' } },
              error: { style: { background: '#fff1f0', color: '#cf1322' } },
            }}
          />
          <Suspense fallback={<div className="h-screen flex items-center justify-center text-primary-blue font-bold">Loading...</div>}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Splash />} />
              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                } 
              />
              
              {/* Protected Routes */}
              <Route 
                path="/home" 
                element={
                  <ProtectedRoute allowedRoles={['student']}>
                    <Home />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin-dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/driver-dashboard" 
                element={
                  <ProtectedRoute allowedRoles={['driver']}>
                    <DriverDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/community" 
                element={
                  <ProtectedRoute>
                    <Community />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />


              {/* 404 Catch All Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
