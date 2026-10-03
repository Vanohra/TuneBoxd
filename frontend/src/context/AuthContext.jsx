import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth.js';

const AuthContext = createContext(null);

/**
 * Holds the signed-in user in memory only. Nothing goes in localStorage. On
 * page load/refresh it asks GET /api/me, and the session cookie restores the user.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Re-checks the session with the server. Returns the user, or null if logged out.
  const refreshUser = useCallback(async () => {
    try {
      const current = await authApi.fetchCurrentUser();
      setUser(current);
      return current;
    } catch (err) {
      if (err.status === 401) {
        setUser(null);
        return null;
      }
      throw err;
    }
  }, []);

  useEffect(() => {
    refreshUser()
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (credentials) => {
    const loggedIn = await authApi.loginUser(credentials);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logoutUser();
    } finally {
      // Clear local state even if the request failed. The user asked to leave.
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (changes) => {
    try {
      const updated = await authApi.updateProfile(changes);
      setUser(updated);
      return updated;
    } catch (err) {
      if (err.status === 401) setUser(null); // session expired → ProtectedRoute redirects
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, isAuthenticated: Boolean(user), login, logout, updateProfile, refreshUser }),
    [user, isLoading, login, logout, updateProfile, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
