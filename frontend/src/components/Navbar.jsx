import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import { LogoutIcon, SearchIcon } from './Icons.jsx';

/** Top bar: search placeholder on the left, auth actions on the right. */
export default function Navbar() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="topbar">
      {/* Music search is a future feature; the field is a visual placeholder for now. */}
      <label className="topbar-search" title="Search is coming soon">
        <SearchIcon size={18} />
        <input type="search" placeholder="Search for artists, albums, or songs…" disabled aria-label="Search (coming soon)" />
      </label>

      {!isLoading && (
        <nav className="topbar-actions" aria-label="Account">
          {user ? (
            <>
              <NavLink to="/profile" className="topbar-profile">
                <Avatar username={user.username} src={user.avatarUrl} size="sm" />
                <span>Profile</span>
              </NavLink>
              {/* The /logout page clears the session, then redirects to /login. */}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/logout')}>
                <LogoutIcon size={16} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Login
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Sign Up
              </Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
