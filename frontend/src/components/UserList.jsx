import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Avatar from './Avatar.jsx';
import FollowButton from './FollowButton.jsx';

/** List of user rows with Follow buttons. `users` is null while loading. */
export default function UserList({ users, emptyMessage, onFollowChange }) {
  const { user: currentUser } = useAuth();
  const [rows, setRows] = useState(users);

  useEffect(() => setRows(users), [users]);

  if (rows === null) {
    return (
      <div className="loading loading-inline" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading…
      </div>
    );
  }
  if (rows.length === 0) return <p className="empty-text">{emptyMessage}</p>;

  function handleChange(id, isFollowing) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, isFollowing } : row)));
    onFollowChange?.();
  }

  return (
    <ul className="user-list">
      {rows.map((row) => (
        <li key={row.id} className="user-row">
          <Link to={`/u/${row.username}`} className="user-row-link">
            <Avatar username={row.username} src={row.avatarUrl} size="md" />
            <span className="user-row-text">
              <span className="user-row-name">{row.displayName || row.username}</span>
              <span className="user-row-handle">@{row.username}</span>
              {row.bio && <span className="user-row-bio">{row.bio}</span>}
            </span>
          </Link>
          {currentUser?.id !== row.id && (
            <FollowButton
              username={row.username}
              isFollowing={row.isFollowing}
              size="sm"
              onChange={(isFollowing) => handleChange(row.id, isFollowing)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
