import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import { LogoutIcon, SearchIcon } from './Icons.jsx';

/** Top bar: music search on the left, auth actions on the right. */
export default function Navbar() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');

  // Keep the box in sync with /search?q=... (e.g. after back/forward).
  useEffect(() => {
    if (location.pathname === '/search') setQuery(new URLSearchParams(location.search).get('q') ?? '');
  }, [location.pathname, location.search]);

  function handleSubmit(event) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    const type = location.pathname === '/search' ? new URLSearchParams(location.search).get('type') || 'album' : 'album';
    navigate(`/search?${new URLSearchParams({ q, type })}`);
  }

  return (
    <header className="topbar">
      <form className="topbar-search" onSubmit={handleSubmit} role="search">
        <SearchIcon size={18} />
        <input
          type="search"
          placeholder="Search for artists, albums, or songs…"
          aria-label="Search music"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>

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
