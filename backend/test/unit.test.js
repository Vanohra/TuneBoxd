// Pure unit tests: validation rules and MusicBrainz → TuneBoxd mapping.
// No network or database needed.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  creditName,
  pickRecordingAlbum,
  pickRepresentativeRelease,
  toAlbumSummary,
  toSqlDate,
  topGenres,
} from '../src/services/musicService.js';
import {
  cleanText,
  isMbid,
  parseId,
  validateComment,
  validateDiaryUpdate,
  validateNewDiaryEntry,
  validateNewReview,
} from '../src/utils/validation.js';

const MBID = '6e335887-60ba-38f0-95af-fae7774336bf';

describe('review validation', () => {
  test('accepts a valid review', () => {
    const { error, values } = validateNewReview({ targetType: 'album', mbid: MBID, text: '  Great  ', rating: 4.5 });
    assert.equal(error, null);
    assert.equal(values.text, 'Great');
    assert.equal(values.rating, 4.5);
  });

  test('rejects empty and whitespace-only text', () => {
    assert.ok(validateNewReview({ targetType: 'album', mbid: MBID, text: '', rating: 3 }).fieldErrors.text);
    assert.ok(validateNewReview({ targetType: 'album', mbid: MBID, text: ' \n\t ', rating: 3 }).fieldErrors.text);
  });

  test('rejects text over 5000 characters', () => {
    assert.ok(validateNewReview({ targetType: 'album', mbid: MBID, text: 'a'.repeat(5001), rating: 3 }).fieldErrors.text);
  });

  test('rating must be 0.5–5 in half steps', () => {
    for (const bad of [0, 0.25, 5.5, 6, -1, 3.3, 'abc', null, undefined, Number.NaN]) {
      assert.ok(validateNewReview({ targetType: 'album', mbid: MBID, text: 'ok', rating: bad }).fieldErrors.rating, String(bad));
    }
    for (const good of [0.5, 1, 2.5, 5, '4']) {
      assert.equal(validateNewReview({ targetType: 'album', mbid: MBID, text: 'ok', rating: good }).error, null, String(good));
    }
  });

  test('target must be album/song with a real MBID', () => {
    assert.ok(validateNewReview({ targetType: 'movie', mbid: MBID, text: 'ok', rating: 3 }).error);
    assert.ok(validateNewReview({ targetType: 'album', mbid: "1' OR '1'='1", text: 'ok', rating: 3 }).error);
  });
});

describe('comment and diary validation', () => {
  test('comments cannot be empty or over 1000 characters', () => {
    assert.ok(validateComment({ text: '   ' }).error);
    assert.ok(validateComment({ text: 'x'.repeat(1001) }).error);
    assert.equal(validateComment({ text: 'Nice!' }).error, null);
  });

  test('diary dates must be real, not in the future, 1900 or later', () => {
    const base = { targetType: 'album', mbid: MBID };
    assert.equal(validateNewDiaryEntry({ ...base, listenedOn: '2024-02-29' }).error, null);
    assert.ok(validateNewDiaryEntry({ ...base, listenedOn: '2023-02-29' }).error); // not a leap year
    assert.ok(validateNewDiaryEntry({ ...base, listenedOn: '2999-01-01' }).error);
    assert.ok(validateNewDiaryEntry({ ...base, listenedOn: '1850-01-01' }).error);
    assert.ok(validateNewDiaryEntry({ ...base, listenedOn: '' }).error);
    assert.ok(validateDiaryUpdate({ listenedOn: '2024-01-01', notes: 'n'.repeat(1001) }).error);
  });

  test('cleanText strips control characters but keeps newlines and HTML as text', () => {
    assert.equal(cleanText('a\u0000b\r\nc'), 'ab\nc');
    assert.equal(cleanText('<script>alert(1)</script>'), '<script>alert(1)</script>');
  });

  test('isMbid and parseId', () => {
    assert.ok(isMbid(MBID));
    assert.ok(!isMbid('in-rainbows'));
    assert.equal(parseId('42'), 42);
    assert.equal(parseId('4.2'), null);
    assert.equal(parseId('-1'), null);
    assert.equal(parseId('1e3'), null);
  });
});

describe('MusicBrainz mapping', () => {
  test('creditName joins multiple artists with join phrases', () => {
    assert.equal(creditName([{ name: 'Jay-Z', joinphrase: ' & ' }, { name: 'Linkin Park' }]), 'Jay-Z & Linkin Park');
    assert.equal(creditName([]), 'Unknown artist');
  });

  test('representative release prefers official, exact, earliest dates', () => {
    const picked = pickRepresentativeRelease([
      { id: 'bootleg', status: 'Bootleg', date: '2007-01-01' },
      { id: 'vague', status: 'Official', date: '2007' },
      { id: 'exact', status: 'Official', date: '2007-10-10' },
      { id: 'later', status: 'Official', date: '2008-01-01' },
      { id: 'undated', status: 'Official' },
    ]);
    assert.equal(picked.id, 'exact');
    assert.equal(pickRepresentativeRelease([]), undefined);
  });

  test('album summary maps release groups and builds a cover URL', () => {
    const summary = toAlbumSummary({
      id: MBID,
      title: 'In Rainbows',
      'first-release-date': '2007-10-10',
      'primary-type': 'Album',
      'artist-credit': [{ name: 'Radiohead', artist: { id: 'a74b1b7f-71a5-4011-9441-d0b5e4122711', name: 'Radiohead' } }],
    });
    assert.equal(summary.artistName, 'Radiohead');
    assert.equal(summary.artists[0].mbid, 'a74b1b7f-71a5-4011-9441-d0b5e4122711');
    assert.match(summary.coverUrl, /coverartarchive\.org\/release-group\/6e335887/);
  });

  test('incomplete metadata gets safe defaults', () => {
    assert.equal(toSqlDate('2007'), null);
    assert.equal(toSqlDate('2007-10-10'), '2007-10-10');
    assert.equal(toSqlDate(undefined), null);
    assert.deepEqual(topGenres({}), []);
    assert.deepEqual(topGenres({ tags: [{ name: 'rock', count: 1 }, { name: 'art rock', count: 5 }] }), ['art rock', 'rock']);
    assert.equal(pickRecordingAlbum({ releases: [] }), null);
  });

  test('a recording maps to its studio album over compilations', () => {
    const album = pickRecordingAlbum({
      releases: [
        { status: 'Official', date: '2005-01-01', 'release-group': { id: 'comp', 'primary-type': 'Album', 'secondary-types': ['Compilation'] } },
        { status: 'Official', date: '2007-10-10', 'release-group': { id: 'studio', title: 'In Rainbows', 'primary-type': 'Album' } },
        { status: 'Official', date: '2007-01-01', 'release-group': { id: 'single', 'primary-type': 'Single' } },
      ],
    });
    assert.equal(album.mbid, 'studio');
  });
});
