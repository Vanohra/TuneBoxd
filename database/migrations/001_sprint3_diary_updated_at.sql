-- ============================================================
-- Migration 001 (Sprint 3): diary entry edit timestamp
--
-- Sprint 3 lets users edit diary entries. Reviews and comments already have
-- created_at + updated_at; diary_entries only had created_at. This adds an
-- updated_at column so an edited entry records when it was changed.
--
-- Safe to run more than once, and additive only: no table is dropped,
-- truncated or rewritten, and existing rows are untouched (updated_at = NULL
-- means "never edited").
--
-- Every other Sprint 3 feature uses tables that already exist in
-- music_review_app (artists, albums, songs, reviews, ratings, comments,
-- diary_entries, user_settings, review_reports).
--
-- Run in MySQL Workbench against music_review_app, or:
--   npm --prefix backend run migrate
-- ============================================================

SET @column_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'diary_entries'
    AND COLUMN_NAME = 'updated_at'
);

SET @ddl := IF(
  @column_exists = 0,
  'ALTER TABLE diary_entries ADD COLUMN updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
  'SELECT ''diary_entries.updated_at already exists'' AS note'
);

PREPARE migration_stmt FROM @ddl;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
