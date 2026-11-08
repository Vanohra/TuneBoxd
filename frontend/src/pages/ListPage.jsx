import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteList, fetchList, removeListItem, reorderList } from '../api/lists.js';
import Alert from '../components/Alert.jsx';
import Avatar from '../components/Avatar.jsx';
import CoverArt from '../components/CoverArt.jsx';
import { ArrowDownIcon, ArrowUpIcon, EditIcon, GlobeIcon, LockIcon, TrashIcon } from '../components/Icons.jsx';
import ListForm from '../components/ListForm.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';
import { formatDate, releaseYear, targetPath } from '../utils/format.js';

function ListItemRow({ item, index, count, isOwner, busy, onMove, onRemove }) {
  const { target } = item;
  return (
    <li className="list-item">
      <span className="list-item-rank">{index + 1}</span>
      <Link to={targetPath(target)} className="list-item-link">
        <CoverArt src={target.coverUrl} seed={target.mbid} alt="" className="result-row-cover" />
        <span className="result-row-text">
          <span className="result-row-title">{target.title}</span>
          <span className="muted">
            {target.artistName}
            {target.type === 'album' && target.releaseDate ? ` · ${releaseYear(target.releaseDate)}` : ''}
            {target.type === 'song' ? ' · Song' : ''}
          </span>
        </span>
      </Link>
      {isOwner && (
        <span className="list-item-actions">
          <button type="button" className="icon-button" onClick={() => onMove(index, -1)} disabled={busy || index === 0} aria-label={`Move ${target.title} up`}>
            <ArrowUpIcon size={16} />
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => onMove(index, 1)}
            disabled={busy || index === count - 1}
            aria-label={`Move ${target.title} down`}
          >
            <ArrowDownIcon size={16} />
          </button>
          <button type="button" className="icon-button danger" onClick={() => onRemove(item)} disabled={busy} aria-label={`Remove ${target.title}`}>
            <TrashIcon size={16} />
          </button>
        </span>
      )}
    </li>
  );
}

/** /lists/:id: a list and its items. Owners can edit, reorder, remove items and delete it. */
export default function ListPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setList(null);
    setError(null);
    fetchList(id)
      .then((data) => !cancelled && setList(data))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function run(action, successMessage) {
    setBusy(true);
    setActionError('');
    try {
      setList(await action());
      setNotice(successMessage);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleMove(index, delta) {
    const keys = list.items.map((item) => item.key);
    [keys[index], keys[index + delta]] = [keys[index + delta], keys[index]];
    // Show the new order right away; the server's answer replaces it.
    const byKey = new Map(list.items.map((item) => [item.key, item]));
    setList((prev) => ({ ...prev, items: keys.map((key) => byKey.get(key)) }));
    run(() => reorderList(list.id, keys), '');
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteList(list.id);
      navigate('/lists', { replace: true });
    } catch (err) {
      setActionError(err.message);
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (error) {
    return (
      <section className="card narrow">
        <ErrorState
          title={error.status === 404 ? 'List not found' : 'Couldn’t load this list'}
          message={error.status === 404 ? 'This list doesn’t exist, or it’s private.' : error.message}
        />
        <p className="center">
          <Link to="/lists" className="btn btn-outline">
            Browse lists
          </Link>
        </p>
      </section>
    );
  }
  if (!list) return <Loading label="Loading list…" />;

  return (
    <div className="narrow-wide stack">
      <section className="card">
        {isEditing ? (
          <>
            <h1 className="section-title">Edit list</h1>
            <ListForm
              list={list}
              idPrefix="edit-list"
              onCancel={() => setIsEditing(false)}
              onSaved={(saved) => {
                setList(saved);
                setIsEditing(false);
                setNotice('List updated.');
              }}
            />
          </>
        ) : (
          <div className="list-header">
            <div>
              <p className="eyebrow">
                {list.isPublic ? <GlobeIcon size={13} /> : <LockIcon size={13} />} {list.isPublic ? 'Public list' : 'Private list'}
              </p>
              <h1 className="page-title">{list.title}</h1>
              <p className="list-owner">
                <Link to={`/u/${list.owner.username}?tab=lists`} className="review-author">
                  <Avatar username={list.owner.username} src={list.owner.avatarUrl} size="sm" />
                  <span>{list.owner.displayName || list.owner.username}</span>
                </Link>
                <span className="muted small">
                  {list.items.length} item{list.items.length === 1 ? '' : 's'} · Updated {formatDate(list.updatedAt)}
                </span>
              </p>
              {list.description && <p className="user-text list-description">{list.description}</p>}
            </div>
            {list.isOwner && (
              <div className="inline-actions">
                {confirmDelete ? (
                  <>
                    <span className="muted">Delete this list?</span>
                    <button type="button" className="link-button danger" onClick={handleDelete} disabled={busy}>
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
              </div>
            )}
          </div>
        )}
      </section>

      {notice && <Alert type="success">{notice}</Alert>}
      <Alert type="error">{actionError}</Alert>

      <section className="card">
        {list.items.length === 0 ? (
          <EmptyState
            title="This list is empty"
            action={
              list.isOwner && (
                <Link to="/search" className="btn btn-outline btn-sm">
                  Find music to add
                </Link>
              )
            }
          >
            {list.isOwner ? 'Open any album or song and choose “Add to List”.' : 'Nothing has been added yet.'}
          </EmptyState>
        ) : (
          <ol className="list-items">
            {list.items.map((item, index) => (
              <ListItemRow
                key={item.key}
                item={item}
                index={index}
                count={list.items.length}
                isOwner={list.isOwner}
                busy={busy}
                onMove={handleMove}
                onRemove={(removed) => run(() => removeListItem(list.id, removed.key), `Removed ${removed.target.title}.`)}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
