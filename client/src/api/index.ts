import axios from 'axios';
import { enqueueRequest, getQueue, dequeueRequest } from './indexedDB';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors (e.g. 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // Offline / Network Error Queueing
    if (!error.response && error.config && ['post', 'put', 'patch', 'delete'].includes(error.config.method?.toLowerCase() || '')) {
      const isOnline = navigator.onLine;
      if (!isOnline || error.code === 'ERR_NETWORK') {
        // Enqueue the request
        enqueueRequest({
          url: error.config.url!,
          method: error.config.method!,
          data: error.config.data ? JSON.parse(error.config.data) : null,
          headers: error.config.headers
        });

        // Mock a 201/200 success response so the app UI (like clearing POS cart) proceeds seamlessly 
        return Promise.resolve({
          data: { id: 'offline-' + Date.now(), orderNumber: 'OFF-' + Date.now(), status: 'queued_offline', items: error.config.data ? JSON.parse(error.config.data).items : [] },
          status: error.config.method?.toLowerCase() === 'post' ? 201 : 200,
          statusText: 'Queued Offline',
          headers: {},
          config: error.config
        });
      }
    }

    return Promise.reject(error);
  }
);

// Global sync function for the background loop to call
export const syncOfflineQueue = async () => {
  if (!navigator.onLine) return;
  const queue = await getQueue();
  if (queue.length === 0) return;

  for (const req of queue) {
    try {
      await axios({
        baseURL: API_URL,
        url: req.url,
        method: req.method,
        data: req.data,
        headers: req.headers
      });
      await dequeueRequest(req.id);
    } catch (e: any) {
      // If it's a 4xx error (validation failed etc), we should probably delete it to avoid infinite loops
      if (e.response && e.response.status >= 400 && e.response.status < 500) {
        await dequeueRequest(req.id);
      }
      // Otherwise (5xx or network drop), leave in queue to retry later
    }
  }
};

window.addEventListener('online', syncOfflineQueue);
setInterval(syncOfflineQueue, 15000); // Poll every 15s when app is open

export default api;
