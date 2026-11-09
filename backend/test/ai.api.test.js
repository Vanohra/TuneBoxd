/**
 * End-to-end tests for the AI features with a FAKE Gemini: requests to
 * generativelanguage.googleapis.com are answered by this file, everything else
 * (the database in .env / DB_* variables, live MusicBrainz) is real. This
 * checks TuneBoxd's own code: prompts and schemas sent, MusicBrainz checks,
 * saving, caching and the admin view. It never calls Google.
 *
 * Creates throwaway users ("aitest_...") and deletes them at the end.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

process.env.GEMINI_API_KEY = 'test-key-not-real';

const ALBUM = '6e335887-60ba-38f0-95af-fae7774336bf'; // Radiohead – In Rainbows
const geminiCalls = [];

// ---------- Fake Gemini ----------
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return realFetch(url, options);
  const body = JSON.parse(options.body);
  geminiCalls.push({ url: String(url), headers: options.headers, body });
  const fields = Object.keys(body.generationConfig.responseJsonSchema.properties);
  let answer;
  if (fields.includes('interpretation')) {
    answer = {
      interpretation: 'Moody guitar albums for a rainy night.',
      albums: [
        { title: 'In Rainbows', artist: 'Radiohead', year: 2007, reason: 'Warm and melancholy.' },
        { title: 'Parachutes', artist: 'Coldplay', year: 2000, reason: 'Gentle and wistful.' },
        { title: 'A Totally Made Up Record', artist: 'Nobody Real', year: 2031, reason: 'Hallucinated.' },
      ],
    };
  } else if (fields.includes('verdict')) {
    answer = { verdict: 'spam', severity: 88, suggestedAction: 'remove', explanation: 'Promotes a vinyl shop link.' };
  } else if (fields.includes('liked')) {
    answer = { summary: 'Listeners love its warmth.', liked: ['Warm production'], disliked: ['Short runtime'], overall: 'positive' };
  } else if (fields.includes('reasons')) {
    answer = { reasons: [] };
  } else {
    answer = { summary: 'A recap.' };
  }
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] }, finishReason: 'STOP' }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

const { default: app } = await import('../src/app.js');
const { pool, verifyDatabaseConnection } = await import('../src/db.js');
const { config } = await import('../src/config.js');

let server;
let baseUrl;
const createdUserIds = [];

function client() {
  let cookie = '';
  return async function call(method, path, body) {
    const response = await realFetch(`${baseUrl}/api${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
}

const suffix = Date.now().toString(36);
async function registerAndLogin(name) {
  const call = client();
  const creds = { username: `aitest_${name}_${suffix}`, email: `aitest_${name}_${suffix}@example.test`, password: 'correct-horse-battery' };
  const registered = await call('POST', '/auth/register', { ...creds, confirmPassword: creds.password });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  createdUserIds.push(registered.body.user.id);
  await call('POST', '/auth/login', { identifier: creds.username, password: creds.password });
  return { call, user: registered.body.user, creds };
}

let alice;
let bob;
let admin;
const guest = client();

before(async () => {
  await verifyDatabaseConnection();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  alice = await registerAndLogin('alice');
  bob = await registerAndLogin('bob');
  admin = await registerAndLogin('admin');
  await pool.execute("UPDATE users SET role = 'admin' WHERE user_id = ?", [admin.user.id]);
});

after(async () => {
  if (createdUserIds.length) await pool.query('DELETE FROM users WHERE user_id IN (?)', [createdUserIds]);
  server?.close();
  await pool.end();
  globalThis.fetch = realFetch;
});

describe('Ask TuneBoxd', () => {
  test('returns only albums that exist on MusicBrainz, with reasons', async () => {
    const { status, body } = await alice.call('POST', '/insights/discover', { prompt: 'moody albums for a rainy night' });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(body.interpretation, 'Moody guitar albums for a rainy night.');
    assert.equal(body.suggestedCount, 3);
    const titles = body.results.map((album) => album.title);
    assert.ok(titles.includes('In Rainbows'), JSON.stringify(titles));
    assert.ok(!titles.includes('A Totally Made Up Record'), 'made-up album was filtered out');
    const rainbows = body.results.find((album) => album.title === 'In Rainbows');
    assert.equal(rainbows.mbid, ALBUM);
    assert.equal(rainbows.reason, 'Warm and melancholy.');
    assert.equal(rainbows.alreadyKnown, false);
  });

  test('the API key goes in a header, never the URL', () => {
    const call = geminiCalls.at(-1);
    assert.equal(call.headers['x-goog-api-key'], 'test-key-not-real');
    assert.ok(!call.url.includes('test-key-not-real'));
    assert.match(call.body.contents[0].parts[0].text, /moody albums for a rainy night/);
  });

  test('validation, login and AI-off handling', async () => {
    assert.equal((await guest('POST', '/insights/discover', { prompt: 'jazz please' })).status, 401);
    assert.equal((await alice.call('POST', '/insights/discover', { prompt: 'hi' })).status, 400);
    const saved = config.ai.apiKey;
    config.ai.apiKey = '';
    const off = await alice.call('POST', '/insights/discover', { prompt: 'jazz please' });
    config.ai.apiKey = saved;
    assert.equal(off.status, 503);
    assert.match(off.body.error, /isn’t switched on/);
  });
});

describe('AI moderation assistant', () => {
  let reviewId;
  let reportId;

  test('a report triggers a background AI assessment the admin can see', async () => {
    const review = await alice.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'BUY CHEAP VINYL AT spam.example!!!', rating: 4 });
    assert.equal(review.status, 201);
    reviewId = review.body.review.id;
    const report = await bob.call('POST', `/reviews/${reviewId}/report`, { reason: 'spam', details: 'Advertising' });
    assert.equal(report.status, 201);

    let found;
    for (let attempt = 0; attempt < 20 && !found?.review.aiAssessment; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      const { body } = await admin.call('GET', '/admin/reports?status=pending');
      found = body.reports.find((r) => r.review.id === reviewId);
    }
    reportId = found.id;
    assert.deepEqual(
      { verdict: found.review.aiAssessment.verdict, severity: found.review.aiAssessment.severity, action: found.review.aiAssessment.suggestedAction },
      { verdict: 'spam', severity: 88, action: 'remove' },
    );
    assert.equal(found.review.aiAssessment.isStale, false);

    const verdictCall = geminiCalls.find((call) => 'verdict' in call.body.generationConfig.responseJsonSchema.properties);
    assert.match(verdictCall.body.contents[0].parts[0].text, /BUY CHEAP VINYL/);
    assert.match(verdictCall.body.contents[0].parts[0].text, /Spam or advertising/);
  });

  test('sorting by severity, re-analyzing, and admin-only access', async () => {
    const sorted = await admin.call('GET', '/admin/reports?status=pending&sort=severity');
    assert.equal(sorted.status, 200);
    assert.equal(sorted.body.aiEnabled, true);
    assert.equal(sorted.body.reports[0].review.aiAssessment?.severity ?? -1, Math.max(...sorted.body.reports.map((r) => r.review.aiAssessment?.severity ?? -1)));

    const again = await admin.call('POST', `/admin/reports/${reportId}/analyze`);
    assert.equal(again.status, 200);
    assert.equal(again.body.report.review.aiAssessment.verdict, 'spam');
    assert.equal((await bob.call('POST', `/admin/reports/${reportId}/analyze`)).status, 403);
  });

  test('the AI only advises: the review stays up until an admin acts', async () => {
    assert.equal((await guest('GET', `/reviews/${reviewId}`)).status, 200);
    await admin.call('POST', `/admin/reports/${reportId}/dismiss`);
  });
});

describe('Review digest', () => {
  test('needs two reviews, then is written once and cached until reviews change', async () => {
    // alice reviewed the album above; with one other review there are 2.
    await admin.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Gorgeous, warm production.', rating: 5 });
    const callsBefore = geminiCalls.length;
    const first = await guest('GET', `/music/albums/${ALBUM}/digest`);
    assert.equal(first.status, 200);
    assert.equal(first.body.digest.summary, 'Listeners love its warmth.');
    assert.deepEqual(first.body.digest.liked, ['Warm production']);
    assert.equal(first.body.digest.overall, 'positive');
    assert.ok(first.body.digest.reviewCount >= 2);
    const digestCalls = geminiCalls.slice(callsBefore).filter((call) => 'liked' in call.body.generationConfig.responseJsonSchema.properties);
    assert.equal(digestCalls.length, 1);
    assert.match(digestCalls[0].body.contents[0].parts[0].text, /In Rainbows by Radiohead/);

    // Cached: no new AI call.
    const second = await guest('GET', `/music/albums/${ALBUM}/digest`);
    assert.equal(second.body.digest.summary, first.body.digest.summary);
    assert.equal(geminiCalls.length, callsBefore + 1);

    // A new review changes the fingerprint, so the next view rewrites it.
    await bob.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Too short for me.', rating: 3 });
    await guest('GET', `/music/albums/${ALBUM}/digest`);
    assert.equal(geminiCalls.length, callsBefore + 2);
  });

  test('unknown or barely reviewed albums have no digest', async () => {
    const none = await guest('GET', '/music/albums/1dc4c347-a1db-32aa-b14f-bc9cc507b843/digest');
    assert.equal(none.status, 200);
    assert.equal(none.body.digest, null);
  });
});
