import { Link } from 'react-router-dom';
import { formatCalendarDate, formatRating } from '../utils/format.js';
import BarChart from './BarChart.jsx';
import CoverArt from './CoverArt.jsx';
import { EmptyState } from './Status.jsx';

const WEEKDAYS = [
  ['Mon', 'Monday'],
  ['Tue', 'Tuesday'],
  ['Wed', 'Wednesday'],
  ['Thu', 'Thursday'],
  ['Fri', 'Friday'],
  ['Sat', 'Saturday'],
  ['Sun', 'Sunday'],
];

/** "2026-03" → { label: "Mar", fullLabel: "March 2026" } */
function monthLabels(ym) {
  const ymd = `${ym}-01`;
  return {
    label: formatCalendarDate(ymd, { month: 'short' }),
    fullLabel: formatCalendarDate(ymd, { month: 'long', year: 'numeric' }),
  };
}

function StatTile({ value, label, hint }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-value">{value}</span>
      <span className="stat-tile-label">{label}</span>
      {hint && <span className="muted small">{hint}</span>}
    </div>
  );
}

/**
 * Listening statistics (feature #19): totals, frequently logged artists,
 * distinct albums, monthly diary entry counts and top albums.
 * `isOwner` and `username` only change the empty-state wording.
 */
export default function StatsView({ stats, isOwner = true, username }) {
  const { totals, topArtists, topAlbums, monthly, weekdays, ratings } = stats;

  if (totals.entries === 0) {
    return (
      <section className="card">
        <EmptyState
          title="No listening data yet"
          action={
            isOwner && (
              <Link to="/diary" className="btn btn-primary btn-sm">
                Log a listen
              </Link>
            )
          }
        >
          {isOwner ? 'Statistics are built from your listening diary. Log what you listen to and they’ll appear here.' : `@${username} hasn’t logged any listens yet.`}
        </EmptyState>
      </section>
    );
  }

  const maxArtist = topArtists[0]?.count ?? 1;

  return (
    <div className="stack">
      <section className="stat-tiles" aria-label="Totals">
        <StatTile value={totals.entries} label={totals.entries === 1 ? 'Diary entry' : 'Diary entries'} hint={`${totals.activeDays} active day${totals.activeDays === 1 ? '' : 's'}`} />
        <StatTile value={totals.distinctAlbums} label={totals.distinctAlbums === 1 ? 'Distinct album' : 'Distinct albums'} hint="logged at least once" />
        <StatTile value={totals.distinctArtists} label={totals.distinctArtists === 1 ? 'Artist' : 'Artists'} hint={`${totals.distinctSongs} distinct song${totals.distinctSongs === 1 ? '' : 's'}`} />
        <StatTile
          value={ratings.count ? formatRating(ratings.average) : '–'}
          label="Average rating"
          hint={`${ratings.count} rating${ratings.count === 1 ? '' : 's'} given`}
        />
      </section>

      <section className="card">
        <BarChart
          title="Diary entries per month (last 12 months)"
          data={monthly.map((row) => ({ ...monthLabels(row.month), value: row.count }))}
        />
        <p className="field-hint">
          First listen {formatCalendarDate(totals.firstListen)} · most recent {formatCalendarDate(totals.lastListen)}
        </p>
      </section>

      <div className="stats-columns">
        <section className="card">
          <h2 className="section-title">Most logged artists</h2>
          <ol className="rank-bars">
            {topArtists.map((artist) => (
              <li key={artist.mbid ?? artist.name} className="rank-bar">
                <span className="rank-bar-label">
                  {artist.mbid ? <Link to={`/artist/${artist.mbid}`}>{artist.name}</Link> : artist.name}
                </span>
                <span className="rank-bar-track" aria-hidden="true">
                  <span className="rank-bar-fill" style={{ width: `${(artist.count / maxArtist) * 100}%` }} />
                </span>
                <span className="rank-bar-value">{artist.count}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="card">
          <BarChart
            title="Listens by day of the week"
            data={weekdays.map((value, index) => ({ label: WEEKDAYS[index][0], fullLabel: WEEKDAYS[index][1], value }))}
          />
        </section>
      </div>

      {topAlbums.length > 0 && (
        <section className="card">
          <h2 className="section-title">Most logged albums</h2>
          <div className="album-row album-row-filled">
            {topAlbums.map((album) => (
              <Link key={album.mbid} to={`/album/${album.mbid}`} className="album-card album-link">
                <CoverArt src={album.coverUrl} seed={album.mbid} alt={`${album.title} cover`} />
                <span className="album-card-title">{album.title}</span>
                <span className="album-card-sub">{album.artistName}</span>
                <span className="muted small">
                  {album.count} listen{album.count === 1 ? '' : 's'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
