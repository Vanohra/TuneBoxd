-- ============================================================
-- MUSIC REVIEW APPLICATION DATABASE
-- "Letterboxd for Music"
-- MySQL Schema
-- ============================================================


-- ============================================================
-- CREATE DATABASE
-- ============================================================

CREATE DATABASE IF NOT EXISTS music_review_app
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE music_review_app;


-- ============================================================
-- 1. USERS
-- Handles registration, login, profiles, and admin privileges
-- ============================================================

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),

    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',

    account_status ENUM('active', 'suspended')
        NOT NULL DEFAULT 'active',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
) ENGINE = InnoDB;


-- ============================================================
-- 2. USER SETTINGS
-- Stores user privacy/preferences
-- ============================================================

CREATE TABLE user_settings (
    user_id INT PRIMARY KEY,

    diary_visibility ENUM('public', 'private')
        NOT NULL DEFAULT 'public',

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 3. ARTISTS
-- Music artist information
-- ============================================================

CREATE TABLE artists (
    artist_id INT AUTO_INCREMENT PRIMARY KEY,

    external_source VARCHAR(50),
    external_id VARCHAR(255),

    name VARCHAR(255) NOT NULL,
    biography TEXT,
    image_url VARCHAR(500),

    UNIQUE (external_source, external_id),

    INDEX idx_artist_name (name)
) ENGINE = InnoDB;


-- ============================================================
-- 4. ALBUMS
-- Album information
-- Each album has one primary artist
-- ============================================================

CREATE TABLE albums (
    album_id INT AUTO_INCREMENT PRIMARY KEY,

    external_source VARCHAR(50),
    external_id VARCHAR(255),

    artist_id INT NOT NULL,

    title VARCHAR(255) NOT NULL,
    release_date DATE,
    cover_url VARCHAR(500),

    UNIQUE (external_source, external_id),

    INDEX idx_album_title (title),
    INDEX idx_album_artist (artist_id),

    FOREIGN KEY (artist_id)
        REFERENCES artists(artist_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB;


-- ============================================================
-- 5. SONGS
-- Song information
-- ============================================================

CREATE TABLE songs (
    song_id INT AUTO_INCREMENT PRIMARY KEY,

    external_source VARCHAR(50),
    external_id VARCHAR(255),

    album_id INT,
    artist_id INT NOT NULL,

    title VARCHAR(255) NOT NULL,
    track_number INT,
    duration_seconds INT UNSIGNED,

    UNIQUE (external_source, external_id),

    INDEX idx_song_title (title),
    INDEX idx_song_album (album_id),
    INDEX idx_song_artist (artist_id),

    FOREIGN KEY (album_id)
        REFERENCES albums(album_id)
        ON DELETE SET NULL,

    FOREIGN KEY (artist_id)
        REFERENCES artists(artist_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB;


-- ============================================================
-- 6. RATINGS
-- Users can rate either an album OR a song
-- ============================================================

CREATE TABLE ratings (
    rating_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,
    album_id INT,
    song_id INT,

    score DECIMAL(2,1) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_rating_target
        CHECK (
            (album_id IS NOT NULL AND song_id IS NULL)
            OR
            (album_id IS NULL AND song_id IS NOT NULL)
        ),

    CONSTRAINT chk_rating_score
        CHECK (score >= 0.5 AND score <= 5.0),

    -- One rating per user per album
    UNIQUE (user_id, album_id),

    -- One rating per user per song
    UNIQUE (user_id, song_id),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (album_id)
        REFERENCES albums(album_id)
        ON DELETE CASCADE,

    FOREIGN KEY (song_id)
        REFERENCES songs(song_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 7. REVIEWS
-- Users can write/edit reviews for albums or songs
-- ============================================================

CREATE TABLE reviews (
    review_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,
    album_id INT,
    song_id INT,

    review_text TEXT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT chk_review_target
        CHECK (
            (album_id IS NOT NULL AND song_id IS NULL)
            OR
            (album_id IS NULL AND song_id IS NOT NULL)
        ),

    -- One review per user per album
    UNIQUE (user_id, album_id),

    -- One review per user per song
    UNIQUE (user_id, song_id),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (album_id)
        REFERENCES albums(album_id)
        ON DELETE CASCADE,

    FOREIGN KEY (song_id)
        REFERENCES songs(song_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 8. REVIEW LIKES
-- Many-to-many relationship between users and reviews
-- ============================================================

CREATE TABLE review_likes (
    user_id INT NOT NULL,
    review_id INT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (user_id, review_id),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (review_id)
        REFERENCES reviews(review_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 9. COMMENTS
-- Comments made on reviews
-- ============================================================

CREATE TABLE comments (
    comment_id INT AUTO_INCREMENT PRIMARY KEY,

    review_id INT NOT NULL,
    user_id INT NOT NULL,

    comment_text TEXT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_comment_review (review_id),

    FOREIGN KEY (review_id)
        REFERENCES reviews(review_id)
        ON DELETE CASCADE,

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 10. FOLLOWS
-- User-to-user following relationship
-- ============================================================

CREATE TABLE follows (
    follower_id INT NOT NULL,
    following_id INT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (follower_id, following_id),

    CONSTRAINT chk_no_self_follow
        CHECK (follower_id <> following_id),

    FOREIGN KEY (follower_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (following_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 11. LISTENING DIARY
-- Records albums/songs that users listen to
-- ============================================================

CREATE TABLE diary_entries (
    diary_entry_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    album_id INT,
    song_id INT,

    listened_at DATETIME NOT NULL,

    notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_diary_target
        CHECK (
            (album_id IS NOT NULL AND song_id IS NULL)
            OR
            (album_id IS NULL AND song_id IS NOT NULL)
        ),

    INDEX idx_diary_user_date (user_id, listened_at),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (album_id)
        REFERENCES albums(album_id)
        ON DELETE CASCADE,

    FOREIGN KEY (song_id)
        REFERENCES songs(song_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 12. CUSTOM LISTS
-- User-created collections of music
-- ============================================================

CREATE TABLE lists (
    list_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    title VARCHAR(255) NOT NULL,
    description TEXT,

    is_public BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_list_user (user_id),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 13. ALBUMS INSIDE CUSTOM LISTS
-- ============================================================

CREATE TABLE list_albums (
    list_id INT NOT NULL,
    album_id INT NOT NULL,

    position INT UNSIGNED,

    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (list_id, album_id),

    FOREIGN KEY (list_id)
        REFERENCES lists(list_id)
        ON DELETE CASCADE,

    FOREIGN KEY (album_id)
        REFERENCES albums(album_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 14. SONGS INSIDE CUSTOM LISTS
-- ============================================================

CREATE TABLE list_songs (
    list_id INT NOT NULL,
    song_id INT NOT NULL,

    position INT UNSIGNED,

    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (list_id, song_id),

    FOREIGN KEY (list_id)
        REFERENCES lists(list_id)
        ON DELETE CASCADE,

    FOREIGN KEY (song_id)
        REFERENCES songs(song_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 15. REVIEW REPORTS
-- Allows users to flag inappropriate reviews for administrators
-- ============================================================

CREATE TABLE review_reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,

    review_id INT NOT NULL,
    reported_by INT NOT NULL,

    reason VARCHAR(255) NOT NULL,
    details TEXT,

    status ENUM(
        'pending',
        'reviewed',
        'dismissed',
        'removed'
    ) NOT NULL DEFAULT 'pending',

    reviewed_by INT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    reviewed_at DATETIME,

    -- Prevent the same user from repeatedly reporting one review
    UNIQUE (review_id, reported_by),

    INDEX idx_report_status (status),

    FOREIGN KEY (review_id)
        REFERENCES reviews(review_id)
        ON DELETE CASCADE,

    FOREIGN KEY (reported_by)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (reviewed_by)
        REFERENCES users(user_id)
        ON DELETE SET NULL
) ENGINE = InnoDB;


-- ============================================================
-- 16. AI RECOMMENDATIONS
-- Optional persistence for generated recommendations
-- ============================================================

CREATE TABLE recommendations (
    recommendation_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    album_id INT,
    song_id INT,

    reason TEXT,

    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_recommendation_target
        CHECK (
            (album_id IS NOT NULL AND song_id IS NULL)
            OR
            (album_id IS NULL AND song_id IS NOT NULL)
        ),

    INDEX idx_recommendation_user (user_id),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    FOREIGN KEY (album_id)
        REFERENCES albums(album_id)
        ON DELETE CASCADE,

    FOREIGN KEY (song_id)
        REFERENCES songs(song_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;


-- ============================================================
-- 17. AI / LISTENING SUMMARIES
-- Saves generated summaries for a particular time period
-- ============================================================

CREATE TABLE listening_summaries (
    summary_id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    summary_text TEXT NOT NULL,

    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_summary_dates
        CHECK (period_end >= period_start),

    INDEX idx_summary_user (user_id),

    FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
) ENGINE = InnoDB;