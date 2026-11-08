import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createSummary, deleteSummary, fetchRecommendations, fetchSummaries, refreshRecommendations } from '../api/insights.js';
import Alert from '../components/Alert.jsx';
import CoverArt from '../components/CoverArt.jsx';
import FormField from '../components/FormField.jsx';
import { RefreshIcon, SparkleIcon, TrashIcon } from '../components/Icons.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';
import { formatCalendarDate, formatDate, releaseYear, targetPath, todayYmd } from '../utils/format.js';

/** "YYYY-MM-DD" n days before `ymd`. */
function daysBefore(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d - n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function Recommendations() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchRecommendations()
      .then(setData)
      .catch(setError);
  }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    setError(null);
    try {
      setData(await refreshRecommendations());
    } catch (err) {
      setError(err);
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2 className="section-title">Recommended for you</h2>
          {data?.generatedAt && <p className="muted small">Updated {formatDate(data.generatedAt)}</p>}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={handleRefresh} disabled={isRefreshing || !data}>
          <RefreshIcon size={15} />
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {error ? (
        <ErrorState title="Couldn’t load recommendations" message={error.message} onRetry={handleRefresh} />
      ) : !data || isRefreshing ? (
        <Loading inline label="Finding music you might like…" />
      ) : data.recommendations.length === 0 ? (
        <EmptyState title="Nothing to recommend yet" action={<Link to="/search" className="btn btn-outline btn-sm">Find music</Link>}>
          Rate albums, log listens and follow people. Recommendations come from what you and the community enjoy.
        </EmptyState>
      ) : (
        <ul className="recommendation-list">
          {data.recommendations.map((rec) => (
            <li key={rec.id}>
              <Link to={targetPath(rec.target)} className="recommendation">
                <CoverArt src={rec.target.coverUrl} seed={rec.target.mbid} alt="" className="recommendation-cover" />
                <span className="recommendation-text">
                  <span className="result-row-title">{rec.target.title}</span>
                  <span className="muted small">
                    {rec.target.artistName}
                    {rec.target.releaseDate ? ` · ${releaseYear(rec.target.releaseDate)}` : ''}
                  </span>
                  <span className="recommendation-reason">{rec.reason}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && (
        <p className="field-hint">
          <SparkleIcon size={13} />{' '}
          {data.aiEnabled
            ? 'Picked from TuneBoxd ratings, follows and your diary; explanations written by AI (Google Gemini).'
            : 'Picked from TuneBoxd ratings, follows and your diary.'}
        </p>
      )}
    </section>
  );
}

const PRESETS = [
  { id: '30', label: 'Last 30 days', days: 29 },
  { id: '90', label: 'Last 3 months', days: 89 },
  { id: '365', label: 'Last year', days: 364 },
];

function Summaries() {
  const today = todayYmd();
  const [summaries, setSummaries] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [periodStart, setPeriodStart] = useState(daysBefore(today, 29));
  const [periodEnd, setPeriodEnd] = useState(today);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchSummaries()
      .then((data) => {
        setSummaries(data.summaries);
        setAiEnabled(data.aiEnabled);
      })
      .catch(setLoadError);
  }, []);

  async function handleGenerate(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    if (!periodStart || !periodEnd) return setError('Choose a start and end date.');
    if (periodEnd < periodStart) return setError('The end date must be on or after the start date.');
    setIsGenerating(true);
    try {
      const summary = await createSummary({ periodStart, periodEnd });
      setSummaries((prev) => [summary, ...(prev ?? [])]);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSummary(id);
      setSummaries((prev) => prev.filter((summary) => summary.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="card">
      <h2 className="section-title">Listening & review summaries</h2>
      <p className="muted small">
        A short recap of what you logged, rated and reviewed in a period{aiEnabled ? ', written by AI (Google Gemini)' : ''}. Only you can see your summaries.
      </p>

      <form className="summary-form" onSubmit={handleGenerate} noValidate>
        <div className="segmented" role="group" aria-label="Quick periods">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={periodEnd === today && periodStart === daysBefore(today, preset.days) ? 'is-active' : ''}
              onClick={() => {
                setPeriodEnd(today);
                setPeriodStart(daysBefore(today, preset.days));
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="summary-dates">
          <FormField id="summary-start" label="From" type="date" min="1900-01-01" max={today} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} error={fieldErrors.periodStart} />
          <FormField id="summary-end" label="To" type="date" min="1900-01-01" max={today} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} error={fieldErrors.periodEnd} />
          <button type="submit" className="btn btn-primary" disabled={isGenerating}>
            <SparkleIcon size={16} />
            {isGenerating ? 'Writing…' : 'Generate Summary'}
          </button>
        </div>
        <Alert type="error">{error}</Alert>
      </form>

      {loadError ? (
        <ErrorState title="Couldn’t load your summaries" message={loadError.message} />
      ) : !summaries ? (
        <Loading inline />
      ) : summaries.length === 0 ? (
        <p className="empty-text">No summaries yet. Pick a period and generate one.</p>
      ) : (
        <ul className="summary-list">
          {summaries.map((summary) => (
            <li key={summary.id} className="summary-card">
              <header className="summary-card-header">
                <strong>
                  {formatCalendarDate(summary.periodStart)} – {formatCalendarDate(summary.periodEnd)}
                </strong>
                <span className="muted small">Generated {formatDate(summary.generatedAt)}</span>
                <button type="button" className="icon-button" onClick={() => handleDelete(summary.id)} aria-label="Delete summary">
                  <TrashIcon size={15} />
                </button>
              </header>
              {summary.text.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index} className="user-text">
                  {paragraph}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** /for-you (protected): personalized recommendations and listening summaries. */
export default function ForYou() {
  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1 className="page-title">For You</h1>
          <p className="page-subtitle">Music picked for your taste, and recaps of your listening.</p>
        </div>
        <Link to="/stats" className="btn btn-outline">
          View my stats
        </Link>
      </div>
      <Recommendations />
      <Summaries />
    </div>
  );
}
