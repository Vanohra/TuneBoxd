import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { addListItem, fetchList, fetchMyListsFor, removeListItem } from '../api/lists.js';
import Alert from './Alert.jsx';
import { LockIcon, PlusIcon } from './Icons.jsx';
import ListForm from './ListForm.jsx';
import { Loading } from './Status.jsx';

/**
 * Album/song page panel: tick the lists this item belongs in, or make a new
 * list and add it straight away.
 */
export default function AddToListPanel({ targetType, mbid, title, onClose }) {
  const [lists, setLists] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyListsFor(targetType, mbid)
      .then((data) => {
        if (cancelled) return;
        setLists(data);
        if (data.length === 0) setIsCreating(true);
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [targetType, mbid]);

  async function toggle(list) {
    setPendingId(list.id);
    setError('');
    setNotice('');
    try {
      if (list.hasTarget) {
        // Removing needs the item's key, which comes with the full list.
        const full = await fetchList(list.id);
        const item = full.items.find((entry) => entry.target.mbid === mbid && entry.target.type === targetType);
        if (item) await removeListItem(list.id, item.key);
        setNotice(`Removed from ${list.title}.`);
      } else {
        await addListItem(list.id, { targetType, mbid });
        setNotice(`Added ${title} to ${list.title}.`);
      }
      setLists((prev) => prev.map((entry) => (entry.id === list.id ? { ...entry, hasTarget: !list.hasTarget } : entry)));
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  async function handleCreated(list) {
    setIsCreating(false);
    try {
      await addListItem(list.id, { targetType, mbid });
      setLists((prev) => [{ ...list, hasTarget: true }, ...(prev ?? [])]);
      setNotice(`Created ${list.title} and added ${title}.`);
    } catch (err) {
      setLists((prev) => [{ ...list, hasTarget: false }, ...(prev ?? [])]);
      setError(err.message);
    }
  }

  return (
    <div className="add-to-list">
      {notice && <Alert type="success">{notice}</Alert>}
      <Alert type="error">{error}</Alert>
      {!lists && !error && <Loading inline label="Loading your lists…" />}
      {lists && lists.length > 0 && (
        <ul className="list-picker">
          {lists.map((list) => (
            <li key={list.id}>
              <label className="list-picker-row">
                <input type="checkbox" checked={list.hasTarget} disabled={pendingId !== null} onChange={() => toggle(list)} />
                <span className="list-picker-title">
                  {list.title}
                  {!list.isPublic && <LockIcon size={13} aria-label="Private" />}
                </span>
                <Link to={`/lists/${list.id}`} className="muted small">
                  View
                </Link>
              </label>
            </li>
          ))}
        </ul>
      )}
      {lists &&
        (isCreating ? (
          <ListForm idPrefix="quick-list" submitLabel="Create & Add" onCancel={lists.length ? () => setIsCreating(false) : onClose} onSaved={handleCreated} />
        ) : (
          <button type="button" className="link-button" onClick={() => setIsCreating(true)}>
            <PlusIcon size={15} />
            New list
          </button>
        ))}
    </div>
  );
}
