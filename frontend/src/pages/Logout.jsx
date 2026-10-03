import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Logs out, then sends the user to /login. This lives on its own unprotected
 * route so ProtectedRoute's "please log in" redirect doesn't race the logout.
 */
export default function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    logout()
      .catch(() => {})
      .finally(() => navigate('/login', { replace: true, state: { notice: 'You have been logged out.' } }));
  }, [logout, navigate]);

  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      Logging out…
    </div>
  );
}
