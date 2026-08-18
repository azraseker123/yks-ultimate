-- PostgreSQL Database Schema
-- Run this script in your Vercel PostgreSQL database

-- ===== USERS TABLE =====
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    goal VARCHAR(50) NOT NULL, -- 'tyt', 'ayt', 'both'
    isPro BOOLEAN DEFAULT false,
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);

-- ===== USER DATA (Persistent Storage) =====
CREATE TABLE IF NOT EXISTS userdata (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    curriculum JSONB DEFAULT '{}',
    exams JSONB DEFAULT '[]',
    questions JSONB DEFAULT '[]',
    sleep JSONB DEFAULT '[]',
    schedule JSONB DEFAULT '[]',
    badges JSONB DEFAULT '{}',
    pomodoro INTEGER DEFAULT 0,
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);

-- ===== EXAMS TABLE =====
CREATE TABLE IF NOT EXISTS exams (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'tyt', 'ayt'
    name VARCHAR(255) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    date DATE NOT NULL,
    createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_exams_userId ON exams(userId);
CREATE INDEX idx_exams_date ON exams(date);

-- ===== QUESTIONS TABLE =====
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(100) NOT NULL, -- 'turkish', 'math', 'geometry', 'physics', 'chemistry', 'biology'
    topic VARCHAR(255) NOT NULL,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_questions_userId ON questions(userId);

-- ===== SLEEP TABLE =====
CREATE TABLE IF NOT EXISTS sleep (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    hours DECIMAL(4,2) NOT NULL,
    createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sleep_userId ON sleep(userId);
CREATE INDEX idx_sleep_date ON sleep(date);

-- ===== SCHEDULE TABLE =====
CREATE TABLE IF NOT EXISTS schedule (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day VARCHAR(20) NOT NULL, -- 'monday', 'tuesday', etc.
    subject VARCHAR(255) NOT NULL,
    topics TEXT NOT NULL,
    duration INTEGER NOT NULL, -- minutes
    createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_schedule_userId ON schedule(userId);

-- ===== BADGES TABLE =====
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badgeId VARCHAR(100) NOT NULL,
    unlockedAt TIMESTAMP DEFAULT NOW(),
    UNIQUE(userId, badgeId)
);

CREATE INDEX idx_badges_userId ON badges(userId);

-- ===== LICENSE CODES TABLE =====
CREATE TABLE IF NOT EXISTS licenses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    used BOOLEAN DEFAULT false,
    userId INTEGER REFERENCES users(id),
    usedAt TIMESTAMP,
    createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_licenses_code ON licenses(code);
CREATE INDEX idx_licenses_used ON licenses(used);

-- ===== FLASHCARD ARCHIVE =====
CREATE TABLE IF NOT EXISTS flashcard_archive (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_flashcard_userId ON flashcard_archive(userId);

-- ===== QUESTION ARCHIVE (Photo Solver) =====
CREATE TABLE IF NOT EXISTS question_archive (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    photo BYTEA NOT NULL,
    solution TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_question_archive_userId ON question_archive(userId);

-- ===== HELPFUL FUNCTIONS =====

-- Function to generate license codes
CREATE OR REPLACE FUNCTION generate_license_code()
RETURNS VARCHAR(50) AS $$
DECLARE
    code VARCHAR(50);
BEGIN
    code := UPPER(
        SUBSTRING(MD5(RANDOM()::TEXT), 1, 4) || '-' ||
        SUBSTRING(MD5(RANDOM()::TEXT), 1, 4) || '-' ||
        SUBSTRING(MD5(RANDOM()::TEXT), 1, 4) || '-' ||
        SUBSTRING(MD5(RANDOM()::TEXT), 1, 4)
    );
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- ===== INSERT SAMPLE LICENSE CODES =====
-- Run this to generate some test license codes
-- SELECT generate_license_code() FROM generate_series(1, 100);

-- To insert them:
INSERT INTO licenses (code, used)
SELECT generate_license_code(), false
FROM generate_series(1, 50)
ON CONFLICT DO NOTHING;

-- ===== HELPER VIEWS =====

-- User activity summary
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.goal,
    u.isPro,
    COUNT(DISTINCT e.id) as exam_count,
    COUNT(DISTINCT q.id) as question_count,
    COUNT(DISTINCT s.id) as sleep_count,
    COUNT(DISTINCT sch.id) as schedule_count,
    MAX(e.date) as last_exam_date,
    AVG(e.score) as avg_exam_score
FROM users u
LEFT JOIN exams e ON u.id = e.userId
LEFT JOIN questions q ON u.id = q.userId
LEFT JOIN sleep s ON u.id = s.userId
LEFT JOIN schedule sch ON u.id = sch.userId
GROUP BY u.id;

-- ===== INDEXES FOR PERFORMANCE =====

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_isPro ON users(isPro);
CREATE INDEX idx_userdata_userId ON userdata(userId);

-- ===== ENABLE ROW-LEVEL SECURITY (Optional but Recommended) =====
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sleep ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE flashcard_archive ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE question_archive ENABLE ROW LEVEL SECURITY;
