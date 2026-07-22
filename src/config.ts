// Centralized API configuration for Vite & Mobile App
// Uses VITE_API_BASE_URL env variable, defaulting to live server at https://bondly-server.onrender.com
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://bondly-server.onrender.com').replace(/\/$/, '');

export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${cleanPath}`;
}
