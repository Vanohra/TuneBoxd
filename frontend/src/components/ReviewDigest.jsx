import { useEffect, useState } from 'react';
import { fetchTargetDigest } from '../api/music.js';
import { WandIcon } from './Icons.jsx';

const OVERALL_LABELS = { positive: 'Mostly positive', mixed: 'Mixed', negative: 'Mostly negative' };

/**
 * "What listeners are saying": Google Gemini's summary of every review of an
 * album or song. Hidden when there's no digest (too few reviews, or AI off).
 */
export default function ReviewDigest({ targetType, mbid }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchTargetDigest(targetType, mbid)
      .then((data) => !cancelled && setState({ status: 'done', digest: data.digest }))
      .catch(() => !cancelled && setState({ status: 'done', digest: null }));
    return () => {
      cancelled = true;
    };
  }, [targetType, mbid]);

  if (state.status === 'loading') {
    return (
      <div className="review-digest is-loading" role="status">
        <WandIcon size={16} /> Summarizing what listeners are saying…
      </div>
    );
  }
  const { digest } = state;
  if (!digest) return null;

  return (
    <section className="review-digest" aria-label="AI summary of reviews">
      <header className="review-digest-header">
        <span className="review-digest-title">
          <WandIcon size={16} /> What listeners are saying
        </span>
        <span className={`sentiment-chip sentiment-${digest.overall}`}>{OVERALL_LABELS[digest.overall] ?? 'Mixed'}</span>
      </header>
      <p className="review-digest-summary">{digest.summary}</p>
      {(digest.liked.length > 0 || digest.disliked.length > 0) && (
        <div className="review-digest-points">
          {digest.liked.length > 0 && (
            <div>
              <p className="review-digest-label">Praised</p>
              <ul>
                {digest.liked.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}
          {digest.disliked.length > 0 && (
            <div>
              <p className="review-digest-label">Criticized</p>
              <ul>
                {digest.disliked.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="field-hint">
        AI summary (Google Gemini) of {digest.reviewCount} review{digest.reviewCount === 1 ? '' : 's'}
        {digest.isStale ? ' · newer reviews not included yet' : ''}. It can make mistakes; read the reviews below.
      </p>
    </section>
  );
}
