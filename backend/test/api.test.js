/**
 * End-to-end API tests against the REAL services: the AWS RDS database from
 * .env and the live MusicBrainz API. Run with: npm --prefix backend test
 *
 * The suite registers three throwaway users (usernames start with "s3test_"),
 * exercises all four Sprint 3 use cases plus the Sprint 2 regression checks,
 * then deletes those users. Their reviews, ratings, comments, diary entries
 * and settings are removed by ON DELETE CASCADE. Album/artist/song rows that
 * were looked up stay, as real catalog data.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import app from '../src/app.js';
import { pool, verifyDatabaseConnection } from '../src/db.js';

const ALBUM = '6e335887-60ba-38f0-95af-fae7774336bf'; // Radiohead – In Rainbows (release group)
const SONG = 'faea2aa0-80a9-41be-9b1e-3b994f4f76ac'; // Radiohead – 15 Step (recording)
const PARACHUTES = '1dc4c347-a1db-32aa-b14f-bc9cc507b843'; // Coldplay – Parachutes (release group)
const MISSING = '00000000-0000-4000-8000-000000000000';

let server;
let baseUrl;
const createdUserIds = [];

/** Tiny API client with its own cookie jar (one per simulated browser). */
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
const credentials = (name) => ({
  username: `s3test_${name}_${suffix}`,
  email: `s3test_${name}_${suffix}@example.test`,
  password: 'correct-horse-battery',
});

async function registerAndLogin(name) {
  const call = client();
  const creds = credentials(name);
  const registered = await call('POST', '/auth/register', { ...creds, confirmPassword: creds.password });
  assert.equal(registered.status, 201, JSON.stringify(registered.body));
  createdUserIds.push(registered.body.user.id);
  const login = await call('POST', '/auth/login', { identifier: creds.username, password: creds.password });
  assert.equal(login.status, 200);
  return { call, user: login.body.user, creds };
}

let alice; // writes reviews, diary entries
let bob; // comments, tries to edit alice's things
const guest = client();

before(async () => {
  await verifyDatabaseConnection();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  alice = await registerAndLogin('alice');
  bob = await registerAndLogin('bob');
});

