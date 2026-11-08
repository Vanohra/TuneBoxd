/**
 * End-to-end API tests for Sprint 4 against the database in .env (or DB_*
 * environment variables) and the live MusicBrainz API:
 * custom lists + privacy (#10, #16), reports + moderation (#17, #18),
 * admin account controls (#15), listening statistics (#19),
 * recommendations (#13) and listening summaries (#14).
 *
 * Like api.test.js it registers throwaway users ("s4test_...") and deletes
 * them at the end; their lists, reports, recommendations and summaries go
 * with them through ON DELETE CASCADE. The AI features are tested with their
 * rule-based output: GEMINI_API_KEY is cleared for this run.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

delete process.env.GEMINI_API_KEY;
const { default: app } = await import('../src/app.js');
const { pool, verifyDatabaseConnection } = await import('../src/db.js');

const ALBUM = '6e335887-60ba-38f0-95af-fae7774336bf'; // Radiohead – In Rainbows
const SONG = 'faea2aa0-80a9-41be-9b1e-3b994f4f76ac'; // Radiohead – 15 Step
const PARACHUTES = '1dc4c347-a1db-32aa-b14f-bc9cc507b843'; // Coldplay – Parachutes

let server;
let baseUrl;
const createdUserIds = [];

function client() {
  let cookie = '';
  return async function call(method, path, body) {
    const response = await fetch(`${baseUrl}/api${path}`, {
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
  const creds = { username: `s4test_${name}_${suffix}`, email: `s4test_${name}_${suffix}@example.test`, password: 'correct-horse-battery' };
  const registered = await call('POST', '/auth/register', { ...creds, confirmPassword: creds.password });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  createdUserIds.push(registered.body.user.id);
  const login = await call('POST', '/auth/login', { identifier: creds.username, password: creds.password });
  assert.equal(login.status, 200);
  return { call, user: login.body.user, creds };
}

let alice; // owns lists, writes the reported review
let bob; // reports, tries to touch alice's private things
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
  if (createdUserIds.length) {
    await pool.query('DELETE FROM users WHERE user_id IN (?)', [createdUserIds]);
  }
  server?.close();
  await pool.end();
});

describe('custom lists and privacy (#10, #16)', () => {
  let publicList;
  let privateList;

  test('create public and private lists; validation errors', async () => {
    const bad = await alice.call('POST', '/lists', { title: '  ' });
    assert.equal(bad.status, 400);
    assert.ok(bad.body.fieldErrors.title);

    const pub = await alice.call('POST', '/lists', { title: 'Favourites', description: 'Best of', isPublic: true });
    assert.equal(pub.status, 201);
    publicList = pub.body.list;
    assert.equal(publicList.isPublic, true);
    assert.equal(publicList.isOwner, true);

    const priv = await alice.call('POST', '/lists', { title: 'Secret', isPublic: false });
    assert.equal(priv.status, 201);
    privateList = priv.body.list;

    assert.equal((await guest('POST', '/lists', { title: 'x' })).status, 401);
  });

  test('add albums and songs, no duplicates, in order', async () => {
    const first = await alice.call('POST', `/lists/${publicList.id}/items`, { targetType: 'album', mbid: ALBUM });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    await alice.call('POST', `/lists/${publicList.id}/items`, { targetType: 'song', mbid: SONG });
    const third = await alice.call('POST', `/lists/${publicList.id}/items`, { targetType: 'album', mbid: PARACHUTES });
    assert.deepEqual(
      third.body.list.items.map((item) => item.target.mbid),
      [ALBUM, SONG, PARACHUTES],
    );
    const dup = await alice.call('POST', `/lists/${publicList.id}/items`, { targetType: 'album', mbid: ALBUM });
    assert.equal(dup.status, 409);
    await alice.call('POST', `/lists/${privateList.id}/items`, { targetType: 'album', mbid: ALBUM });
  });

  test('reorder and remove items', async () => {
    const { body } = await alice.call('GET', `/lists/${publicList.id}`);
    const keys = body.list.items.map((item) => item.key).reverse();
    const reordered = await alice.call('PUT', `/lists/${publicList.id}/order`, { keys });
    assert.equal(reordered.status, 200);
    assert.deepEqual(reordered.body.list.items.map((item) => item.key), keys);

    assert.equal((await alice.call('PUT', `/lists/${publicList.id}/order`, { keys: keys.slice(1) })).status, 400);

    const removed = await alice.call('DELETE', `/lists/${publicList.id}/items/${keys[0]}`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.list.items.length, 2);
  });

  test('private lists are hidden from everyone but the owner', async () => {
    assert.equal((await guest('GET', `/lists/${publicList.id}`)).status, 200);
    assert.equal((await guest('GET', `/lists/${privateList.id}`)).status, 404);
    assert.equal((await bob.call('GET', `/lists/${privateList.id}`)).status, 404);
    assert.equal((await alice.call('GET', `/lists/${privateList.id}`)).status, 200);

    const asGuest = await guest('GET', `/users/${alice.creds.username}/lists`);
    assert.deepEqual(asGuest.body.lists.map((list) => list.id), [publicList.id]);
    const asOwner = await alice.call('GET', `/users/${alice.creds.username}/lists`);
    assert.equal(asOwner.body.lists.length, 2);

    const profile = await guest('GET', `/users/${alice.creds.username}`);
    assert.equal(profile.body.profile.stats.lists, 1);
  });

  test('only the owner can change a list; switching to private hides it', async () => {
    assert.equal((await bob.call('PATCH', `/lists/${publicList.id}`, { title: 'Hijacked' })).status, 403);
    assert.equal((await bob.call('DELETE', `/lists/${publicList.id}`)).status, 403);
    assert.equal((await bob.call('POST', `/lists/${publicList.id}/items`, { targetType: 'album', mbid: ALBUM })).status, 403);

    const updated = await alice.call('PATCH', `/lists/${publicList.id}`, { title: 'Favourites', description: '', isPublic: false });
    assert.equal(updated.status, 200);
    assert.equal((await guest('GET', `/lists/${publicList.id}`)).status, 404);
    await alice.call('PATCH', `/lists/${publicList.id}`, { title: 'Favourites', isPublic: true });
  });

  test('membership flags for the add-to-list picker', async () => {
    const { body } = await alice.call('GET', `/lists/for/album/${ALBUM}`);
    const byId = new Map(body.lists.map((list) => [list.id, list.hasTarget]));
    assert.equal(byId.get(privateList.id), true);
  });

  test('delete a list', async () => {
    assert.equal((await alice.call('DELETE', `/lists/${privateList.id}`)).status, 200);
    assert.equal((await alice.call('GET', `/lists/${privateList.id}`)).status, 404);
  });
});

describe('reports and moderation (#17, #18) and admin accounts (#15)', () => {
  let reviewId;
  let reportId;

  test('reporting validates input, blocks self-reports and duplicates', async () => {
    const review = await alice.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Brilliant.', rating: 5 });
    assert.equal(review.status, 201);
    reviewId = review.body.review.id;

    assert.equal((await guest('POST', `/reviews/${reviewId}/report`, { reason: 'spam' })).status, 401);
    assert.equal((await alice.call('POST', `/reviews/${reviewId}/report`, { reason: 'spam' })).status, 400);
    assert.equal((await bob.call('POST', `/reviews/${reviewId}/report`, { reason: 'nope' })).status, 400);
    assert.equal((await bob.call('POST', `/reviews/${reviewId}/report`, { reason: 'other' })).status, 400);

    const ok = await bob.call('POST', `/reviews/${reviewId}/report`, { reason: 'spam', details: 'Looks like an ad' });
    assert.equal(ok.status, 201);
    assert.equal((await bob.call('POST', `/reviews/${reviewId}/report`, { reason: 'spam' })).status, 409);

    const reasons = await guest('GET', '/reviews/report-reasons');
    assert.ok(reasons.body.reasons.some((reason) => reason.id === 'spam'));
  });

  test('admin routes are admin-only', async () => {
    assert.equal((await guest('GET', '/admin/reports')).status, 401);
    assert.equal((await bob.call('GET', '/admin/reports')).status, 403);
    assert.equal((await bob.call('GET', '/admin/users')).status, 403);
  });

  test('admin sees the pending report and can remove, then restore, the review', async () => {
    const queue = await admin.call('GET', '/admin/reports?status=pending');
    assert.equal(queue.status, 200);
    const report = queue.body.reports.find((r) => r.review.id === reviewId);
    assert.ok(report);
    assert.equal(report.reasonLabel, 'Spam or advertising');
    assert.equal(report.reporter.username, bob.creds.username);
    reportId = report.id;

    const removed = await admin.call('POST', `/admin/reports/${reportId}/remove`);
    assert.equal(removed.status, 200);
    assert.equal(removed.body.report.status, 'removed');
    assert.equal(removed.body.report.review.isRemoved, true);
    assert.equal((await guest('GET', `/reviews/${reviewId}`)).status, 404);
    assert.equal((await admin.call('POST', `/admin/reports/${reportId}/dismiss`)).status, 409);

    const restored = await admin.call('POST', `/admin/reports/${reportId}/restore`);
    assert.equal(restored.status, 200);
    assert.equal(restored.body.report.status, 'dismissed');
    assert.equal((await guest('GET', `/reviews/${reviewId}`)).status, 200);
  });

  test('admin can suspend and reactivate an account, but not themselves', async () => {
    const users = await admin.call('GET', `/admin/users?q=${encodeURIComponent(bob.creds.username)}`);
    assert.equal(users.body.users.length, 1);
    assert.equal(users.body.users[0].email, bob.creds.email);

    assert.equal((await admin.call('PATCH', `/admin/users/${admin.user.id}`, { accountStatus: 'suspended' })).status, 400);
    assert.equal((await admin.call('PATCH', `/admin/users/${bob.user.id}`, { accountStatus: 'frozen' })).status, 400);

    const suspended = await admin.call('PATCH', `/admin/users/${bob.user.id}`, { accountStatus: 'suspended' });
    assert.equal(suspended.status, 200);
    assert.equal(suspended.body.user.accountStatus, 'suspended');
    assert.equal((await bob.call('GET', '/me')).status, 403);

    await admin.call('PATCH', `/admin/users/${bob.user.id}`, { accountStatus: 'active' });
    const login = await bob.call('POST', '/auth/login', { identifier: bob.creds.username, password: bob.creds.password });
    assert.equal(login.status, 200);
  });

  test('admin can promote and demote', async () => {
    const promoted = await admin.call('PATCH', `/admin/users/${bob.user.id}`, { role: 'admin' });
    assert.equal(promoted.body.user.role, 'admin');
    assert.equal((await bob.call('GET', '/admin/reports')).status, 200);
    await admin.call('PATCH', `/admin/users/${bob.user.id}`, { role: 'user' });
    assert.equal((await bob.call('GET', '/admin/reports')).status, 403);
  });
});

describe('listening statistics (#19)', () => {
  test('counts distinct albums, top artists and monthly entries', async () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const body of [
      { targetType: 'album', mbid: ALBUM, listenedOn: today },
      { targetType: 'album', mbid: ALBUM, listenedOn: today },
      { targetType: 'song', mbid: SONG, listenedOn: today },
      { targetType: 'album', mbid: PARACHUTES, listenedOn: today },
    ]) {
      assert.equal((await alice.call('POST', '/diary', body)).status, 201);
    }
    const { status, body } = await alice.call('GET', '/insights/stats');
    assert.equal(status, 200);
    const { stats } = body;
    assert.equal(stats.totals.entries, 4);
    assert.equal(stats.totals.distinctAlbums, 2);
    assert.equal(stats.topArtists[0].name, 'Radiohead');
    assert.equal(stats.topArtists[0].count, 3);
    assert.equal(stats.monthly.length, 12);
    assert.equal(stats.monthly.at(-1).count, 4);
    assert.equal(stats.topAlbums[0].mbid, ALBUM);
    assert.equal(stats.topAlbums[0].count, 2);
  });

  test('statistics follow diary privacy', async () => {
    assert.equal((await guest('GET', `/users/${alice.creds.username}/stats`)).status, 200);
    await alice.call('PUT', '/diary/settings', { visibility: 'private' });
    assert.equal((await guest('GET', `/users/${alice.creds.username}/stats`)).status, 403);
    assert.equal((await alice.call('GET', `/users/${alice.creds.username}/stats`)).status, 200);
    await alice.call('PUT', '/diary/settings', { visibility: 'public' });
    assert.equal((await guest('GET', '/insights/stats')).status, 401);
  });
});

describe('recommendations (#13) and summaries (#14)', () => {
  test('taste neighbours drive recommendations, and known albums are excluded', async () => {
    // bob loved In Rainbows (like alice) and also Parachutes.
    await bob.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Great', rating: 5 });
    await bob.call('POST', '/reviews', { targetType: 'album', mbid: PARACHUTES, text: 'Lovely', rating: 4.5 });
    // carol is new: no history, so she gets community favourites.
    const carol = await registerAndLogin('carol');

    const forBob = await bob.call('GET', '/insights/recommendations');
    assert.equal(forBob.status, 200);
    assert.ok(forBob.body.recommendations.every((rec) => ![ALBUM, PARACHUTES].includes(rec.target.mbid)));

    const forCarol = await carol.call('POST', '/insights/recommendations/refresh');
    assert.equal(forCarol.status, 200);
    const mbids = forCarol.body.recommendations.map((rec) => rec.target.mbid);
    assert.ok(mbids.includes(ALBUM), JSON.stringify(mbids));
    assert.ok(forCarol.body.recommendations.every((rec) => rec.reason.length > 0));
    assert.equal(forCarol.body.aiEnabled, false);

    // Saved: a second GET returns the same rows.
    const again = await carol.call('GET', '/insights/recommendations');
    assert.deepEqual(again.body.recommendations.map((rec) => rec.id), forCarol.body.recommendations.map((rec) => rec.id));
    assert.equal((await guest('GET', '/insights/recommendations')).status, 401);
  });

  test('summaries are generated, listed, private and deletable', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const bad = await alice.call('POST', '/insights/summaries', { periodStart: today, periodEnd: '2020-01-01' });
    assert.equal(bad.status, 400);
    const empty = await alice.call('POST', '/insights/summaries', { periodStart: '1990-01-01', periodEnd: '1990-01-31' });
    assert.equal(empty.status, 400);

    const created = await alice.call('POST', '/insights/summaries', { periodStart: today, periodEnd: today });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.match(created.body.summary.text, /4 listens/);
    assert.match(created.body.summary.text, /Radiohead led the way/);

    const list = await alice.call('GET', '/insights/summaries');
    assert.equal(list.body.summaries[0].id, created.body.summary.id);
    assert.equal((await bob.call('GET', '/insights/summaries')).body.summaries.length, 0);
    assert.equal((await bob.call('DELETE', `/insights/summaries/${created.body.summary.id}`)).status, 404);
    assert.equal((await alice.call('DELETE', `/insights/summaries/${created.body.summary.id}`)).status, 200);
  });
});
