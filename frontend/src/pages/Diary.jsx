import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyDiary, setDiaryVisibility } from '../api/diary.js';
import { searchMusic } from '../api/music.js';
import Alert from '../components/Alert.jsx';
import CoverArt from '../components/CoverArt.jsx';
import DiaryEntryForm from '../components/DiaryEntryForm.jsx';
import DiaryList from '../components/DiaryList.jsx';
import { GlobeIcon, LockIcon, PlusIcon, SearchIcon } from '../components/Icons.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { releaseYear } from '../utils/format.js';

function VisibilityControl({ visibility, onChange }) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function choose(next) {
    if (next === visibility || isSaving) return;
    setIsSaving(true);
    setError('');
    try {
      onChange(await setDiaryVisibility(next));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="visibility">
      <div className="segmented" role="radiogroup" aria-label="Diary visibility">
        {[
          { id: 'public', label: 'Public', Icon: GlobeIcon },
          { id: 'private', label: 'Private', Icon: LockIcon },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={visibility === id}
            className={visibility === id ? 'is-active' : ''}
            disabled={isSaving}
            onClick={() => choose(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <p className="field-hint">
        {visibility === 'private' ? 'Only you can see your diary.' : 'Anyone can see your diary on your profile.'}
      </p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** "Add entry": search MusicBrainz for an album or song, pick it, then log the listen. */
function AddEntryPanel({ onSaved, onClose }) {
  const [type, setType] = useState('album');
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'idle' });
  const [selected, setSelected] = useState(null);

  async function handleSearch(event) {
    event.preventDefault();
    if (!query.trim()) return;
    setSelected(null);
    setState({ status: 'loading' });
    try {
      const data = await searchMusic(query.trim(), type);
      setState({ status: 'done', results: data.results.slice(0, 8) });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }

  return (
    <section className="card add-entry">
      <div className="card-header">
        <h2 className="section-title">Log a listen</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Close
        </button>
      </div>

      {selected ? (
        <div className="add-entry-selected">
          <div className="result-row is-static">
            <CoverArt src={selected.coverUrl} seed={selected.mbid} alt="" className="result-row-cover" />
            <span className="result-row-text">
              <span className="result-row-title">{selected.title}</span>
              <span className="muted">{selected.artistName}</span>
            </span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>
              Change
            </button>
          </div>
          <DiaryEntryForm targetType={type} mbid={selected.mbid} idPrefix="new-entry" onCancel={() => setSelected(null)} onSaved={onSaved} />
        </div>
      ) : (
        <>
          <form className="search-form" onSubmit={handleSearch} role="search">
            <div className="segmented" role="radiogroup" aria-label="Search for">
              {['album', 'song'].map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={type === option}
                  className={type === option ? 'is-active' : ''}
                  onClick={() => {
                    setType(option);
                    setState({ status: 'idle' });
                  }}
                >
                  {option === 'album' ? 'Album' : 'Song'}
                </button>
              ))}
            </div>
            <label className="search-input">
              <SearchIcon size={18} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search for ${type === 'album' ? 'an album' : 'a song'}…`}
                aria-label={`Search for ${type === 'album' ? 'an album' : 'a song'}`}
                maxLength={100}
                autoFocus
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={!query.trim()}>
              Search
            </button>
          </form>
          {state.status === 'loading' && <Loading inline label="Searching MusicBrainz…" />}
          {state.status === 'error' && <Alert type="error">{state.error.message}</Alert>}
          {state.status === 'done' && state.results.length === 0 && <p className="empty-text">No matches. Try different words.</p>}
          {state.status === 'done' && state.results.length > 0 && (
            <ul className="result-list">
              {state.results.map((item) => (
                <li key={item.mbid}>
                  <button type="button" className="result-row" onClick={() => setSelected(item)}>
                    <CoverArt src={item.coverUrl} seed={item.mbid} alt="" className="result-row-cover" />
                    <span className="result-row-text">
                      <span className="result-row-title">{item.title}</span>
                      <span className="muted">
                        {item.artistName}
                        {type === 'album' && item.releaseDate ? ` · ${releaseYear(item.releaseDate)}` : ''}
                        {type === 'song' && item.album ? ` · ${item.album.title}` : ''}
                      </span>
                    </span>
                    <span className="btn btn-outline btn-sm">Select</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** /diary (protected): the signed-in user's listening history. */
export default function Diary() {
  const { user } = useAuth();
  const [diary, setDiary] = useState(null);
  const [error, setError] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetchMyDiary()
      .then((data) => !cancelled && setDiary(data))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function flash(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 4000);
  }

  const sortEntries = (entries) =>
    [...entries].sort((a, b) => b.listenedOn.localeCompare(a.listenedOn) || b.id - a.id);

  return (
    <div className="narrow-wide stack">
      <div className="page-heading">
        <div>
          <h1 className="page-title">My Diary</h1>
          <p className="page-subtitle">Everything you’ve listened to, day by day.</p>
        </div>
        {diary && !isAdding && (
          <button type="button" className="btn btn-primary" onClick={() => setIsAdding(true)}>
            <PlusIcon size={16} />
            Add Entry
          </button>
        )}
      </div>

      {notice && <Alert type="success">{notice}</Alert>}

      {error ? (
        <section className="card">
          <ErrorState title="Couldn’t load your diary" message={error.message} onRetry={() => setAttempt((n) => n + 1)} />
        </section>
      ) : !diary ? (
        <Loading label="Loading your diary…" />
      ) : (
        <>
          <section className="card diary-settings">
            <div>
              <h2 className="section-title">Visibility</h2>
              <p className="muted small">
                {diary.entries.length} entr{diary.entries.length === 1 ? 'y' : 'ies'} ·{' '}
                <Link to={`/u/${user.username}?tab=diary`}>View on profile</Link>
              </p>
            </div>
            <VisibilityControl
              visibility={diary.visibility}
              onChange={(visibility) => {
                setDiary((prev) => ({ ...prev, visibility }));
                flash(visibility === 'private' ? 'Your diary is now private.' : 'Your diary is now public.');
              }}
            />
          </section>

          {isAdding && (
            <AddEntryPanel
              onClose={() => setIsAdding(false)}
              onSaved={(entry) => {
                setIsAdding(false);
                setDiary((prev) => ({ ...prev, entries: sortEntries([entry, ...prev.entries]) }));
                flash(`Added ${entry.target.title} to your diary.`);
              }}
            />
          )}

          <section className="card">
            {diary.entries.length === 0 ? (
              <EmptyState
                title="Your diary is empty"
                action={
                  <>
                    <button type="button" className="btn btn-primary" onClick={() => setIsAdding(true)}>
                      Log your first listen
                    </button>
                    <Link to="/search" className="btn btn-outline">
                      Browse music
                    </Link>
                  </>
                }
              >
                Log the albums and songs you listen to and they’ll show up here.
              </EmptyState>
            ) : (
              <DiaryList
                entries={diary.entries}
                editable
                onUpdated={(saved) => {
                  setDiary((prev) => ({ ...prev, entries: sortEntries(prev.entries.map((e) => (e.id === saved.id ? saved : e))) }));
                  flash('Diary entry updated.');
                }}
                onDeleted={(id) => {
                  setDiary((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) }));
                  flash('Diary entry deleted.');
                }}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
