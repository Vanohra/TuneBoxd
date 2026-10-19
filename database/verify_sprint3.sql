-- ============================================================
-- Sprint 3 verification queries (read-only)
-- Run in MySQL Workbench against music_review_app after using the app.
-- ============================================================

USE music_review_app;

-- 0. Migration 001 applied? Expect one row: updated_at | timestamp | YES
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'diary_entries' AND COLUMN_NAME = 'updated_at';

-- 1. Music saved locally from MusicBrainz (one row per MBID, never duplicated)
SELECT a.album_id, a.external_id AS release_group_mbid, a.title, ar.name AS artist, a.release_date, a.cover_url
FROM albums a JOIN artists ar ON ar.artist_id = a.artist_id
WHERE a.external_source = 'musicbrainz'
ORDER BY a.album_id DESC;

SELECT s.song_id, s.external_id AS recording_mbid, s.title, ar.name AS artist, al.title AS album
FROM songs s
JOIN artists ar ON ar.artist_id = s.artist_id
LEFT JOIN albums al ON al.album_id = s.album_id
ORDER BY s.song_id DESC;

-- Duplicate check: should return no rows
SELECT external_source, external_id, COUNT(*) AS copies FROM albums GROUP BY external_source, external_id HAVING COUNT(*) > 1;

-- 2. Reviews with their rating (rating lives in `ratings`, joined on user + target)
SELECT r.review_id, u.username,
       COALESCE(al.title, s.title) AS reviewed_item,
       IF(r.album_id IS NOT NULL, 'album', 'song') AS item_type,
       COALESCE(ra.score, rs.score) AS rating,
       LEFT(r.review_text, 80) AS review_text,
       r.created_at, r.updated_at
FROM reviews r
JOIN users u ON u.user_id = r.user_id
LEFT JOIN albums al ON al.album_id = r.album_id
LEFT JOIN songs s ON s.song_id = r.song_id
LEFT JOIN ratings ra ON ra.user_id = r.user_id AND ra.album_id = r.album_id
LEFT JOIN ratings rs ON rs.user_id = r.user_id AND rs.song_id = r.song_id
ORDER BY r.created_at DESC;

-- Average rating per album (what the album page shows)
SELECT al.title, ROUND(AVG(rt.score), 2) AS average_rating, COUNT(*) AS ratings
FROM ratings rt JOIN albums al ON al.album_id = rt.album_id
GROUP BY al.album_id, al.title
ORDER BY ratings DESC;

-- 3. Comments on reviews
SELECT c.comment_id, c.review_id, u.username AS commenter, c.comment_text, c.created_at, c.updated_at
FROM comments c JOIN users u ON u.user_id = c.user_id
ORDER BY c.review_id, c.created_at;

-- Orphan check: should return no rows (comments.review_id has ON DELETE CASCADE)
SELECT c.comment_id FROM comments c LEFT JOIN reviews r ON r.review_id = c.review_id WHERE r.review_id IS NULL;

-- 4. Listening diary (listened_at = the day of the listen; created_at = when it was logged)
SELECT d.diary_entry_id, u.username,
       COALESCE(al.title, s.title) AS item,
       DATE(d.listened_at) AS listened_on,
       d.notes, d.created_at, d.updated_at
FROM diary_entries d
JOIN users u ON u.user_id = d.user_id
LEFT JOIN albums al ON al.album_id = d.album_id
LEFT JOIN songs s ON s.song_id = d.song_id
ORDER BY u.username, d.listened_at DESC;

-- Diary privacy (no row = default 'public')
SELECT u.username, COALESCE(us.diary_visibility, 'public') AS diary_visibility
FROM users u LEFT JOIN user_settings us ON us.user_id = u.user_id
ORDER BY u.username;

-- 5. Reviews hidden by moderation (status = 'removed' hides a review everywhere)
SELECT rr.review_id, rr.status, rr.reason, rr.created_at FROM review_reports rr WHERE rr.status = 'removed';
