// Shared pieces for album and song pages: the TuneBoxd rating summary, the
// "Write a Review / Add to Diary" panel and the list of reviews from MySQL.
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { fetchTargetReviews } from '../api/music.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatRating } from '../utils/format.js';
import Alert from './Alert.jsx';
import DiaryEntryForm from './DiaryEntryForm.jsx';
import { DiaryIcon, EditIcon } from './Icons.jsx';
import ReviewCard from './ReviewCard.jsx';
import ReviewForm from './ReviewForm.jsx';
import { StarRating } from './StarRating.jsx';
import { EmptyState, ErrorState, Loading } from './Status.jsx';

/** Loads { reviews, stats, viewerReviewId } for an album or song. */
export function useTargetReviews(targetType, mbid) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      setData(await fetchTargetReviews(targetType, mbid));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [targetType, mbid]);

  useEffect(() => {
    setData(null);
    reload();
  }, [reload]);

  return { data, error, reload };
}

export function RatingSummary({ stats }) {
  if (!stats) return null;
  if (!stats.ratingCount) return <p className="rating-summary muted">No TuneBoxd ratings yet</p>;
  return (
    <p className="rating-summary">
      <span className="rating-summary-value">{formatRating(stats.averageRating)}</span>
      <StarRating rating={Math.round(stats.averageRating * 2) / 2} />
      <span className="muted">
        {stats.ratingCount} rating{stats.ratingCount === 1 ? '' : 's'} · {stats.reviewCount} review
        {stats.reviewCount === 1 ? '' : 's'}
      </span>
    </p>
  );
}

/**
 * Action card: write/edit your review and log a listen. Logged-out visitors
 * are sent to /login and brought back here afterwards.
 */
export function TargetActions({ targetType, mbid, title, reviewsData, onReviewSaved }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [panel, setPanel] = useState(null); // 'review' | 'diary' | null
  const [notice, setNotice] = useState(null);

  const ownReview = reviewsData?.reviews.find((review) => review.id === reviewsData.viewerReviewId) ?? null;
  const noun = targetType === 'song' ? 'song' : 'album';

  function open(next) {
    if (!isAuthenticated) {
      navigate('/login', {
        state: { from: location.pathname, notice: `Log in to ${next === 'review' ? 'review' : 'log'} this ${noun}.` },
      });
      return;
    }
    setNotice(null);
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <aside className="card action-card" aria-label={`Your activity for ${title}`}>
      <h2 className="section-title">Your activity</h2>
      <div className="action-buttons">
        <button
          type="button"
          className={`btn ${panel === 'review' ? 'btn-outline' : 'btn-primary'} btn-block`}
          onClick={() => open('review')}
          disabled={isAuthenticated && !reviewsData}
          aria-expanded={panel === 'review'}
        >
          <EditIcon size={16} />
          {ownReview ? 'Edit Your Review' : 'Write a Review'}
        </button>
        <button
          type="button"
          className="btn btn-outline btn-block"
          onClick={() => open('diary')}
          aria-expanded={panel === 'diary'}
        >
          <DiaryIcon size={16} />
          Add to Diary
        </button>
      </div>

      {notice && (
        <Alert type="success">
          {notice.text} {notice.link && <Link to={notice.link.to}>{notice.link.label}</Link>}
        </Alert>
      )}

      {panel === 'review' && (
        <ReviewForm
          key={ownReview ? `edit-${ownReview.id}` : 'new'}
          targetType={targetType}
          mbid={mbid}
          review={ownReview}
          onCancel={() => setPanel(null)}
          onSaved={(saved) => {
            setPanel(null);
            setNotice({ text: ownReview ? 'Your review was updated.' : 'Your review was saved.', link: { to: `/reviews/${saved.id}`, label: 'View it' } });
            onReviewSaved?.(saved);
          }}
        />
      )}

      {panel === 'diary' && (
        <DiaryEntryForm
          targetType={targetType}
          mbid={mbid}
          onCancel={() => setPanel(null)}
          onSaved={() => {
            setPanel(null);
            setNotice({ text: `Added ${title} to your diary.`, link: { to: '/diary', label: 'Open My Diary' } });
          }}
        />
      )}
    </aside>
  );
}

export function ReviewsSection({ data, error, reload, noun = 'album' }) {
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="section-title">Reviews</h2>
        {data && <span className="pill">{data.stats.reviewCount}</span>}
      </div>
      {error ? (
        <ErrorState title="Couldn’t load reviews" message={error.message} onRetry={reload} />
      ) : !data ? (
        <Loading inline label="Loading reviews…" />
      ) : data.reviews.length === 0 ? (
        <EmptyState title="No reviews yet">Be the first to review this {noun}.</EmptyState>
      ) : (
        <div className="review-list">
          {data.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} onChanged={reload} onDeleted={reload} />
          ))}
        </div>
      )}
    </section>
  );
}
