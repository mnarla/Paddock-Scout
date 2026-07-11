// API Base URL config resolving from environment variables with local fallback
export const API_BASE_URL = 
  (typeof process !== 'undefined' && process.env && process.env.VITE_API_BASE_URL) ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";
