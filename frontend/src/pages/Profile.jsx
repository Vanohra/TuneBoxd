import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import ProfileView from '../components/ProfileView.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** The signed-in user's own profile (protected route). */
export default function Profile() {
  const { user, refreshUser } = useAuth();
  const location = useLocation();

  // Re-check the session with the server every time the profile opens. If it
  // has expired, refreshUser clears the user and ProtectedRoute redirects to /login.
  useEffect(() => {
    refreshUser().catch(() => {});
  }, [refreshUser]);

  if (!user) return null;

  return (
    <>
      {location.state?.notice && (
        <div className="page-alert">
          <Alert type="success">{location.state.notice}</Alert>
        </div>
      )}
      <ProfileView key={user.username} username={user.username} email={user.email} />
    </>
  );
}
