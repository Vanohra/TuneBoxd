import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteReview } from '../api/reviews.js';
import { formatDate, releaseYear, targetPath } from '../utils/format.js';
import Alert from './Alert.jsx';
import Avatar from './Avatar.jsx';
import CommentSection from './CommentSection.jsx';
import CoverArt from './CoverArt.jsx';
import { CommentIcon, EditIcon, TrashIcon } from './Icons.jsx';
import ReviewForm from './ReviewForm.jsx';
import { StarRating } from './StarRating.jsx';

/**
 * One review: author, rating, date, text, owner-only Edit/Delete, and a
 * collapsible comment section. `showTarget` adds the album/song it's about
 * (used on profiles and the home page).
 */
export default function ReviewCard({ review: initial, showTarget = false, commentsOpen = false, onChanged, onDeleted }) {
  const [review, setReview] = useState(initial);
  const [isEditing, setIsEditing] = useState(false);
  const [showComments, setShowComments] = useState(commentsOpen);
  const [commentCount, setCommentCount] = useState(initial.commentCount);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Pick up fresh data when the parent reloads (e.g. after editing from the album page panel).
  useEffect(() => {
    setReview(initial);
    setCommentCount(initial.commentCount);
  }, [initial]);

  const edited = new Date(review.updatedAt) - new Date(review.createdAt) > 1000;
  const { target } = review;

  async function handleDelete() {
    try {
      await deleteReview(review.id);
      onDeleted?.(review.id);
    } catch (err) {
      setError(err.message);
      setConfirmDelete(false);
    }
  }

  return (
    <article className="review-card">
      {showTarget && (
        <Link to={targetPath(target)} className="review-target">
          <CoverArt src={target.coverUrl} seed={target.mbid} alt="" className="review-target-cover" />
          <span className="review-target-text">
            <span className="review-target-title">{target.title}</span>
            <span className="muted">
              {target.artistName}
              {target.type === 'album' && target.releaseDate ? ` · ${releaseYear(target.releaseDate)}` : ''}
              {target.type === 'song' ? ' · Song' : ''}
            </span>
          </span>
        </Link>
      )}

      <header className="review-header">
        <Link to={`/u/${review.author.username}`} className="review-author">
          <Avatar username={review.author.username} src={review.author.avatarUrl} size="sm" />
          <span className="review-author-name">{review.author.displayName || review.author.username}</span>
        </Link>
        <StarRating rating={review.rating} size="sm" />
        <Link to={`/reviews/${review.id}`} className="muted review-date" title={edited ? `Edited ${formatDate(review.updatedAt)}` : undefined}>
          {formatDate(review.createdAt)}
          {edited ? ' · edited' : ''}
        </Link>
      </header>

      {notice && <Alert type="success">{notice}</Alert>}
      <Alert type="error">{error}</Alert>

      {isEditing ? (
        <ReviewForm
          review={review}
          onCancel={() => setIsEditing(false)}
          onSaved={(saved) => {
            setReview(saved);
            setIsEditing(false);
            setNotice('Your review was updated.');
            onChanged?.(saved);
          }}
        />
      ) : (
        <p className="user-text review-text">{review.text}</p>
      )}

      {!isEditing && (
        <footer className="review-footer">
          <button
            type="button"
            className="link-button"
            aria-expanded={showComments}
            onClick={() => setShowComments((open) => !open)}
          >
            <CommentIcon size={16} />
            {commentCount === 0 ? 'Comment' : `${commentCount} comment${commentCount === 1 ? '' : 's'}`}
          </button>

          {review.isOwner && (
            <span className="inline-actions">
              {confirmDelete ? (
                <>
                  <span className="muted">Delete this review and its comments?</span>
                  <button type="button" className="link-button danger" onClick={handleDelete}>
                    Delete
                  </button>
                  <button type="button" className="link-button" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="link-button" onClick={() => setIsEditing(true)}>
                    <EditIcon size={15} />
                    Edit
                  </button>
                  <button type="button" className="link-button" onClick={() => setConfirmDelete(true)}>
                    <TrashIcon size={15} />
                    Delete
                  </button>
                </>
              )}
            </span>
          )}
        </footer>
      )}

      {showComments && <CommentSection reviewId={review.id} onCountChange={setCommentCount} />}
    </article>
  );
}
