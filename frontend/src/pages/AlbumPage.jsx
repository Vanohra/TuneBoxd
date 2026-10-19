import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchAlbum } from '../api/music.js';
import CoverArt from '../components/CoverArt.jsx';
import { ErrorState, Loading } from '../components/Status.jsx';
import { RatingSummary, ReviewsSection, TargetActions, useTargetReviews } from '../components/TargetActivity.jsx';
import { formatDuration, formatReleaseDate } from '../utils/format.js';

function ArtistLinks({ artists, fallback }) {
  if (!artists?.length) return fallback;
  return artists.map((artist, index) => (
    <span key={artist.mbid}>
      {index > 0 && ', '}
      <Link to={`/artist/${artist.mbid}`}>{artist.name}</Link>
    </span>
  ));
}

function Tracklist({ album }) {
  if (!album.tracks.length) {
    return <p className="empty-text">MusicBrainz doesn’t have a tracklist for this album yet.</p>;
  }
  const multiDisc = album.discCount > 1;
  return (
    <ol className="tracklist">
      {album.tracks.map((track, index) => {
        const newDisc = multiDisc && (index === 0 || album.tracks[index - 1].discNumber !== track.discNumber);
        return (
          <li key={`${track.discNumber}-${track.position}`} className={newDisc ? 'track has-disc' : 'track'}>
            {newDisc && <span className="disc-label">Disc {track.discNumber}</span>}
            <span className="track-number">{track.position}</span>
            {track.recordingMbid ? (
              <Link to={`/song/${track.recordingMbid}`} className="track-title">
                {track.title}
              </Link>
            ) : (
              <span className="track-title">{track.title}</span>
            )}
            {track.artistName && track.artistName !== album.artistName && <span className="muted track-artist">{track.artistName}</span>}
            <span className="track-duration muted">{formatDuration(track.durationSeconds)}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** /album/:mbid: MusicBrainz details + TuneBoxd ratings, reviews and diary logging. */
export default function AlbumPage() {
  const { mbid } = useParams();
  const [album, setAlbum] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const reviews = useTargetReviews('album', mbid);

  useEffect(() => {
    let cancelled = false;
    setAlbum(null);
    setError(null);
    fetchAlbum(mbid)
      .then((data) => !cancelled && setAlbum(data))
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
          title={notFound ? 'Album not found' : 'Couldn’t load this album'}
          message={notFound ? 'This link doesn’t match any album on MusicBrainz.' : error.message}
          onRetry={notFound ? undefined : () => setAttempt((n) => n + 1)}
        />
        <p className="center">
          <Link to="/search" className="btn btn-outline">
            Search music
          </Link>
        </p>
      </section>
    );
  }
  if (!album) return <Loading label="Loading album from MusicBrainz…" />;

  const facts = [
    album.primaryType,
    ...album.secondaryTypes,
    formatReleaseDate(album.releaseDate),
    album.tracks.length ? `${album.tracks.length} tracks` : null,
    formatDuration(album.totalSeconds),
  ].filter(Boolean);

  return (
    <div className="stack">
      <section className="card music-header">
        <CoverArt src={album.coverUrl} seed={album.mbid} alt={`${album.title} cover`} className="music-header-cover" />
        <div className="music-header-info">
          <p className="eyebrow">Album</p>
          <h1 className="music-title">{album.title}</h1>
          <p className="music-artist">
            by <ArtistLinks artists={album.artists} fallback={album.artistName} />
          </p>
          <p className="music-facts muted">{facts.join(' · ')}</p>
          {album.genres.length > 0 && (
            <ul className="genre-list" aria-label="Genres">
              {album.genres.map((genre) => (
                <li key={genre} className="pill">
                  {genre}
                </li>
              ))}
            </ul>
          )}
          <RatingSummary stats={reviews.data?.stats} />
        </div>
      </section>

      <div className="music-layout">
        <div className="stack">
          <section className="card">
            <div className="card-header">
              <h2 className="section-title">Tracklist</h2>
            </div>
            <Tracklist album={album} />
            {album.tracklistSource && album.editionCount > 1 && (
              <p className="field-hint">
                Tracklist from the {album.tracklistSource.date ? `${album.tracklistSource.date} ` : ''}
                {album.tracklistSource.country ? `${album.tracklistSource.country} ` : ''}release ·{' '}
                {album.editionCount} editions on MusicBrainz
              </p>
            )}
          </section>
          <ReviewsSection {...reviews} noun="album" />
        </div>
        <TargetActions
          targetType="album"
          mbid={album.mbid}
          title={album.title}
          reviewsData={reviews.data}
          onReviewSaved={reviews.reload}
        />
      </div>

      <p className="source-note muted">
        Album data from{' '}
        <a href={`https://musicbrainz.org/release-group/${album.mbid}`} target="_blank" rel="noreferrer">
          MusicBrainz
        </a>
        {album.coverUrl ? ' · Artwork from Cover Art Archive' : ''}
      </p>
    </div>
  );
}
