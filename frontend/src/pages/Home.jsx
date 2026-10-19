import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRecentReviews } from '../api/reviews.js';
import CoverArt from '../components/CoverArt.jsx';
import ReviewCard from '../components/ReviewCard.jsx';
import { StarRating } from '../components/StarRating.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { targetPath } from '../utils/format.js';

export default function Home() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecentReviews()
      .then(setReviews)
      .catch(setError);
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="hero-content">
          <h1 className="hero-title">Discover. Review. Share.</h1>
          <p className="hero-subtitle">A community for music lovers.</p>
          <div className="hero-actions">
            <Link to="/search" className="btn btn-primary btn-lg">
              Find music
            </Link>
            {user ? (
              <Link to="/diary" className="btn btn-hero-outline btn-lg">
                My Diary
              </Link>
            ) : (
              <Link to="/signup" className="btn btn-hero-outline btn-lg">
                Get Started
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="section-title">Recently Reviewed</h2>
          <Link to="/search" className="list-footer">
            Search music →
          </Link>
        </div>
        {error ? (
          <ErrorState title="Couldn’t load reviews" message={error.message} />
        ) : !reviews ? (
          <Loading inline />
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" action={<Link to="/search" className="btn btn-outline btn-sm">Find an album</Link>}>
            Search for an album and write the first TuneBoxd review.
          </EmptyState>
        ) : (
          <div className="album-row">
            {reviews.slice(0, 5).map((review) => (
              <Link key={review.id} to={targetPath(review.target)} className="album-card album-link">
                <CoverArt src={review.target.coverUrl} seed={review.target.mbid} alt={`${review.target.title} cover`} />
                <span className="album-card-title">{review.target.title}</span>
                <span className="album-card-sub">{review.target.artistName}</span>
                <StarRating rating={review.rating} size="sm" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {reviews?.length > 0 && (
        <section className="card">
          <h2 className="section-title">Latest from the community</h2>
          <div className="review-list">
            {reviews.slice(0, 4).map((review) => (
              <ReviewCard key={review.id} review={review} showTarget />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
