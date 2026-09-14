// API Base URL config resolving from environment variables with local fallback
export const API_BASE_URL = 
  (typeof process !== 'undefined' && process.env && (process.env.VITE_API_BASE_URL || process.env.VITE_API_URL)) ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? "http://localhost:8000"
    : "https://paddock-scout.onrender.com");
