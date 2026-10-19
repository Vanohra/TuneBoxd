// Display helpers shared by the music, review and diary pages.

/** "Oct 18, 2026" from an ISO timestamp. */
export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats a "YYYY-MM-DD" calendar date (listening dates). Parsed as a local
 * date on purpose: new Date('2024-05-01') is UTC midnight and would show as
 * April 30 in the Americas.
 */
export function formatCalendarDate(ymd, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  const [year, month, day] = String(ymd ?? '').split('-').map(Number);
  if (!year) return '';
  return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString(undefined, options);
}

/** MusicBrainz dates may be "2007", "2007-10" or "2007-10-10". */
export function formatReleaseDate(mbDate) {
  if (!mbDate) return 'Unknown release date';
  if (/^\d{4}$/.test(mbDate)) return mbDate;
  if (/^\d{4}-\d{2}$/.test(mbDate)) return formatCalendarDate(mbDate, { month: 'long', year: 'numeric' });
  return formatCalendarDate(mbDate, { month: 'long', day: 'numeric', year: 'numeric' });
}

export const releaseYear = (mbDate) => (mbDate ? String(mbDate).slice(0, 4) : '');

/** 237 → "3:57"; 3725 → "1:02:05". */
export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** Today's local date as "YYYY-MM-DD" (default and maximum for diary entries). */
export function todayYmd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Link to the page for an album/song `target` object from the API. */
export const targetPath = (target) => `/${target.type === 'song' ? 'song' : 'album'}/${target.mbid}`;

/** 4 → "4", 4.5 → "4.5", 3.67 → "3.7" */
export const formatRating = (rating) => (rating == null ? '' : Number(rating).toFixed(1).replace(/\.0$/, ''));
