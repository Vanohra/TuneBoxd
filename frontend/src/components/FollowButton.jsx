import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { followUser, unfollowUser } from '../api/users.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Follow / Following toggle. Logged-out visitors are sent to /login first.
 * `onChange(isFollowing, updatedProfile)` fires after a successful toggle.
 */
export default function FollowButton({ username, isFollowing, onChange, size }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isBusy, setIsBusy] = useState(false);

  async function handleClick() {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname, notice: 'Log in to follow people.' } });
      return;
    }
    setIsBusy(true);
    try {
      const profile = isFollowing ? await unfollowUser(username) : await followUser(username);
      onChange?.(profile.isFollowing, profile);
    } catch {
      // Leave the button as it was; the next click retries.
    } finally {
      setIsBusy(false);
    }
  }

  const sizeClass = size === 'sm' ? ' btn-sm' : '';
  return isFollowing ? (
    <button
      type="button"
      className={`btn btn-outline btn-following${sizeClass}`}
      onClick={handleClick}
      disabled={isBusy}
      aria-pressed="true"
      aria-label={`Following @${username}. Click to unfollow.`}
    >
      <span className="label-default">Following</span>
      <span className="label-hover">Unfollow</span>
    </button>
  ) : (
    <button
      type="button"
      className={`btn btn-primary${sizeClass}`}
      onClick={handleClick}
      disabled={isBusy}
      aria-pressed="false"
      aria-label={`Follow @${username}`}
    >
      Follow
    </button>
  );
}
