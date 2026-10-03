import { useEffect, useState } from 'react';
import { fetchMembers } from '../api/users.js';
import UserList from '../components/UserList.jsx';

/** Member directory so people can find others to follow. */
export default function Community() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMembers()
      .then(setUsers)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="narrow-wide">
      <h1 className="page-title">Community</h1>
      <p className="page-subtitle">Find people to follow on TuneBoxd.</p>
      <section className="card">
        {error ? <p className="empty-text">{error}</p> : <UserList users={users} emptyMessage="No other members yet." />}
      </section>
    </div>
  );
}
