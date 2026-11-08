import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ChartIcon, CommunityIcon, DiaryIcon, HomeIcon, ListsIcon, SearchIcon, ShieldIcon, SparkleIcon, UserIcon } from './Icons.jsx';
import Logo from './Logo.jsx';

// Sections that need a session. Admin is added for administrators.
const MEMBER_LINKS = [
  { to: '/diary', label: 'My Diary', Icon: DiaryIcon },
  { to: '/lists', label: 'Lists', Icon: ListsIcon },
  { to: '/stats', label: 'Stats', Icon: ChartIcon },
  { to: '/for-you', label: 'For You', Icon: SparkleIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
];

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
        {user &&
          MEMBER_LINKS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className="side-link">
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        <NavLink to="/community" className="side-link">
          <CommunityIcon />
          <span>Community</span>
        </NavLink>
        {user?.role === 'admin' && (
          <NavLink to="/admin" className="side-link">
            <ShieldIcon />
            <span>Admin</span>
          </NavLink>
        )}
      </nav>
    </aside>
  );
}
