import { useState } from 'react';
import { createReview, updateReview } from '../api/reviews.js';
import { REVIEW_MAX_LENGTH, validateReview } from '../utils/validation.js';
import Alert from './Alert.jsx';
import { RatingInput } from './StarRating.jsx';

/**
 * Write a new review (pass targetType + mbid) or edit one (pass `review`).
 * `onSaved(review)` runs only after the backend confirms the save.
 */
export default function ReviewForm({ targetType, mbid, review, onSaved, onCancel }) {
  const isEdit = Boolean(review);
  const [rating, setRating] = useState(review?.rating ?? null);
  const [text, setText] = useState(review?.text ?? '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const validation = validateReview({ text, rating });
    if (validation.error) {
      setFieldErrors(validation.fieldErrors);
      setError(validation.error);
      return;
    }
    setIsSaving(true);
    try {
      const saved = isEdit
        ? await updateReview(review.id, { text, rating })
        : await createReview({ targetType, mbid, text, rating });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setIsSaving(false);
    }
  }

  const tooLong = text.trim().length > REVIEW_MAX_LENGTH;

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <Alert type="error">{error}</Alert>

      <div className={`field${fieldErrors.rating ? ' field-invalid' : ''}`}>
        <label htmlFor="review-rating">Your rating</label>
        <RatingInput
          id="review-rating"
          value={rating}
          invalid={Boolean(fieldErrors.rating)}
          onChange={(value) => {
            setRating(value);
            setFieldErrors((prev) => ({ ...prev, rating: null }));
          }}
        />
        {fieldErrors.rating && <p className="field-error">{fieldErrors.rating}</p>}
      </div>

      <div className={`field${fieldErrors.text ? ' field-invalid' : ''}`}>
        <label htmlFor="review-text">Your review</label>
        <textarea
          id="review-text"
          rows={6}
          placeholder="What did you think?"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setFieldErrors((prev) => ({ ...prev, text: null }));
          }}
          aria-invalid={Boolean(fieldErrors.text)}
          aria-describedby="review-text-count"
        />
        <p id="review-text-count" className={`field-hint align-right${tooLong ? ' is-over' : ''}`}>
          {text.trim().length}/{REVIEW_MAX_LENGTH}
        </p>
        {fieldErrors.text && <p className="field-error">{fieldErrors.text}</p>}
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Post Review'}
        </button>
      </div>
    </form>
  );
}
