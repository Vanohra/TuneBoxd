// Pure unit tests for the AI features: matching Gemini's album suggestions to
// MusicBrainz, and cleaning up the AI's answers before they are saved.
// No network or database needed.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { extractJsonText } from '../src/services/aiClient.js';
import { sanitizeDigest } from '../src/services/digestService.js';
import { luceneQuote, namesMatch, normalizeName, pickReleaseGroup, validatePrompt } from '../src/services/discoveryService.js';
import { sanitizeAssessment } from '../src/services/moderationService.js';

const group = (title, artist, primary = 'Album', secondary = []) => ({
  id: `${title}-${artist}-${primary}-${secondary.join()}`,
  title,
  'primary-type': primary,
  'secondary-types': secondary,
  'artist-credit': [{ name: artist, artist: { id: 'a', name: artist } }],
});

describe('Ask TuneBoxd matching', () => {
  test('normalizeName ignores case, accents, punctuation, "the" and bracketed notes', () => {
    assert.equal(normalizeName('The Beatles'), 'beatles');
    assert.equal(normalizeName('Beyoncé'), 'beyonce');
    assert.equal(normalizeName('Kid A (Deluxe Edition)'), 'kid a');
    assert.equal(normalizeName('Simon & Garfunkel'), 'simon and garfunkel');
  });

  test('namesMatch allows one name to contain the other, but not unrelated names', () => {
    assert.ok(namesMatch('OK Computer', 'ok computer'));
    assert.ok(namesMatch('Radiohead', 'radiohead.'));
    assert.ok(namesMatch('In Rainbows', 'In Rainbows (Disk 2)'));
    assert.equal(namesMatch('Radiohead', 'Coldplay'), false);
    assert.equal(namesMatch('', 'x'), false);
  });

  test('luceneQuote escapes quotes and backslashes', () => {
    assert.equal(luceneQuote('Say "Hi"'), '"Say \\"Hi\\""');
    assert.equal(luceneQuote('a\\b'), '"a\\\\b"');
  });

  test('pickReleaseGroup needs title AND artist to match, and prefers studio albums', () => {
    const groups = [
      group('In Rainbows', 'Radiohead', 'Album', ['Live']),
      group('In Rainbows', 'Some Tribute Band'),
      group('In Rainbows', 'Radiohead'),
    ];
    const picked = pickReleaseGroup(groups, { title: 'In Rainbows', artist: 'Radiohead' });
    assert.equal(picked.id, groups[2].id);
    assert.equal(pickReleaseGroup(groups, { title: 'Made Up Album', artist: 'Radiohead' }), null);
    assert.equal(pickReleaseGroup([], { title: 'x', artist: 'y' }), null);
  });

  test('prompts are trimmed and length-checked', () => {
    assert.equal(validatePrompt('  sad   songs  '), 'sad songs');
    assert.throws(() => validatePrompt('hi'), /a little more/);
    assert.throws(() => validatePrompt('x'.repeat(301)), /300 characters/);
  });
});

describe('cleaning AI answers', () => {
  test('assessments keep only known verdicts/actions and clamp severity', () => {
    assert.deepEqual(sanitizeAssessment({ verdict: 'spam', severity: 140, suggestedAction: 'remove', explanation: ' Ad link. ' }), {
      verdict: 'spam',
      suggestedAction: 'remove',
      severity: 100,
      explanation: 'Ad link.',
    });
    assert.equal(sanitizeAssessment({ verdict: 'evil', severity: 50, suggestedAction: 'remove', explanation: 'x' }), null);
    assert.equal(sanitizeAssessment({ verdict: 'ok', severity: 5, suggestedAction: 'ban', explanation: 'x' }), null);
    assert.equal(sanitizeAssessment({ verdict: 'ok', severity: 5, suggestedAction: 'dismiss', explanation: '' }), null);
    assert.equal(sanitizeAssessment(null), null);
  });

  test('digests need a summary; points are trimmed and capped; unknown mood becomes mixed', () => {
    const digest = sanitizeDigest({ summary: 'Loved.', liked: [' Drums ', '', 'a', 'b', 'c', 'd'], disliked: 'nope', overall: 'ecstatic' });
    assert.deepEqual(digest, { summary: 'Loved.', liked: ['Drums', 'a', 'b', 'c'], disliked: [], overall: 'mixed' });
    assert.equal(sanitizeDigest({ summary: '  ', liked: [] }), null);
  });
});

describe('reading Gemini responses', () => {
  test('skips thought parts, joins text parts and strips code fences', () => {
    const candidate = {
      content: { parts: [{ text: 'thinking...', thought: true }, { text: '```json\n{"a":' }, { text: '1}\n```' }] },
    };
    assert.equal(extractJsonText(candidate), '{"a":1}');
    assert.equal(extractJsonText({}), '');
  });
});
