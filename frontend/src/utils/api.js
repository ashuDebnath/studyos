import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  timeout: 60000, // 60s for AI calls
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('studyos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('studyos_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
