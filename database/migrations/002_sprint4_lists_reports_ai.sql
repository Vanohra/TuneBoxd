-- ============================================================
-- Migration 002 (Sprint 4): custom lists, review reports, AI tables
--
-- Sprint 4 adds custom music lists (#10, #16), review reports and moderation
-- (#15, #17, #18), listening statistics (#19), recommendations (#13) and
-- listening summaries (#14). All of them use tables that are already in
-- database/schema.sql. This migration only creates any of those tables that
-- are missing (for databases built from an older copy of the schema).
--
-- Safe to run more than once, and additive only: nothing is dropped,
-- truncated or rewritten, and existing rows are untouched.
--
-- Run in MySQL Workbench against music_review_app, or:
--   npm --prefix backend run migrate
-- ============================================================

CREATE TABLE IF NOT EXISTS lists (
    list_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_list_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS list_albums (
    list_id INT NOT NULL,
    album_id INT NOT NULL,
    position INT UNSIGNED,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, album_id),
    FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS list_songs (
    list_id INT NOT NULL,
    song_id INT NOT NULL,
    position INT UNSIGNED,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (list_id, song_id),
    FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(song_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS review_reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    review_id INT NOT NULL,
    reported_by INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    status ENUM('pending', 'reviewed', 'dismissed', 'removed') NOT NULL DEFAULT 'pending',
    reviewed_by INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    UNIQUE (review_id, reported_by),
    INDEX idx_report_status (status),
    FOREIGN KEY (review_id) REFERENCES reviews(review_id) ON DELETE CASCADE,
    FOREIGN KEY (reported_by) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS recommendations (
    recommendation_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    album_id INT,
    song_id INT,
    reason TEXT,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_recommendation_target CHECK (
        (album_id IS NOT NULL AND song_id IS NULL) OR (album_id IS NULL AND song_id IS NOT NULL)
    ),
    INDEX idx_recommendation_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(song_id) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS listening_summaries (
    summary_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    summary_text TEXT NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_summary_dates CHECK (period_end >= period_start),
    INDEX idx_summary_user (user_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE = InnoDB;
