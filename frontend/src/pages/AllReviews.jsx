import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchRecentReviews } from '../api/reviews.js';
import ReviewCard from '../components/ReviewCard.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';

const PAGE_SIZE = 20;

/** /reviews: every review on TuneBoxd, newest first, loaded a page at a time. */
export default function AllReviews() {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchRecentReviews({ limit: PAGE_SIZE, offset: 0 })
      .then((page) => {
        setReviews(page);
        setHasMore(page.length === PAGE_SIZE);
      })
      .catch(setError);
  }, []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const page = await fetchRecentReviews({ limit: PAGE_SIZE, offset: reviews.length });
      setReviews((current) => {
        const seen = new Set(current.map((review) => review.id));
        return [...current, ...page.filter((review) => !seen.has(review.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch (err) {
      setError(err);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="narrow-wide">
      <h1 className="page-title">All Reviews</h1>
      <p className="page-subtitle">Everything the TuneBoxd community has written, newest first.</p>
      <section className="card">
        {error && !reviews ? (
          <ErrorState title="Couldn’t load reviews" message={error.message} />
        ) : !reviews ? (
          <Loading inline />
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" action={<Link to="/search" className="btn btn-outline btn-sm">Find an album</Link>}>
            Search for an album and write the first TuneBoxd review.
          </EmptyState>
        ) : (
          <>
            <div className="review-list">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} showTarget />
              ))}
            </div>
            {error && <p className="empty-text">{error.message}</p>}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
