import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function LoadingScreen() {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      Loading…
    </div>
  );
}

/**
 * Frontend half of route protection. It sends logged-out visitors to /login.
 * The real enforcement is on the backend: /api/me returns 401 without a valid
 * session, so protected data can't be fetched by bypassing this component.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname, notice: 'Please log in to continue.' }} />;
  }
  return <Outlet />;
}

/** Login/Sign Up pages: logged-in users are sent to their profile instead. */
export function GuestOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingScreen />;
  if (isAuthenticated) return <Navigate to="/profile" replace />;
  return <Outlet />;
}
