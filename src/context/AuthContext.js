import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  apiFetch,
  clearAuthSession,
  readStoredAuthToken,
  readStoredAuthUser,
  saveAuthSession,
  updateStoredAuthUser,
} from '../utils/api';

const AuthContext = createContext(null);

function normalizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id || user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    isActive: user.isActive,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => normalizeUser(readStoredAuthUser()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const syncFromStorage = () => {
      if (!isMounted) {
        return;
      }

      setUser(normalizeUser(readStoredAuthUser()));
    };

    const hydrateSession = async () => {
      const token = readStoredAuthToken();
      if (!token) {
        clearAuthSession();
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const payload = await apiFetch('/api/auth/me');
        const nextUser = normalizeUser(payload?.data);
        saveAuthSession({ token, user: nextUser });
        if (isMounted) {
          setUser(nextUser);
        }
      } catch (error) {
        clearAuthSession();
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    hydrateSession();

    window.addEventListener('auth:changed', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:changed', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  const login = async (username, password) => {
    const payload = await apiFetch('/api/auth/login', {
      method: 'POST',
      token: '',
      body: { username, password },
    });

    const nextUser = normalizeUser(payload?.user);
    saveAuthSession({ token: payload?.token || '', user: nextUser });
    setUser(nextUser);
    return nextUser;
  };

  const register = async (username, password, name, email, role = 'user') => {
    const payload = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { username, password, name, email, role },
    });

    const nextUser = normalizeUser(payload?.user);
    saveAuthSession({ token: payload?.token || '', user: nextUser });
    setUser(nextUser);
    return nextUser;
  };

  const logout = () => {
    clearAuthSession();
    setUser(null);
  };

  const refreshUser = async () => {
    const payload = await apiFetch('/api/auth/me');
    const nextUser = normalizeUser(payload?.data);
    updateStoredAuthUser(nextUser);
    setUser(nextUser);
    return nextUser;
  };

  const checkSetupStatus = async () => {
    const payload = await apiFetch('/api/auth/setup-status', { token: '' });
    return Boolean(payload?.requiresSetup);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, register, refreshUser, checkSetupStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
