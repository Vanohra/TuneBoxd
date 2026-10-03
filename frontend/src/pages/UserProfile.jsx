import { Navigate, useLocation, useParams } from 'react-router-dom';
import ProfileView from '../components/ProfileView.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** Public profile at /u/:username. Your own username redirects to /profile. */
export default function UserProfile() {
  const { username } = useParams();
  const { user } = useAuth();
  const location = useLocation();

  if (user && user.username.toLowerCase() === username.toLowerCase()) {
    return <Navigate to={`/profile${location.search}`} replace />;
  }
  return <ProfileView key={username} username={username} />;
}
