// Pure unit tests for Sprint 4: list/report/summary validation, list item keys,
// statistics month helpers and the rule-based listening summary.
// No network or database needed.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseItemKey } from '../src/repositories/listRepository.js';
import { fillMonths, lastMonths } from '../src/services/statsService.js';
import { writeRuleSummary } from '../src/services/summaryService.js';
import { formatStars, joinWords } from '../src/utils/format.js';
import { validateList, validateListItem, validateReport, validateSummaryPeriod } from '../src/utils/validation.js';

describe('list validation', () => {
  test('title is required, trimmed and collapsed; public by default', () => {
    assert.equal(validateList({ title: '   ' }).fieldErrors.title, 'List title cannot be empty.');
    const { values, error } = validateList({ title: '  Late   night  ', description: ' calm ' });
    assert.equal(error, null);
    assert.deepEqual(values, { title: 'Late night', description: 'calm', isPublic: true });
  });

  test('length limits and a boolean isPublic', () => {
    assert.match(validateList({ title: 'x'.repeat(101) }).error, /100 characters/);
    assert.match(validateList({ title: 'ok', description: 'x'.repeat(1001) }).error, /1000 characters/);
    assert.equal(validateList({ title: 'ok', isPublic: 'no' }).fieldErrors.isPublic, 'Choose public or private.');
    assert.equal(validateList({ title: 'ok', isPublic: false }).values.isPublic, false);
  });

  test('items need an album/song type and a MusicBrainz ID', () => {
    assert.ok(validateListItem({ targetType: 'artist', mbid: 'x' }).error);
    assert.equal(validateListItem({ targetType: 'album', mbid: '6e335887-60ba-38f0-95af-fae7774336bf' }).error, null);
  });

  test('item keys map to a table and ID, and reject anything else', () => {
    assert.deepEqual(parseItemKey('album-12'), { table: 'list_albums', column: 'album_id', id: 12 });
    assert.deepEqual(parseItemKey('song-7'), { table: 'list_songs', column: 'song_id', id: 7 });
    for (const bad of ['artist-1', 'album-', 'album-1; DROP TABLE lists', 'album-1.5', '', null]) {
      assert.equal(parseItemKey(bad), null, String(bad));
    }
  });
});

describe('report validation', () => {
  test('reason must be a known code', () => {
    assert.equal(validateReport({ reason: 'rude' }).fieldErrors.reason, 'Please choose a reason.');
    assert.equal(validateReport({ reason: 'spam' }).error, null);
  });

  test('"other" needs details; details are capped', () => {
    assert.match(validateReport({ reason: 'other' }).error, /tell us/);
    assert.equal(validateReport({ reason: 'other', details: 'Off-topic rant' }).error, null);
    assert.match(validateReport({ reason: 'spam', details: 'x'.repeat(501) }).error, /500 characters/);
  });
});

describe('summary period validation', () => {
  test('accepts a valid range', () => {
    assert.equal(validateSummaryPeriod({ periodStart: '2025-01-01', periodEnd: '2025-03-31' }).error, null);
  });

  test('rejects missing, reversed, too long and future periods with period wording', () => {
    assert.equal(validateSummaryPeriod({ periodEnd: '2025-01-01' }).fieldErrors.periodStart, 'Please choose the start date.');
    assert.match(validateSummaryPeriod({ periodStart: '2025-02-01', periodEnd: '2025-01-01' }).error, /on or after/);
    assert.match(validateSummaryPeriod({ periodStart: '2023-01-01', periodEnd: '2025-01-01' }).error, /one year/);
    assert.match(validateSummaryPeriod({ periodStart: '2025-01-01', periodEnd: '2999-01-01' }).fieldErrors.periodEnd, /end date can’t be in the future/);
  });
});

describe('statistics helpers', () => {
  test('lastMonths ends with the current month and crosses years', () => {
    assert.deepEqual(lastMonths(3, new Date(Date.UTC(2026, 0, 15))), ['2025-11', '2025-12', '2026-01']);
    assert.equal(lastMonths(12).length, 12);
  });

  test('fillMonths zero-fills months without entries', () => {
    assert.deepEqual(fillMonths(['2026-01', '2026-02', '2026-03'], [{ month: '2026-02', count: 4 }]), [
      { month: '2026-01', count: 0 },
      { month: '2026-02', count: 4 },
      { month: '2026-03', count: 0 },
    ]);
  });

  test('text helpers', () => {
    assert.equal(formatStars(4), '4 stars');
    assert.equal(formatStars(1), '1 star');
    assert.equal(formatStars(3.666), '3.7 stars');
    assert.equal(joinWords(['a', 'b', 'c']), 'a, b and c');
    assert.equal(joinWords(['a']), 'a');
  });
});

describe('rule-based listening summary', () => {
  const period = { periodStart: '2026-01-01', periodEnd: '2026-01-31' };
  const data = {
    totals: { entries: 6, activeDays: 4, distinctAlbums: 3, distinctSongs: 1, distinctArtists: 2 },
    topArtists: [
      { name: 'Radiohead', count: 4 },
      { name: 'Coldplay', count: 2 },
    ],
    topAlbums: [{ title: 'In Rainbows', artistName: 'Radiohead', count: 3 }],
    ratings: { count: 2, average: 4.25 },
    reviews: [{ title: 'In Rainbows', artistName: 'Radiohead', rating: 5, text: 'Great' }],
    weekdays: [0, 0, 0, 0, 4, 2, 0],
  };

  test('mentions the counts, top artist, replays, busiest day and reviews', () => {
    const text = writeRuleSummary(period, data);
    assert.match(text, /January 1, 2026 to January 31, 2026/);
    assert.match(text, /6 listens across 4 days: 3 distinct albums and 1 song by 2 artists/);
    assert.match(text, /Radiohead led the way with 4 listens, followed by Coldplay\./);
    assert.match(text, /most replayed album was In Rainbows by Radiohead \(3 times\)/);
    assert.match(text, /most music on Fridays/);
    assert.match(text, /1 review, and your highest rating went to In Rainbows by Radiohead \(5 stars\)/);
    assert.match(text, /average was 4\.3 stars/);
  });

  test('a period with reviews but no listens still reads naturally', () => {
    const text = writeRuleSummary(period, {
      ...data,
      totals: { ...data.totals, entries: 0 },
      topArtists: [],
      topAlbums: [],
    });
    assert.match(text, /didn’t log any listens/);
    assert.match(text, /You wrote 1 review/);
  });
});
