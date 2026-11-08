import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchAdminUsers, fetchReports, resolveReport, updateAdminUser } from '../api/admin.js';
import Alert from '../components/Alert.jsx';
import Avatar from '../components/Avatar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { SearchIcon } from '../components/Icons.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';
import { formatDate, targetPath } from '../utils/format.js';

const REPORT_FILTERS = [
  { id: 'pending', label: 'Pending' },
  { id: 'removed', label: 'Removed' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
];

const STATUS_LABELS = { pending: 'Pending', dismissed: 'Dismissed', removed: 'Removed', reviewed: 'Closed' };

function ReportCard({ report, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { review } = report;

  async function act(action) {
    setBusy(true);
    setError('');
    try {
      onResolved(await resolveReport(report.id, action), action);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <article className="report-card">
      <header className="report-card-header">
        <span className={`status-badge status-${report.status}`}>{STATUS_LABELS[report.status]}</span>
        <span className="report-reason-label">{report.reasonLabel}</span>
        <span className="muted small">
          reported by <Link to={`/u/${report.reporter.username}`}>@{report.reporter.username}</Link> · {formatDate(report.createdAt)}
          {review.reportCount > 1 && ` · ${review.reportCount} reports on this review`}
        </span>
      </header>
      {report.details && <p className="report-details user-text">“{report.details}”</p>}

      <div className={`reported-review${review.isRemoved ? ' is-removed' : ''}`}>
        <p className="muted small">
          <Link to={`/u/${review.author.username}`} className="review-author">
            <Avatar username={review.author.username} src={review.author.avatarUrl} size="sm" />
            {review.author.displayName || review.author.username}
          </Link>{' '}
          on <Link to={targetPath(review.target)}>{review.target.title}</Link> · {formatDate(review.createdAt)}
          {review.author.accountStatus === 'suspended' && ' · author suspended'}
        </p>
        <p className="user-text review-text">{review.text}</p>
        {!review.isRemoved && (
          <Link to={`/reviews/${review.id}`} className="small">
            Open review →
          </Link>
        )}
      </div>

      <Alert type="error">{error}</Alert>
      <footer className="form-actions">
        {report.status === 'pending' && (
          <>
            <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => act('dismiss')}>
              Dismiss report
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => act('remove')}>
              Remove review
            </button>
          </>
        )}
        {review.isRemoved && (
          <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => act('restore')}>
            Restore review
          </button>
        )}
        {report.status !== 'pending' && report.moderator && (
          <span className="muted small">
            Handled by @{report.moderator.username} {report.resolvedAt ? `· ${formatDate(report.resolvedAt)}` : ''}
          </span>
        )}
      </footer>
    </article>
  );
}

