// Global Configuration for Bus Saarthi
// This URL will be used across all components for API and Socket.io connections.

// In a real Vite app, we should use environment variables:
// export const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://invertis-bus.onrender.com';

// For now, we explicitly define the working production URL.
// If you want to test locally, comment out the Render URL and uncomment the localhost URL.

// export const BACKEND_URL = 'https://invertis-bus.onrender.com';
// export const BACKEND_URL = 'http://localhost:5000';
// Using environment variable with fallback to Render for Vercel deployment
export const BACKEND_URL = import.meta.env.VITE_API_URL || 'https://invertis-bus.onrender.com';
