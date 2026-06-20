import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const token = localStorage.getItem('wo_access_token');
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await api.get('/auth/me');
      setUser(data.user);
      setFamilies(data.families || []);
    } catch {
      localStorage.removeItem('wo_access_token');
      localStorage.removeItem('wo_refresh_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('wo_access_token', data.accessToken);
    localStorage.setItem('wo_refresh_token', data.refreshToken);
    setUser(data.user);
    setFamilies(data.families || []);
    return data;
  };

  const register = async (formData) => {
    const { data } = await api.post('/auth/register', formData);
    localStorage.setItem('wo_access_token', data.accessToken);
    localStorage.setItem('wo_refresh_token', data.refreshToken);
    setUser(data.user);
    if (data.family) {
      setFamilies([{ _id: data.family._id, name: data.family.name, role: 'head' }]);
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('wo_access_token');
    localStorage.removeItem('wo_refresh_token');
    setUser(null);
    setFamilies([]);
  };

  const updateUser = (updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  };

  const refreshFamilies = async () => {
    try {
      const { data } = await api.get('/families');
      setFamilies(data.families || []);
    } catch (err) {
      // Intentionally suppressed for prod
    }
  };

  return (
    <AuthContext.Provider value={{
      user, families, loading,
      login, register, logout,
      updateUser, refreshFamilies, fetchMe
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
