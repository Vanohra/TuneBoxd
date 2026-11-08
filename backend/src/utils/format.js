// Small text helpers for server-written sentences (recommendation reasons, summaries).

/** 4 → "4 stars", 4.5 → "4.5 stars", 3.666 → "3.7 stars" */
export function formatStars(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return `${rounded} star${rounded === 1 ? '' : 's'}`;
}

/** ["a"] → "a"; ["a","b"] → "a and b"; ["a","b","c"] → "a, b and c" */
export function joinWords(words) {
  if (words.length <= 1) return words[0] ?? '';
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

/** "2026-03-01" → "March 1, 2026" (calendar date, no time zone shift) */
export function formatYmd(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
