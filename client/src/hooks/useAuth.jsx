import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authed' | 'anon'

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setStatus('anon');
      return;
    }
    try {
      const data = await api.me();
      setUser(data.user);
      setStatus('authed');
    } catch {
      tokenStore.clear();
      setUser(null);
      setStatus('anon');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Step 1 of sign-in: ask the server to email a magic link.
  // Returns the server's response — `{ ok, email, delivery }` — so the
  // login page can show "check your inbox" and (in dev) hint that the
  // link was logged to the server console.
  const requestMagicLink = useCallback(async (email) => {
    return api.requestMagicLink(email);
  }, []);

  // Step 2: consume the magic-link token (called by /auth/callback when
  // the user clicks the email link). Returns the user on success.
  const verifyMagicLink = useCallback(async (magicToken) => {
    const { token, user: u } = await api.verifyMagicLink(magicToken);
    tokenStore.set(token);
    setUser(u);
    setStatus('authed');
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* stateless */ }
    tokenStore.clear();
    setUser(null);
    setStatus('anon');
  }, []);

  const value = {
    user,
    status,
    refresh,
    requestMagicLink,
    verifyMagicLink,
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
