import { useEffect, useState } from 'react';
import { fetchReportReasons, reportReview } from '../api/reviews.js';
import { REPORT_DETAILS_MAX_LENGTH } from '../utils/validation.js';
import Alert from './Alert.jsx';

/**
 * Report a review to the administrators (feature #17, client requirement CR-02).
 * `onReported(message)` runs after the server accepts the report.
 */
export default function ReportReviewForm({ reviewId, onReported, onCancel }) {
  const [reasons, setReasons] = useState(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchReportReasons()
      .then(setReasons)
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (!reason) return setError('Please choose a reason.');
    if (reason === 'other' && !details.trim()) return setError('Please tell us what’s wrong with this review.');
    if (details.trim().length > REPORT_DETAILS_MAX_LENGTH) {
      return setError(`Details must be ${REPORT_DETAILS_MAX_LENGTH} characters or fewer.`);
    }
    setIsSaving(true);
    try {
      const { message } = await reportReview(reviewId, { reason, details });
      onReported(message);
    } catch (err) {
      setError(err.message);
      setIsSaving(false);
    }
  }

  return (
    <form className="report-form" onSubmit={handleSubmit} noValidate>
      <p className="report-form-title">Why are you reporting this review?</p>
      <Alert type="error">{error}</Alert>
      {reasons && (
        <div className="report-reasons" role="radiogroup" aria-label="Report reason">
          {reasons.map((option) => (
            <label key={option.id} className="report-reason">
              <input type="radio" name={`report-${reviewId}`} value={option.id} checked={reason === option.id} onChange={() => setReason(option.id)} />
              {option.label}
            </label>
          ))}
        </div>
      )}
      <div className="field">
        <label htmlFor={`report-details-${reviewId}`}>Details {reason === 'other' ? '' : '(optional)'}</label>
        <textarea id={`report-details-${reviewId}`} rows={2} value={details} onChange={(event) => setDetails(event.target.value)} />
        <p className={`field-hint align-right${details.trim().length > REPORT_DETAILS_MAX_LENGTH ? ' is-over' : ''}`}>
          {details.trim().length}/{REPORT_DETAILS_MAX_LENGTH}
        </p>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving || !reasons}>
          {isSaving ? 'Sending…' : 'Send Report'}
        </button>
      </div>
    </form>
  );
}
