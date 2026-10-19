import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchArtist } from '../api/music.js';
import CoverArt from '../components/CoverArt.jsx';
import { UserIcon } from '../components/Icons.jsx';
import { EmptyState, ErrorState, Loading } from '../components/Status.jsx';
import { releaseYear } from '../utils/format.js';

/** /artist/:mbid: artist info and discography (albums and EPs) from MusicBrainz. */
export default function ArtistPage() {
  const { mbid } = useParams();
  const [artist, setArtist] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setArtist(null);
    setError(null);
    fetchArtist(mbid)
      .then((data) => !cancelled && setArtist(data))
      .catch((err) => !cancelled && setError(err));
    return () => {
      cancelled = true;
    };
  }, [mbid, attempt]);

  if (error) {
    const notFound = error.status === 404 || error.status === 400;
    return (
      <section className="card narrow">
        <ErrorState
          title={notFound ? 'Artist not found' : 'Couldn’t load this artist'}
          message={notFound ? 'This link doesn’t match any artist on MusicBrainz.' : error.message}
          onRetry={notFound ? undefined : () => setAttempt((n) => n + 1)}
        />
      </section>
    );
  }
  if (!artist) return <Loading label="Loading artist from MusicBrainz…" />;

  const { begin, end } = artist.lifeSpan;
  const facts = [
    artist.type,
    artist.area || artist.country,
    begin && `${begin.slice(0, 4)}${end ? `–${end.slice(0, 4)}` : '–present'}`,
  ].filter(Boolean);

  return (
    <div className="stack">
      <section className="card music-header">
        <span className="artist-badge artist-badge-lg" aria-hidden="true">
          <UserIcon size={56} strokeWidth={1.4} />
        </span>
        <div className="music-header-info">
          <p className="eyebrow">Artist</p>
          <h1 className="music-title">{artist.name}</h1>
          {artist.disambiguation && <p className="music-artist">{artist.disambiguation}</p>}
          <p className="music-facts muted">{facts.join(' · ')}</p>
          {artist.genres.length > 0 && (
            <ul className="genre-list" aria-label="Genres">
              {artist.genres.map((genre) => (
                <li key={genre} className="pill">
                  {genre}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="section-title">Discography</h2>
          <span className="pill">{artist.albums.length}</span>
        </div>
        {artist.albums.length === 0 ? (
          <EmptyState title="No albums listed">MusicBrainz doesn’t list any albums or EPs for this artist.</EmptyState>
        ) : (
          <div className="album-grid">
            {artist.albums.map((album) => (
              <Link key={album.mbid} to={`/album/${album.mbid}`} className="album-card album-link">
                <CoverArt src={album.coverUrl} seed={album.mbid} alt={`${album.title} cover`} />
                <span className="album-card-title">{album.title}</span>
                <span className="album-card-sub">
                  {[releaseYear(album.releaseDate), album.primaryType !== 'Album' && album.primaryType, ...album.secondaryTypes]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <p className="source-note muted">
        Artist data from{' '}
        <a href={`https://musicbrainz.org/artist/${artist.mbid}`} target="_blank" rel="noreferrer">
          MusicBrainz
        </a>
      </p>
    </div>
  );
}
