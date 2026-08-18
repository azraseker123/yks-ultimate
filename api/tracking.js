// Vercel Functions - api/[tracking]/[endpoint].js
// Place these files in: vercel project/api/exams/[endpoint].js, etc.

import { sql } from '@vercel/postgres';
import { verifyToken } from './auth';

function getAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    return verifyToken(token);
}

// ===== EXAMS =====
export async function addExam(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { type, name, score, date } = req.body;
    if (!type || !name || score === undefined || !date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await sql`
            INSERT INTO exams (userId, type, name, score, date, createdAt)
            VALUES (${decoded.userId}, ${type}, ${name}, ${score}, ${date}, NOW())
        `;
        return res.status(201).json({ message: 'Exam added' });
    } catch (err) {
        console.error('Add exam error:', err);
        return res.status(500).json({ error: 'Failed to add exam' });
    }
}

export async function listExams(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const result = await sql`
            SELECT id, type, name, score, date FROM exams WHERE userId = ${decoded.userId} ORDER BY date DESC
        `;
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('List exams error:', err);
        return res.status(500).json({ error: 'Failed to list exams' });
    }
}

export async function deleteExam(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;

    try {
        await sql`DELETE FROM exams WHERE id = ${id} AND userId = ${decoded.userId}`;
        return res.status(200).json({ message: 'Exam deleted' });
    } catch (err) {
        console.error('Delete exam error:', err);
        return res.status(500).json({ error: 'Failed to delete exam' });
    }
}

// ===== QUESTIONS =====
export async function addQuestion(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, topic, correct, wrong } = req.body;
    if (!subject || !topic || correct === undefined || wrong === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await sql`
            INSERT INTO questions (userId, subject, topic, correct, wrong, createdAt)
            VALUES (${decoded.userId}, ${subject}, ${topic}, ${correct}, ${wrong}, NOW())
        `;
        return res.status(201).json({ message: 'Question stat added' });
    } catch (err) {
        console.error('Add question error:', err);
        return res.status(500).json({ error: 'Failed to add question stat' });
    }
}

export async function listQuestions(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const result = await sql`
            SELECT id, subject, topic, correct, wrong FROM questions WHERE userId = ${decoded.userId} ORDER BY createdAt DESC
        `;
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('List questions error:', err);
        return res.status(500).json({ error: 'Failed to list questions' });
    }
}

export async function deleteQuestion(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;

    try {
        await sql`DELETE FROM questions WHERE id = ${id} AND userId = ${decoded.userId}`;
        return res.status(200).json({ message: 'Question deleted' });
    } catch (err) {
        console.error('Delete question error:', err);
        return res.status(500).json({ error: 'Failed to delete question' });
    }
}

// ===== SLEEP =====
export async function addSleep(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { date, hours } = req.body;
    if (!date || hours === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await sql`
            INSERT INTO sleep (userId, date, hours, createdAt)
            VALUES (${decoded.userId}, ${date}, ${hours}, NOW())
        `;
        return res.status(201).json({ message: 'Sleep log added' });
    } catch (err) {
        console.error('Add sleep error:', err);
        return res.status(500).json({ error: 'Failed to add sleep log' });
    }
}

export async function listSleep(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const result = await sql`
            SELECT id, date, hours FROM sleep WHERE userId = ${decoded.userId} ORDER BY date DESC LIMIT 30
        `;
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('List sleep error:', err);
        return res.status(500).json({ error: 'Failed to list sleep logs' });
    }
}

export async function deleteSleep(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;

    try {
        await sql`DELETE FROM sleep WHERE id = ${id} AND userId = ${decoded.userId}`;
        return res.status(200).json({ message: 'Sleep log deleted' });
    } catch (err) {
        console.error('Delete sleep error:', err);
        return res.status(500).json({ error: 'Failed to delete sleep log' });
    }
}

// ===== SCHEDULE =====
export async function addSchedule(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { day, subject, topics, duration } = req.body;
    if (!day || !subject || !topics || !duration) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await sql`
            INSERT INTO schedule (userId, day, subject, topics, duration, createdAt)
            VALUES (${decoded.userId}, ${day}, ${subject}, ${topics}, ${duration}, NOW())
        `;
        return res.status(201).json({ message: 'Schedule item added' });
    } catch (err) {
        console.error('Add schedule error:', err);
        return res.status(500).json({ error: 'Failed to add schedule item' });
    }
}

export async function listSchedule(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const result = await sql`
            SELECT id, day, subject, topics, duration FROM schedule WHERE userId = ${decoded.userId} ORDER BY createdAt DESC
        `;
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('List schedule error:', err);
        return res.status(500).json({ error: 'Failed to list schedule' });
    }
}

export async function deleteSchedule(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;

    try {
        await sql`DELETE FROM schedule WHERE id = ${id} AND userId = ${decoded.userId}`;
        return res.status(200).json({ message: 'Schedule item deleted' });
    } catch (err) {
        console.error('Delete schedule error:', err);
        return res.status(500).json({ error: 'Failed to delete schedule item' });
    }
}

// ===== BADGES =====
export async function listBadges(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const result = await sql`
            SELECT badgeId, unlockedAt FROM badges WHERE userId = ${decoded.userId}
        `;
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('List badges error:', err);
        return res.status(500).json({ error: 'Failed to list badges' });
    }
}

export async function unlockBadge(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { badgeId } = req.body;
    if (!badgeId) {
        return res.status(400).json({ error: 'Badge ID required' });
    }

    try {
        await sql`
            INSERT INTO badges (userId, badgeId, unlockedAt)
            VALUES (${decoded.userId}, ${badgeId}, NOW())
            ON CONFLICT DO NOTHING
        `;
        return res.status(201).json({ message: 'Badge unlocked' });
    } catch (err) {
        console.error('Unlock badge error:', err);
        return res.status(500).json({ error: 'Failed to unlock badge' });
    }
}

// ===== POMODORO =====
export async function logPomodoro(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { count } = req.body;
    if (count === undefined) {
        return res.status(400).json({ error: 'Count required' });
    }

    try {
        const result = await sql`
            SELECT pomodoro FROM userdata WHERE userId = ${decoded.userId}
        `;

        const current = result.rows[0]?.pomodoro || 0;
        const newCount = current + count;

        await sql`
            UPDATE userdata SET pomodoro = ${newCount} WHERE userId = ${decoded.userId}
        `;

        return res.status(200).json({ message: 'Pomodoro logged' });
    } catch (err) {
        console.error('Log pomodoro error:', err);
        return res.status(500).json({ error: 'Failed to log pomodoro' });
    }
}
