import { useState } from 'react';
import { formatRating } from '../utils/format.js';

// TuneBoxd ratings: 0.5–5 stars in half-star steps (the same scale the API
// validates and MySQL's ratings.score CHECK constraint enforces).
const STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

/** Read-only stars, e.g. ★★★★½. */
export function StarRating({ rating, size = 'md' }) {
  if (rating == null) return null;
  return (
    <span
      className={`stars stars-${size}`}
      style={{ '--fill': `${(rating / 5) * 100}%` }}
      role="img"
      aria-label={`${formatRating(rating)} out of 5 stars`}
    />
  );
}

/**
 * Star picker: each star has a left half (x.5) and a right half (x.0).
 * Keyboard users can use the arrow keys on the focused radio group.
 */
export function RatingInput({ id, value, onChange, invalid }) {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value ?? 0;

  function handleKeyDown(event) {
    const current = value ?? 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(Math.min(5, current + 0.5));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(Math.max(0.5, current - 0.5));
    }
  }

  return (
    <div className="rating-input">
      <div
        id={id}
        className={`rating-input-stars${invalid ? ' is-invalid' : ''}`}
        role="radiogroup"
        aria-label="Rating"
        aria-invalid={invalid || undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHover(null)}
      >
        <span className="stars stars-lg" style={{ '--fill': `${(shown / 5) * 100}%` }} aria-hidden="true" />
        <span className="rating-input-hits">
          {STEPS.map((step) => (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={value === step}
              aria-label={`${formatRating(step)} star${step === 1 ? '' : 's'}`}
              tabIndex={-1}
              onMouseEnter={() => setHover(step)}
              onFocus={() => setHover(step)}
              onBlur={() => setHover(null)}
              onClick={() => onChange(step)}
            />
          ))}
        </span>
      </div>
      <span className="rating-input-value">{shown ? `${formatRating(shown)} / 5` : 'Not rated'}</span>
    </div>
  );
}
