import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteDiaryEntry } from '../api/diary.js';
import { formatCalendarDate, formatDate, targetPath } from '../utils/format.js';
import Alert from './Alert.jsx';
import CoverArt from './CoverArt.jsx';
import DiaryEntryForm from './DiaryEntryForm.jsx';
import { EditIcon, TrashIcon } from './Icons.jsx';

function DiaryRow({ entry, editable, onUpdated, onDeleted }) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const { target } = entry;

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteDiaryEntry(entry.id);
      onDeleted(entry.id);
    } catch (err) {
      setError(err.message);
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <li className="diary-row">
      <div className="diary-day" aria-label={formatCalendarDate(entry.listenedOn)}>
        <span className="diary-day-number">{formatCalendarDate(entry.listenedOn, { day: 'numeric' })}</span>
        <span className="diary-day-weekday">{formatCalendarDate(entry.listenedOn, { weekday: 'short' })}</span>
      </div>
      <Link to={targetPath(target)} className="diary-cover-link" tabIndex={-1} aria-hidden="true">
        <CoverArt src={target.coverUrl} seed={target.mbid} alt="" className="diary-cover" />
      </Link>
      <div className="diary-body">
        <Link to={targetPath(target)} className="diary-title">
          {target.title}
        </Link>
        <p className="muted">
          {target.artistMbid ? <Link to={`/artist/${target.artistMbid}`} className="muted-link">{target.artistName}</Link> : target.artistName}
          {target.type === 'song' ? ' · Song' : ''}
        </p>
        {isEditing ? (
          <DiaryEntryForm
            entry={entry}
            idPrefix={`diary-${entry.id}`}
            onCancel={() => setIsEditing(false)}
            onSaved={(saved) => {
              setIsEditing(false);
              onUpdated(saved);
            }}
          />
        ) : (
          entry.notes && <p className="user-text diary-notes">{entry.notes}</p>
        )}
        <Alert type="error">{error}</Alert>
        {editable && !isEditing && (
          <div className="inline-actions">
            {confirmDelete ? (
              <>
                <span className="muted">Delete this diary entry?</span>
                <button type="button" className="link-button danger" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </button>
                <button type="button" className="link-button" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
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
                {entry.updatedAt && <span className="muted small">Edited {formatDate(entry.updatedAt)}</span>}
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * Diary entries grouped by month, newest first (the API already sorts them).
 * `editable` shows Edit/Delete; the backend still checks ownership.
 */
export default function DiaryList({ entries, editable = false, onUpdated, onDeleted }) {
  const groups = [];
  for (const entry of entries) {
    const month = entry.listenedOn.slice(0, 7);
    if (groups.at(-1)?.month !== month) groups.push({ month, entries: [] });
    groups.at(-1).entries.push(entry);
  }

  return (
    <div className="diary">
      {groups.map((group) => (
        <section key={group.month} className="diary-month">
          <h3 className="diary-month-title">{formatCalendarDate(`${group.month}-01`, { month: 'long', year: 'numeric' })}</h3>
          <ul className="diary-list">
            {group.entries.map((entry) => (
              <DiaryRow key={entry.id} entry={entry} editable={editable} onUpdated={onUpdated} onDeleted={onDeleted} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
