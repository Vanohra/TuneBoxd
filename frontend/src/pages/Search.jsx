import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { searchMusic } from '../api/music.js';
import CoverArt from '../components/CoverArt.jsx';
import { SearchIcon, UserIcon } from '../components/Icons.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';
import { formatDuration, releaseYear } from '../utils/format.js';

const TYPES = [
  { id: 'album', label: 'Albums' },
  { id: 'artist', label: 'Artists' },
  { id: 'song', label: 'Songs' },
];

function AlbumResult({ album }) {
  return (
    <Link to={`/album/${album.mbid}`} className="album-card album-link">
      <CoverArt src={album.coverUrl} seed={album.mbid} alt={`${album.title} cover`} />
      <span className="album-card-title">{album.title}</span>
      <span className="album-card-sub">
        {album.artistName}
        {album.releaseDate ? ` · ${releaseYear(album.releaseDate)}` : ''}
      </span>
      {album.primaryType && album.primaryType !== 'Album' && <span className="type-tag">{album.primaryType}</span>}
    </Link>
  );
}

function SongResult({ song }) {
  return (
    <li>
      <Link to={`/song/${song.mbid}`} className="result-row">
        <CoverArt src={song.coverUrl} seed={song.mbid} alt="" className="result-row-cover" />
        <span className="result-row-text">
          <span className="result-row-title">{song.title}</span>
          <span className="muted">
            {song.artistName}
            {song.album ? ` · ${song.album.title}` : ''}
          </span>
        </span>
        <span className="muted">{formatDuration(song.durationSeconds)}</span>
      </Link>
    </li>
  );
}

function ArtistResult({ artist }) {
  const details = [artist.type, artist.area, artist.lifeSpan?.begin && `since ${artist.lifeSpan.begin.slice(0, 4)}`]
    .filter(Boolean)
    .join(' · ');
  return (
    <li>
      <Link to={`/artist/${artist.mbid}`} className="result-row">
        <span className="artist-badge" aria-hidden="true">
          <UserIcon size={20} />
        </span>
        <span className="result-row-text">
          <span className="result-row-title">{artist.name}</span>
          <span className="muted">
            {details}
            {artist.disambiguation ? `${details ? ' · ' : ''}${artist.disambiguation}` : ''}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Music discovery: search MusicBrainz (through the backend) for albums, artists or songs. */
export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q')?.trim() ?? '';
  const type = TYPES.some((t) => t.id === searchParams.get('type')) ? searchParams.get('type') : 'album';
  const page = Math.max(1, Number.parseInt(searchParams.get('page'), 10) || 1);

  const [draft, setDraft] = useState(query);
  const [state, setState] = useState({ status: 'idle' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => setDraft(query), [query]);

  useEffect(() => {
    if (!query) {
      setState({ status: 'idle' });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    searchMusic(query, type, page)
      .then((data) => !cancelled && setState({ status: 'done', data }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => {
      cancelled = true;
    };
  }, [query, type, page, attempt]);

  function go(next) {
    const params = { q: next.q ?? query, type: next.type ?? type };
    if (next.page && next.page > 1) params.page = String(next.page);
    setSearchParams(params);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (draft.trim()) navigate(`/search?${new URLSearchParams({ q: draft.trim(), type })}`);
  }

  const data = state.data;
  const lastPage = data ? Math.ceil(Math.min(data.total, 400) / data.pageSize) : 1;

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Search music</h1>
        <p className="page-subtitle">Find albums, artists and songs from the MusicBrainz open music database.</p>
      </div>

      <form className="search-form" onSubmit={handleSubmit} role="search">
        <label className="search-input">
          <SearchIcon size={18} />
          <input
            type="search"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Try “In Rainbows” or “ok computer radiohead”"
            aria-label="Search music"
            maxLength={100}
            autoFocus={!query}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
          Search
        </button>
      </form>

      <nav className="tabs tabs-plain" aria-label="Result type">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${type === t.id ? ' is-active' : ''}`}
            aria-current={type === t.id ? 'page' : undefined}
            onClick={() => go({ type: t.id, page: 1 })}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section className="card">
        {state.status === 'idle' && (
          <EmptyState title="Start with a search">Search for something you’ve been listening to.</EmptyState>
        )}
        {state.status === 'loading' && <Loading label="Searching MusicBrainz…" />}
        {state.status === 'error' && (
          <ErrorState title="Search failed" message={state.error.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {state.status === 'done' && data.results.length === 0 && (
          <EmptyState title="No results">
            Nothing matched “{query}”. Check the spelling or try another {type === 'song' ? 'song' : type}.
          </EmptyState>
        )}
        {state.status === 'done' && data.results.length > 0 && (
          <>
            <p className="result-count muted">
              {data.total.toLocaleString()} result{data.total === 1 ? '' : 's'} for “{query}”
            </p>
            {type === 'album' && (
              <div className="album-grid">
                {data.results.map((album) => (
                  <AlbumResult key={album.mbid} album={album} />
                ))}
              </div>
            )}
            {type === 'song' && (
              <ul className="result-list">
                {data.results.map((song) => (
                  <SongResult key={song.mbid} song={song} />
                ))}
              </ul>
            )}
            {type === 'artist' && (
              <ul className="result-list">
                {data.results.map((artist) => (
                  <ArtistResult key={artist.mbid} artist={artist} />
                ))}
              </ul>
            )}
            {lastPage > 1 && (
              <div className="pager">
                <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => go({ page: page - 1 })}>
                  Previous
                </button>
                <span className="muted">
                  Page {page} of {lastPage}
                </span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={page >= lastPage}
                  onClick={() => go({ page: page + 1 })}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
