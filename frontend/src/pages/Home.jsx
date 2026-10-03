import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Decorative placeholder covers. Real album data arrives in a later sprint.
const PLACEHOLDER_COVERS = [
  ['#1f3b5c', '#0b1626'],
  ['#3a3a3a', '#111'],
  ['#8bd400', '#4f7a00'],
  ['#3d7bd9', '#c98f5e'],
  ['#9aa0a6', '#3c4043'],
];

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-content">
          <h1 className="hero-title">Discover. Review. Share.</h1>
          <p className="hero-subtitle">A community for music lovers.</p>
          {user ? (
            <Link to="/profile" className="btn btn-primary btn-lg">
              Go to your profile
            </Link>
          ) : (
            <Link to="/signup" className="btn btn-primary btn-lg">
              Get Started
            </Link>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="section-title">Trending Albums</h2>
          <span className="pill">Coming soon</span>
        </div>
        <div className="album-row">
          {PLACEHOLDER_COVERS.map(([from, to], index) => (
            <div key={index} className="album-card" aria-hidden="true">
              <div className="album-cover" style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}>
                <span className="album-disc" />
              </div>
              <span className="skeleton skeleton-title" />
              <span className="skeleton skeleton-sub" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
