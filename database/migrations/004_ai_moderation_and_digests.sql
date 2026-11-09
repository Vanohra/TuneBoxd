-- ============================================================
-- Migration 004: AI moderation assistant and review digests
--
-- review_ai_assessments: Google Gemini's read of a reported review (verdict,
--   severity 0-100, suggested action, explanation) for administrators. One row
--   per review; review_updated_at records which version of the review was read.
-- review_digests: a cached "What listeners are saying" summary of all reviews
--   of an album or song. `fingerprint` (review count + latest edit) tells the
--   backend when the reviews changed and the digest should be rewritten.
--
-- Safe to run more than once, and additive only: nothing is dropped or rewritten.
--
-- Run in MySQL Workbench against music_review_app, or:
--   npm --prefix backend run migrate
-- ============================================================

CREATE TABLE IF NOT EXISTS review_ai_assessments (
    review_id INT PRIMARY KEY,

    verdict VARCHAR(30) NOT NULL,
    severity TINYINT UNSIGNED NOT NULL,
    suggested_action VARCHAR(20) NOT NULL,
    explanation VARCHAR(600) NOT NULL,

    model VARCHAR(100),
    review_updated_at TIMESTAMP NULL,
    analyzed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_assessment_severity CHECK (severity <= 100),

    FOREIGN KEY (review_id)
        REFERENCES reviews(review_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS review_digests (
    digest_id INT AUTO_INCREMENT PRIMARY KEY,

    album_id INT,
    song_id INT,

    summary_text TEXT NOT NULL,
    liked_points TEXT,
    disliked_points TEXT,
    overall_sentiment VARCHAR(20) NOT NULL,

    review_count INT UNSIGNED NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    model VARCHAR(100),
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_digest_target CHECK (
        (album_id IS NOT NULL AND song_id IS NULL) OR (album_id IS NULL AND song_id IS NOT NULL)
    ),

    UNIQUE (album_id),
    UNIQUE (song_id),

    FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(song_id) ON DELETE CASCADE
) ENGINE = InnoDB;
