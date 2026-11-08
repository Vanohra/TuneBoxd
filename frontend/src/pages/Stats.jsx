import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyStats } from '../api/insights.js';
import StatsView from '../components/StatsView.jsx';
import { ErrorState, Loading } from '../components/Status.jsx';

/** /stats (protected): your listening statistics, from your diary. */
export default function Stats() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchMyStats()
      .then((data) => !cancelled && setStats(data))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Listening Stats</h1>
          <p className="page-subtitle">
            Built from your <Link to="/diary">listening diary</Link>. They follow your diary’s privacy setting.
          </p>
        </div>
        <Link to="/for-you" className="btn btn-outline">
          Get a summary
        </Link>
      </div>
      {error ? (
        <section className="card">
          <ErrorState title="Couldn’t load your statistics" message={error.message} onRetry={() => setAttempt((n) => n + 1)} />
        </section>
      ) : !stats ? (
        <Loading label="Crunching your listening history…" />
      ) : (
        <StatsView stats={stats} />
      )}
    </div>
  );
}