function ReportsPanel() {
  const [status, setStatus] = useState('pending');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setError(null);
    fetchReports(status)
      .then(setData)
      .catch(setError);
  }, [status]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const messages = { dismiss: 'Report dismissed. The review stays up.', remove: 'Review removed.', restore: 'Review restored.' };

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="section-title">Review reports</h2>
        <div className="segmented" role="radiogroup" aria-label="Filter reports">
          {REPORT_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="radio"
              aria-checked={status === filter.id}
              className={status === filter.id ? 'is-active' : ''}
              onClick={() => setStatus(filter.id)}
            >
              {filter.label}
              {filter.id === 'pending' && data?.counts.pending ? <span className="count-badge">{data.counts.pending}</span> : null}
            </button>
          ))}
        </div>
      </div>
      {notice && <Alert type="success">{notice}</Alert>}
      {error ? (
        <ErrorState title="Couldn’t load reports" message={error.message} onRetry={load} />
      ) : !data ? (
        <Loading inline label="Loading reports…" />
      ) : data.reports.length === 0 ? (
        <EmptyState title={status === 'pending' ? 'All caught up' : 'Nothing here'}>
          {status === 'pending' ? 'There are no reports waiting for review.' : 'No reports match this filter.'}
        </EmptyState>
      ) : (
        <div className="report-list">
          {data.reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onResolved={(_, action) => {
                setNotice(messages[action]);
                // Reload: a handled report leaves the pending queue, and other reports on the same review change too.
                load();
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function UserRow({ account, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(null); // { label, changes }

  async function apply(changes) {
    setBusy(true);
    setError('');
    try {
      onChanged(await updateAdminUser(account.id, changes));
      setConfirm(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const suspended = account.accountStatus === 'suspended';
  const isAdmin = account.role === 'admin';

  return (
    <tr className={suspended ? 'is-suspended' : ''}>
      <td>
        <Link to={`/u/${account.username}`} className="review-author">
          <Avatar username={account.username} src={account.avatarUrl} size="sm" />
          <span>
            <span className="user-row-name">{account.displayName || account.username}</span>
            <span className="muted small block">@{account.username}</span>
          </span>
        </Link>
      </td>
      <td className="muted small">{account.email}</td>
      <td>
        <span className={`status-badge ${suspended ? 'status-removed' : 'status-active'}`}>{suspended ? 'Suspended' : 'Active'}</span>
        {isAdmin && <span className="status-badge status-admin">Admin</span>}
      </td>
      <td className="numeric">{account.reviewCount}</td>
      <td className="numeric">{account.flaggedCount > 0 ? <strong>{account.flaggedCount}</strong> : 0}</td>
      <td className="muted small">{formatDate(account.createdAt)}</td>
      <td>
        {confirm ? (
          <span className="inline-actions">
            <span className="small">{confirm.label}?</span>
            <button type="button" className="link-button danger" disabled={busy} onClick={() => apply(confirm.changes)}>
              Confirm
            </button>
            <button type="button" className="link-button" onClick={() => setConfirm(null)}>
              Cancel
            </button>
          </span>
        ) : account.isSelf ? (
          <span className="muted small">You</span>
        ) : (
          <span className="inline-actions">
            {suspended ? (
              <button type="button" className="link-button" disabled={busy} onClick={() => apply({ accountStatus: 'active' })}>
                Reactivate
              </button>
            ) : (
              <button
                type="button"
                className="link-button danger"
                onClick={() => setConfirm({ label: `Suspend @${account.username}`, changes: { accountStatus: 'suspended' } })}
              >
                Suspend
              </button>
            )}
            <button
              type="button"
              className="link-button"
              onClick={() =>
                setConfirm(
                  isAdmin
                    ? { label: `Remove admin from @${account.username}`, changes: { role: 'user' } }
                    : { label: `Make @${account.username} an admin`, changes: { role: 'admin' } },
                )
              }
            >
              {isAdmin ? 'Remove admin' : 'Make admin'}
            </button>
          </span>
        )}
        {error && <p className="field-error">{error}</p>}
      </td>
    </tr>
  );
}

function UsersPanel({ currentUserId }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setError(null);
    fetchAdminUsers(submitted)
      .then(setUsers)
      .catch(setError);
  }, [submitted]);

  useEffect(() => {
    setUsers(null);
    load();
  }, [load]);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="section-title">Accounts</h2>
        <form
          className="search-input admin-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(query.trim());
          }}
        >
          <SearchIcon size={16} />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Username, name or email" aria-label="Search accounts" maxLength={100} />
        </form>
      </div>
      <p className="field-hint">Suspended members are signed out immediately; their reviews and comments are hidden until they’re reactivated.</p>
      {error ? (
        <ErrorState title="Couldn’t load accounts" message={error.message} onRetry={load} />
      ) : !users ? (
        <Loading inline label="Loading accounts…" />
      ) : users.length === 0 ? (
        <EmptyState title="No matching accounts" />
      ) : (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Email</th>
                <th scope="col">Status</th>
                <th scope="col" className="numeric">Reviews</th>
                <th scope="col" className="numeric" title="Reviews with pending or upheld reports">Flagged</th>
                <th scope="col">Joined</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <UserRow
                  key={account.id}
                  account={{ ...account, isSelf: account.id === currentUserId }}
                  onChanged={(updated) => setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** /admin (administrators only): report moderation and account management. */
export default function Admin() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'users' ? 'users' : 'reports';

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Admin</h1>
          <p className="page-subtitle">Review reported content and manage member accounts.</p>
        </div>
      </div>
      <nav className="tabs tabs-plain" aria-label="Admin sections">
        {[
          { id: 'reports', label: 'Reports' },
          { id: 'users', label: 'Accounts' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`tab${tab === item.id ? ' is-active' : ''}`}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => setSearchParams(item.id === 'reports' ? {} : { tab: item.id }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {tab === 'reports' ? <ReportsPanel /> : <UsersPanel currentUserId={user.id} />}
    </div>
  );
}
