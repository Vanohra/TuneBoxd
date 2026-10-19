import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchSong } from '../api/music.js';
import CoverArt from '../components/CoverArt.jsx';
import { ErrorState, Loading } from '../components/Status.jsx';
import { RatingSummary, ReviewsSection, TargetActions, useTargetReviews } from '../components/TargetActivity.jsx';
import { formatDuration, formatReleaseDate } from '../utils/format.js';

/** /song/:mbid: a MusicBrainz recording, with TuneBoxd reviews and diary logging. */
export default function SongPage() {
  const { mbid } = useParams();
  const [song, setSong] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const reviews = useTargetReviews('song', mbid);

  useEffect(() => {
    let cancelled = false;
    setSong(null);
    setError(null);
    fetchSong(mbid)
      .then((data) => !cancelled && setSong(data))
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
          title={notFound ? 'Song not found' : 'Couldn’t load this song'}
          message={notFound ? 'This link doesn’t match any song on MusicBrainz.' : error.message}
          onRetry={notFound ? undefined : () => setAttempt((n) => n + 1)}
        />
      </section>
    );
  }
  if (!song) return <Loading label="Loading song from MusicBrainz…" />;

  const facts = [formatReleaseDate(song.releaseDate), formatDuration(song.durationSeconds)].filter(Boolean);

  return (
    <div className="stack">
      <section className="card music-header">
        <CoverArt src={song.coverUrl} seed={song.mbid} alt="" className="music-header-cover" />
        <div className="music-header-info">
          <p className="eyebrow">Song</p>
          <h1 className="music-title">{song.title}</h1>
          <p className="music-artist">
            by{' '}
            {song.artists.length
              ? song.artists.map((artist, index) => (
                  <span key={artist.mbid}>
                    {index > 0 && ', '}
                    <Link to={`/artist/${artist.mbid}`}>{artist.name}</Link>
                  </span>
                ))
              : song.artistName}
          </p>
          {song.album && (
            <p className="music-artist">
              from <Link to={`/album/${song.album.mbid}`}>{song.album.title}</Link>
            </p>
          )}
          <p className="music-facts muted">{facts.join(' · ')}</p>
          {song.genres.length > 0 && (
            <ul className="genre-list" aria-label="Genres">
              {song.genres.map((genre) => (
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
        <ReviewsSection {...reviews} noun="song" />
        <TargetActions targetType="song" mbid={song.mbid} title={song.title} reviewsData={reviews.data} onReviewSaved={reviews.reload} />
      </div>

      <p className="source-note muted">
        Song data from{' '}
        <a href={`https://musicbrainz.org/recording/${song.mbid}`} target="_blank" rel="noreferrer">
          MusicBrainz
        </a>
      </p>
    </div>
  );
}
