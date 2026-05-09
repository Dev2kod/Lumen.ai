import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [providers, setProviders] = useState({ google: false });
  const [status, setStatus] = useState('loading'); // 'loading' | 'authed' | 'anon'

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setProviders(data.providers || { google: false });
      setStatus('authed');
    } catch (e) {
      setUser(null);
      setStatus('anon');
      // Fetch the public providers list so the login page knows whether to
      // show the Google button.
      try {
        const r = await fetch('/api/auth/providers', { credentials: 'include' });
        if (r.ok) setProviders(await r.json());
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
    setStatus('anon');
  }, []);

  const value = {
    user,
    providers,
    status,
    refresh,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
