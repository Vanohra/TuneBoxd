/** Shared loading / empty / error states so every page handles them the same way. */

export function Loading({ label = 'Loading…', inline = false }) {
  return (
    <div className={`loading${inline ? ' loading-inline' : ''}`} role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      {title && <p className="empty-state-title">{title}</p>}
      {children && <p className="empty-text">{children}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="empty-state" role="alert">
      <p className="empty-state-title">{title}</p>
      {message && <p className="empty-text">{message}</p>}
      {onRetry && (
        <div className="empty-state-action">
          <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
