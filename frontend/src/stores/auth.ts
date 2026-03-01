import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '../utils/apiClient';

interface User {
  id: number;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
  nickname: string;
  avatarUrl: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(null);

  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  const setToken = (t: string | null) => {
    token.value = t;
    if (t) {
      localStorage.setItem('token', t);
    } else {
      localStorage.removeItem('token');
    }
  };

  const fetchMe = async () => {
    if (!token.value) return;
    try {
      const res = await apiClient.get('/auth/me');
      user.value = res.data;
    } catch {
      setToken(null);
      user.value = null;
    }
  };

  const login = async (email: string, password: string) => {
    const res = await apiClient.post('/auth/login', { email, password });
    setToken(res.data.token);
    user.value = res.data.user;
  };

  const register = async (email: string, password: string, nickname?: string) => {
    const res = await apiClient.post('/auth/register', { email, password, nickname });
    setToken(res.data.token);
    user.value = res.data.user;
  };

  const updateProfile = async (payload: { nickname?: string; avatarUrl?: string }) => {
    const res = await apiClient.patch('/auth/me', payload);
    user.value = res.data;
    return res.data as User;
  };

  const logout = () => {
    setToken(null);
    user.value = null;
  };

  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    setToken,
    fetchMe,
    login,
    register,
    updateProfile,
    logout,
  };
});

