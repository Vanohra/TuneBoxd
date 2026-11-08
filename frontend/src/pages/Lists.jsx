import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchMyLists, fetchRecentLists } from '../api/lists.js';
import { PlusIcon } from '../components/Icons.jsx';
import ListForm from '../components/ListForm.jsx';
import ListGrid from '../components/ListGrid.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';

/** /lists (protected): your lists, a "New list" form, and recent public lists from others. */
export default function Lists() {
  const navigate = useNavigate();
  const [lists, setLists] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchMyLists()
      .then((data) => !cancelled && setLists(data))
      .catch((err) => !cancelled && setError(err));
    fetchRecentLists()
      .then((data) => !cancelled && setRecent(data))
      .catch(() => !cancelled && setRecent([]));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const othersLists = recent?.filter((list) => !list.isOwner) ?? [];

  return (
    <div className="narrow-wide stack">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Lists</h1>
          <p className="page-subtitle">Collect albums and songs into your own rankings, themes and playlists.</p>
        </div>
        {lists && !isCreating && (
          <button type="button" className="btn btn-primary" onClick={() => setIsCreating(true)}>
            <PlusIcon size={16} />
            New List
          </button>
        )}
      </div>

      {isCreating && (
        <section className="card">
          <h2 className="section-title">New list</h2>
          <ListForm idPrefix="new-list" onCancel={() => setIsCreating(false)} onSaved={(list) => navigate(`/lists/${list.id}`)} />
        </section>
      )}

      <section className="card">
        <h2 className="section-title">Your lists</h2>
        {error ? (
          <ErrorState title="Couldn’t load your lists" message={error.message} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !lists ? (
          <Loading inline label="Loading your lists…" />
        ) : lists.length === 0 ? (
          <EmptyState
            title="No lists yet"
            action={
              !isCreating && (
                <button type="button" className="btn btn-primary" onClick={() => setIsCreating(true)}>
                  Create your first list
                </button>
              )
            }
          >
            Make a list, then add albums and songs from any album or song page.
          </EmptyState>
        ) : (
          <ListGrid lists={lists} />
        )}
      </section>

      {othersLists.length > 0 && (
        <section className="card">
          <h2 className="section-title">Recently updated by the community</h2>
          <ListGrid lists={othersLists} showOwner />
        </section>
      )}
    </div>
  );
}
