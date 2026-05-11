import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useGoogleLogin, googleLogout } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from '../authConfig';

const AuthContext = createContext(null);

const SESSION_TOKEN_KEY  = 'wfm_gat';
const SESSION_USER_KEY   = 'wfm_guser';
// Fix 3 — store expiry so a stale session isn't silently used after the 1-hour token window
const SESSION_EXPIRY_KEY = 'wfm_gat_exp';

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);   // { email, name, picture }
  const [accessToken,  setAccessToken]  = useState(null);
  const [role,         setRole]         = useState(null);
  const [profile,      setProfile]      = useState(null);   // Planner_Roster row
  const [isLoading,    setIsLoading]    = useState(true);
  const [authError,    setAuthError]    = useState(null);   // 'not-found' | 'auth-failed' | null
  // Fix 5 — null = not yet tested, { ok, error? } after the probe runs
  const [sheetsStatus, setSheetsStatus] = useState(null);

  // Restore session from sessionStorage on mount
  useEffect(() => {
    const savedToken  = sessionStorage.getItem(SESSION_TOKEN_KEY);
    const savedUser   = sessionStorage.getItem(SESSION_USER_KEY);
    const savedExpiry = sessionStorage.getItem(SESSION_EXPIRY_KEY);

    // Fix 3 — discard expired tokens immediately so the user isn't silently broken
    if (savedToken && savedExpiry && Date.now() > parseInt(savedExpiry, 10)) {
      console.warn('Stored token is expired — clearing session');
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionStorage.removeItem(SESSION_EXPIRY_KEY);
      setIsLoading(false);
      return;
    }

    if (savedToken && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setAccessToken(savedToken);
      loadProfile(parsedUser.email, savedToken)
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  async function loadProfile(email, token) {
    try {
      // Dynamic import avoids circular dep — googleSheets imports nothing from auth
      const { getPlannerProfile } = await import('../api/googleSheets.js');
      const p = await getPlannerProfile(email, token);
      if (p) {
        setProfile(p);
        setRole(p.Role);
        setAuthError(null);
      } else {
        setAuthError('not-found');
        clearSession();
      }
      return p;
    } catch (e) {
      console.error('Profile load failed:', e);
      setAuthError('network-error');
      return null;
    }
  }

  // Called by LoginPage after useGoogleLogin succeeds
  const handleGoogleSuccess = useCallback(async (tokenResponse) => {
    setIsLoading(true);
    setAuthError(null);
    setSheetsStatus(null);
    try {
      const token = tokenResponse.access_token;
      // Fix 3 — persist token expiry (subtract 60s buffer)
      const expiresIn = tokenResponse.expires_in ?? 3600;
      const expiry    = Date.now() + (expiresIn - 60) * 1000;
      sessionStorage.setItem(SESSION_EXPIRY_KEY, String(expiry));

      const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!infoRes.ok) throw new Error('userinfo failed');
      const info = await infoRes.json();
      const u = { email: info.email, name: info.name, picture: info.picture };
      setUser(u);
      setAccessToken(token);
      sessionStorage.setItem(SESSION_TOKEN_KEY, token);
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(u));
      await loadProfile(u.email, token);

      // Fix 5 — probe Sheets after login so the sidebar badge reflects real connectivity
      const { testSheetsConnection } = await import('../api/googleSheets.js');
      const status = await testSheetsConnection(token);
      setSheetsStatus(status);
    } catch (e) {
      console.error('Google auth failed:', e);
      setAuthError('auth-failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGoogleError = useCallback(() => {
    setAuthError('auth-failed');
  }, []);

  function clearSession() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    setUser(null);
    setAccessToken(null);
    setRole(null);
    setProfile(null);
    setSheetsStatus(null);
  }

  const signOut = useCallback(() => {
    googleLogout();
    clearSession();
    setAuthError(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      accessToken,
      role,
      profile,
      isLoading,
      authError,
      sheetsStatus,
      handleGoogleSuccess,
      handleGoogleError,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
