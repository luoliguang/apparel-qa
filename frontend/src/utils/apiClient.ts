import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

instance.interceptors.request.use((config: import('axios').InternalAxiosRequestConfig) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

export const apiClient = instance;