after(async () => {
  if (createdUserIds.length) {
    const placeholders = createdUserIds.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM users WHERE user_id IN (${placeholders})`, createdUserIds);
  }
  await new Promise((resolve) => server?.close(resolve));
  await pool.end();
});

describe('Use case 1: album pages', () => {
  test('album search returns real MusicBrainz results', async () => {
    const res = await guest('GET', '/music/search?query=in%20rainbows%20radiohead&type=album');
    assert.equal(res.status, 200);
    assert.ok(res.body.results.some((album) => album.mbid === ALBUM && album.artistName === 'Radiohead'));
  });

  test('artist and song search work', async () => {
    const artists = await guest('GET', '/music/search?query=radiohead&type=artist');
    assert.equal(artists.status, 200);
    assert.equal(artists.body.results[0].name, 'Radiohead');
    const songs = await guest('GET', '/music/search?query=15%20step%20radiohead&type=song');
    assert.equal(songs.status, 200);
    assert.ok(songs.body.results.length > 0);
  });

  test('album details come from MusicBrainz with tracklist and artwork', async () => {
    const res = await guest('GET', `/music/albums/${ALBUM}`);
    assert.equal(res.status, 200);
    const { album } = res.body;
    assert.equal(album.title, 'In Rainbows');
    assert.equal(album.artistName, 'Radiohead');
    assert.equal(album.releaseDate, '2007-10-10');
    assert.equal(album.tracks.length, 10);
    assert.equal(album.tracks[0].title, '15 Step');
    assert.ok(album.coverUrl === null || album.coverUrl.startsWith('https://'));
  });

  test('invalid and unknown album IDs give clear errors', async () => {
    const invalid = await guest('GET', '/music/albums/not-a-real-id');
    assert.equal(invalid.status, 400);
    const unknown = await guest('GET', `/music/albums/${MISSING}`);
    assert.equal(unknown.status, 404);
    assert.match(unknown.body.error, /couldn’t find/);
  });

  test('empty search is rejected; no results is an empty list', async () => {
    assert.equal((await guest('GET', '/music/search?query=%20&type=album')).status, 400);
    const none = await guest('GET', '/music/search?query=zzqxvbnmzzqxjk&type=album');
    assert.equal(none.status, 200);
    assert.deepEqual(none.body.results, []);
  });

  test('artist page lists albums', async () => {
    const res = await guest('GET', '/music/artists/a74b1b7f-71a5-4011-9441-d0b5e4122711');
    assert.equal(res.status, 200);
    assert.ok(res.body.artist.albums.some((album) => album.mbid === ALBUM));
  });
});

describe('Use case 2: reviews', () => {
  let reviewId;

  test('unauthenticated submissions are rejected', async () => {
    const res = await guest('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Hi', rating: 4 });
    assert.equal(res.status, 401);
  });

  test('empty review and invalid rating are rejected', async () => {
    const empty = await alice.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: '   ', rating: 4 });
    assert.equal(empty.status, 400);
    assert.ok(empty.body.fieldErrors.text);
    const badRating = await alice.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Good', rating: 7 });
    assert.equal(badRating.status, 400);
    assert.ok(badRating.body.fieldErrors.rating);
  });

  test('reviews for unknown music are rejected', async () => {
    const res = await alice.call('POST', '/reviews', { targetType: 'album', mbid: MISSING, text: 'Good', rating: 4 });
    assert.equal(res.status, 404);
  });

  test('a logged-in user can submit a review; author comes from the session', async () => {
    const res = await alice.call('POST', '/reviews', {
      targetType: 'album',
      mbid: ALBUM,
      text: 'A warm, intimate record. <b>not bold</b>',
      rating: 4.5,
      userId: bob.user.id, // must be ignored
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    reviewId = res.body.review.id;
    assert.equal(res.body.review.author.username, alice.creds.username);
    assert.equal(res.body.review.rating, 4.5);
    assert.equal(res.body.review.text, 'A warm, intimate record. <b>not bold</b>');
  });

  test('the review is stored in MySQL with its rating, linked to the album row', async () => {
    const [[row]] = await pool.execute(
      `SELECT r.user_id, r.review_text, al.external_id, ra.score FROM reviews r
       JOIN albums al ON al.album_id = r.album_id
       JOIN ratings ra ON ra.user_id = r.user_id AND ra.album_id = r.album_id
       WHERE r.review_id = ?`,
      [reviewId],
    );
    assert.equal(row.user_id, alice.user.id);
    assert.equal(row.external_id, ALBUM);
    assert.equal(Number(row.score), 4.5);
  });

  test('the review shows on the album page after a "refresh" (new request)', async () => {
    const res = await guest('GET', `/music/albums/${ALBUM}/reviews`);
    assert.equal(res.status, 200);
    assert.ok(res.body.reviews.some((review) => review.id === reviewId && review.isOwner === false));
    assert.ok(res.body.stats.ratingCount >= 1);
    assert.ok(res.body.stats.averageRating >= 0.5);
  });

  test('a second review of the same album is refused (edit instead)', async () => {
    const res = await alice.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Again', rating: 3 });
    assert.equal(res.status, 409);
  });

  test('two users reviewing one album share one album row (no duplicates)', async () => {
    const res = await bob.call('POST', '/reviews', { targetType: 'album', mbid: ALBUM, text: 'Pretty good.', rating: 3.5 });
    assert.equal(res.status, 201);
    const [[count]] = await pool.execute("SELECT COUNT(*) AS n FROM albums WHERE external_source = 'musicbrainz' AND external_id = ?", [ALBUM]);
    assert.equal(Number(count.n), 1);
  });

  test('song reviews work too', async () => {
    const res = await alice.call('POST', '/reviews', { targetType: 'song', mbid: SONG, text: 'Great opener.', rating: 5 });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.review.target.type, 'song');
    const list = await guest('GET', `/music/songs/${SONG}/reviews`);
    assert.ok(list.body.reviews.some((review) => review.id === res.body.review.id));
  });

  test('owners can edit; created_at is kept, updated_at changes', async () => {
    const [[before]] = await pool.execute('SELECT created_at, updated_at FROM reviews WHERE review_id = ?', [reviewId]);
    await new Promise((resolve) => setTimeout(resolve, 1100)); // TIMESTAMP has 1-second precision
    const res = await alice.call('PATCH', `/reviews/${reviewId}`, { text: 'Even better on a second listen.', rating: 5 });
    assert.equal(res.status, 200);
    assert.equal(res.body.review.text, 'Even better on a second listen.');
    assert.equal(res.body.review.rating, 5);
    const [[after]] = await pool.execute('SELECT created_at, updated_at FROM reviews WHERE review_id = ?', [reviewId]);
    assert.equal(after.created_at.getTime(), before.created_at.getTime());
    assert.ok(after.updated_at > before.updated_at);
  });

  test("users cannot edit or delete another user's review", async () => {
    assert.equal((await bob.call('PATCH', `/reviews/${reviewId}`, { text: 'hacked', rating: 1 })).status, 403);
    assert.equal((await bob.call('DELETE', `/reviews/${reviewId}`)).status, 403);
    assert.equal((await guest('PATCH', `/reviews/${reviewId}`, { text: 'x', rating: 1 })).status, 401);
  });

  test("a user's reviews are listed on their profile", async () => {
    const res = await guest('GET', `/users/${alice.creds.username}/reviews`);
    assert.equal(res.status, 200);
    assert.equal(res.body.reviews.length, 2);
    const profile = await guest('GET', `/users/${alice.creds.username}`);
    assert.equal(profile.body.profile.stats.reviews, 2);
  });

  describe('Use case 4: comments', () => {
    let commentId;

    test('guests can read comments but not post', async () => {
      assert.equal((await guest('GET', `/reviews/${reviewId}/comments`)).status, 200);
      assert.equal((await guest('POST', `/reviews/${reviewId}/comments`, { text: 'hi' })).status, 401);
    });

    test('empty comments are rejected', async () => {
      const res = await bob.call('POST', `/reviews/${reviewId}/comments`, { text: '  ' });
      assert.equal(res.status, 400);
    });

    test('comments on missing reviews are rejected', async () => {
      assert.equal((await bob.call('POST', '/reviews/999999999/comments', { text: 'hi' })).status, 404);
    });

    test('a logged-in user can comment; it is stored and persists', async () => {
      const res = await bob.call('POST', `/reviews/${reviewId}/comments`, { text: 'Totally agree!' });
      assert.equal(res.status, 201);
      commentId = res.body.comment.id;
      assert.equal(res.body.comment.author.username, bob.creds.username);
      const [[row]] = await pool.execute('SELECT review_id, user_id, comment_text FROM comments WHERE comment_id = ?', [commentId]);
      assert.deepEqual({ ...row }, { review_id: reviewId, user_id: bob.user.id, comment_text: 'Totally agree!' });
      const list = await guest('GET', `/reviews/${reviewId}/comments`);
      assert.equal(list.body.comments.length, 1);
      assert.equal(list.body.comments[0].text, 'Totally agree!');
    });

    test('owners can edit their comment; others cannot', async () => {
      assert.equal((await alice.call('PATCH', `/comments/${commentId}`, { text: 'nope' })).status, 403);
      assert.equal((await alice.call('DELETE', `/comments/${commentId}`)).status, 403);
      const res = await bob.call('PATCH', `/comments/${commentId}`, { text: 'Totally agree, edited.' });
      assert.equal(res.status, 200);
      assert.equal(res.body.comment.text, 'Totally agree, edited.');
    });

    test('owners can delete their comment', async () => {
      const second = await bob.call('POST', `/reviews/${reviewId}/comments`, { text: 'Second thought' });
      assert.equal((await bob.call('DELETE', `/comments/${second.body.comment.id}`)).status, 200);
      const list = await guest('GET', `/reviews/${reviewId}/comments`);
      assert.deepEqual(list.body.comments.map((c) => c.id), [commentId]);
    });

    test('removed reviews (moderation) are hidden and cannot be commented on', async () => {
      const temp = await bob.call('POST', '/reviews', { targetType: 'song', mbid: SONG, text: 'Temp', rating: 2 });
      const tempId = temp.body.review.id;
      await pool.execute("INSERT INTO review_reports (review_id, reported_by, reason, status) VALUES (?, ?, 'test', 'removed')", [
        tempId,
        alice.user.id,
      ]);
      assert.equal((await guest('GET', `/reviews/${tempId}`)).status, 404);
      assert.equal((await alice.call('POST', `/reviews/${tempId}/comments`, { text: 'hi' })).status, 404);
      assert.equal((await bob.call('PATCH', `/reviews/${tempId}`, { text: 'edit', rating: 3 })).status, 404);
      const list = await guest('GET', `/music/songs/${SONG}/reviews`);
      assert.ok(!list.body.reviews.some((review) => review.id === tempId));
    });

    test('deleting a review deletes its comments (no orphans)', async () => {
      const temp = await alice.call('POST', '/reviews', { targetType: 'album', mbid: PARACHUTES, text: 'Parachutes is great', rating: 5 });
      assert.equal(temp.status, 201, JSON.stringify(temp.body));
      const tempId = temp.body.review.id;
      await bob.call('POST', `/reviews/${tempId}/comments`, { text: 'Yes!' });
      assert.equal((await alice.call('DELETE', `/reviews/${tempId}`)).status, 200);
      const [[count]] = await pool.execute('SELECT COUNT(*) AS n FROM comments WHERE review_id = ?', [tempId]);
      assert.equal(Number(count.n), 0);
      assert.equal((await guest('GET', `/reviews/${tempId}/comments`)).status, 404);
    });
  });
});

describe('Use case 3: listening diary', () => {
  let entryId;

  test('unauthenticated users cannot use the diary API', async () => {
    assert.equal((await guest('GET', '/diary')).status, 401);
    assert.equal((await guest('POST', '/diary', { targetType: 'album', mbid: ALBUM, listenedOn: '2024-05-01' })).status, 401);
  });

  test('invalid dates are rejected', async () => {
    const res = await alice.call('POST', '/diary', { targetType: 'album', mbid: ALBUM, listenedOn: '2999-01-01' });
    assert.equal(res.status, 400);
    assert.ok(res.body.fieldErrors.listenedOn);
  });

  test('users can create entries, including the same album twice', async () => {
    const first = await alice.call('POST', '/diary', { targetType: 'album', mbid: ALBUM, listenedOn: '2024-05-01', notes: 'Rainy day' });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    entryId = first.body.entry.id;
    assert.equal(first.body.entry.listenedOn, '2024-05-01');
    assert.equal(first.body.entry.target.title, 'In Rainbows');
    const second = await alice.call('POST', '/diary', { targetType: 'album', mbid: ALBUM, listenedOn: '2024-06-15' });
    assert.equal(second.status, 201);
    const song = await alice.call('POST', '/diary', { targetType: 'song', mbid: SONG, listenedOn: '2024-06-16' });
    assert.equal(song.status, 201);
  });

  test('entries persist in MySQL and the listening date is separate from created_at', async () => {
    const [[row]] = await pool.execute(
      "SELECT user_id, DATE_FORMAT(listened_at, '%Y-%m-%d') AS d, notes, created_at, updated_at FROM diary_entries WHERE diary_entry_id = ?",
      [entryId],
    );
    assert.equal(row.user_id, alice.user.id);
    assert.equal(row.d, '2024-05-01');
    assert.equal(row.notes, 'Rainy day');
    assert.ok(row.created_at.getFullYear() >= 2026);
    assert.equal(row.updated_at, null);
  });

  test('users can view their history, newest listen first', async () => {
    const res = await alice.call('GET', '/diary');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.entries.map((e) => e.listenedOn), ['2024-06-16', '2024-06-15', '2024-05-01']);
    assert.equal(res.body.visibility, 'public');
  });

  test('owners can edit entries; others cannot', async () => {
    assert.equal((await bob.call('PATCH', `/diary/${entryId}`, { listenedOn: '2024-01-01', notes: 'x' })).status, 403);
    const res = await alice.call('PATCH', `/diary/${entryId}`, { listenedOn: '2024-05-02', notes: 'Rainy evening' });
    assert.equal(res.status, 200);
    assert.equal(res.body.entry.listenedOn, '2024-05-02');
    assert.equal(res.body.entry.notes, 'Rainy evening');
    assert.ok(res.body.entry.updatedAt);
  });

  test('public diaries are visible to others', async () => {
    const res = await bob.call('GET', `/users/${alice.creds.username}/diary`);
    assert.equal(res.status, 200);
    assert.equal(res.body.entries.length, 3);
  });

  test('private diaries are only visible to their owner (enforced by the API)', async () => {
    assert.equal((await alice.call('PUT', '/diary/settings', { visibility: 'secret' })).status, 400);
    assert.equal((await alice.call('PUT', '/diary/settings', { visibility: 'private' })).status, 200);
    assert.equal((await bob.call('GET', `/users/${alice.creds.username}/diary`)).status, 403);
    assert.equal((await guest('GET', `/users/${alice.creds.username}/diary`)).status, 403);
    const own = await alice.call('GET', `/users/${alice.creds.username}/diary`);
    assert.equal(own.status, 200);
    assert.equal(own.body.entries.length, 3);
    const profile = await guest('GET', `/users/${alice.creds.username}`);
    assert.equal(profile.body.profile.stats.diaryEntries, null); // count hidden too
    await alice.call('PUT', '/diary/settings', { visibility: 'public' });
  });

  test('owners can delete entries; others cannot', async () => {
    assert.equal((await bob.call('DELETE', `/diary/${entryId}`)).status, 403);
    assert.equal((await alice.call('DELETE', `/diary/${entryId}`)).status, 200);
    assert.equal((await alice.call('DELETE', `/diary/${entryId}`)).status, 404);
    const res = await alice.call('GET', '/diary');
    assert.equal(res.body.entries.length, 2);
  });
});

describe('Sprint 2 regression', () => {
  test('session persists across requests (/api/me)', async () => {
    const res = await alice.call('GET', '/me');
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, alice.creds.username);
  });

  test('protected routes reject guests', async () => {
    assert.equal((await guest('GET', '/me')).status, 401);
    assert.equal((await guest('PATCH', '/me', { username: 'x', email: 'x@y.z' })).status, 401);
  });

  test('profile editing still works', async () => {
    const res = await alice.call('PATCH', '/me', {
      username: alice.creds.username,
      email: alice.creds.email,
      displayName: 'Alice Tester',
      bio: 'Testing Sprint 3',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.displayName, 'Alice Tester');
  });

  test('following still works and profiles still load', async () => {
    assert.equal((await bob.call('POST', `/users/${alice.creds.username}/follow`)).status, 200);
    const profile = await guest('GET', `/users/${alice.creds.username}`);
    assert.equal(profile.body.profile.stats.followers, 1);
    assert.equal((await bob.call('DELETE', `/users/${alice.creds.username}/follow`)).status, 200);
  });

  test('duplicate registration is refused and wrong passwords fail', async () => {
    const dup = await guest('POST', '/auth/register', { ...alice.creds, confirmPassword: alice.creds.password });
    assert.equal(dup.status, 409);
    const bad = await guest('POST', '/auth/login', { identifier: alice.creds.username, password: 'wrong-password' });
    assert.equal(bad.status, 401);
  });

  test('logout ends the session', async () => {
    const carol = await registerAndLogin('carol');
    assert.equal((await carol.call('GET', '/me')).status, 200);
    assert.equal((await carol.call('POST', '/auth/logout')).status, 200);
    assert.equal((await carol.call('GET', '/me')).status, 401);
    assert.equal((await carol.call('POST', '/diary', { targetType: 'album', mbid: ALBUM, listenedOn: '2024-01-01' })).status, 401);
  });
});
