import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { CommunityIcon, DiaryIcon, HomeIcon, ListsIcon, SearchIcon, UserIcon } from './Icons.jsx';
import Logo from './Logo.jsx';

// Sections planned for later sprints. Shown so the layout matches the design,
// but not clickable until those features exist.
const COMING_SOON = [{ label: 'Lists', Icon: ListsIcon }];

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      <Logo />
      <nav className="side-nav" aria-label="Sections">
        <NavLink to="/" end className="side-link">
          <HomeIcon />
          <span>Home</span>
        </NavLink>
        <NavLink to="/search" className="side-link">
          <SearchIcon />
          <span>Search</span>
        </NavLink>
        {user && (
          <NavLink to="/diary" className="side-link">
            <DiaryIcon />
            <span>My Diary</span>
          </NavLink>
        )}
        {user && (
          <NavLink to="/profile" className="side-link">
            <UserIcon />
            <span>Profile</span>
          </NavLink>
        )}
        <NavLink to="/community" className="side-link">
          <CommunityIcon />
          <span>Community</span>
        </NavLink>
        {COMING_SOON.map(({ label, Icon }) => (
          <span key={label} className="side-link is-disabled" aria-disabled="true" title="Coming soon">
            <Icon />
            <span>{label}</span>
            <span className="soon-badge">Soon</span>
          </span>
        ))}
      </nav>
    </aside>
  );
}
