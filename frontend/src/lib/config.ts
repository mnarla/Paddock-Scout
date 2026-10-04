// API Base URL config resolving to local backend on localhost, or environment / production URL
export const API_BASE_URL =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8001"
    : (typeof process !== "undefined" && process.env && (process.env.VITE_API_BASE_URL || process.env.VITE_API_URL)) ||
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.VITE_API_URL ||
      "https://paddock-scout.onrender.com";
