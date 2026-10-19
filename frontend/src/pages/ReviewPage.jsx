import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchReview } from '../api/reviews.js';
import ReviewCard from '../components/ReviewCard.jsx';
import { ErrorState, Loading } from '../components/Status.jsx';
import { targetPath } from '../utils/format.js';

/** /reviews/:id: one review with its comments open. */
export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setReview(null);
    setError(null);
    fetchReview(id)
      .then((data) => !cancelled && setReview(data))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <section className="card narrow">
        <ErrorState
          title={error.status === 404 ? 'Review not found' : 'Couldn’t load this review'}
          message={error.status === 404 ? 'It may have been deleted or removed.' : error.message}
        />
      </section>
    );
  }
  if (!review) return <Loading label="Loading review…" />;

  return (
    <div className="narrow-wide stack">
      <p>
        <Link to={targetPath(review.target)}>← Back to {review.target.title}</Link>
      </p>
      <section className="card">
        <ReviewCard
          review={review}
          showTarget
          commentsOpen
          onDeleted={() => navigate(targetPath(review.target), { replace: true })}
        />
      </section>
    </div>
  );
}
