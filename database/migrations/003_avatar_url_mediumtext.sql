-- ============================================================
-- Migration 003: allow profile picture uploads
--
-- The Edit Profile page sends the profile picture as a base64 data URL (a
-- resized 256x256 JPEG, roughly 15-40 KB). users.avatar_url was VARCHAR(500),
-- far too small, so every upload was rejected. MEDIUMTEXT holds up to 16 MB;
-- the backend caps avatars at 350,000 characters.
--
-- Safe to run more than once. Widening the column keeps every existing value.
--
-- Run in MySQL Workbench against music_review_app, or:
--   npm --prefix backend run migrate
-- ============================================================

SET @needs_change := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar_url'
    AND DATA_TYPE <> 'mediumtext'
);

SET @ddl := IF(
  @needs_change = 1,
  'ALTER TABLE users MODIFY avatar_url MEDIUMTEXT NULL',
  'SELECT ''users.avatar_url is already MEDIUMTEXT'' AS note'
);

PREPARE migration_stmt FROM @ddl;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
