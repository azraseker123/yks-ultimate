import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;


// ==============================
// TOKEN KONTROLÜ
// ==============================
function verifyToken(token) {
    try {
        if (!JWT_SECRET) return null;
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}


// ==============================
// KULLANICI KİMLİĞİNİ AL
// ==============================
function getAuthenticatedUser(req, res) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No authorization token' });
        return null;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
        res.status(401).json({ error: 'Invalid token' });
        return null;
    }

    return decoded;
}


// ==============================
// PROFİL
// GET /api/user/profile
// ==============================
async function profile(req, res) {
    const decoded = getAuthenticatedUser(req, res);
    if (!decoded) return;

    try {
        const userResult = await pool.query(
            `SELECT id, name, email, goal, "isPro"
             FROM users
             WHERE id = $1`,
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        const dataResult = await pool.query(
            `SELECT curriculum, exams, questions, sleep, schedule, badges
             FROM userdata
             WHERE "userId" = $1`,
            [user.id]
        );

        const userData = dataResult.rows[0] || {
            curriculum: {},
            exams: [],
            questions: [],
            sleep: [],
            schedule: [],
            badges: {}
        };

        return res.status(200).json({
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                goal: user.goal,
                isPro: user.isPro
            },
            data: {
                curriculum: userData.curriculum || {},
                exams: userData.exams || [],
                questions: userData.questions || [],
                sleep: userData.sleep || [],
                schedule: userData.schedule || [],
                badges: userData.badges || {}
            }
        });

    } catch (err) {
        console.error('Profile error:', err);
        return res.status(500).json({ error: 'Failed to load profile' });
    }
}


// ==============================
// PROFİL GÜNCELLE
// POST /api/user/profile/update
// ==============================
async function updateProfile(req, res) {
    const decoded = getAuthenticatedUser(req, res);
    if (!decoded) return;

    const { name, goal } = req.body || {};

    if (!name || !goal) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await pool.query(
            `UPDATE users
             SET name = $1, goal = $2
             WHERE id = $3
             RETURNING id, name, email, goal, "isPro"`,
            [name, goal, decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({
            message: 'Profile updated',
            user: result.rows[0]
        });

    } catch (err) {
        console.error('Update profile error:', err);
        return res.status(500).json({ error: 'Failed to update profile' });
    }
}


// ==============================
// MÜFREDAT
// POST /api/user/curriculum
// ==============================
async function curriculum(req, res) {
    const decoded = getAuthenticatedUser(req, res);
    if (!decoded) return;

    const { key, checked } = req.body || {};

    if (!key) {
        return res.status(400).json({ error: 'Missing key' });
    }

    try {
        const result = await pool.query(
            `SELECT curriculum
             FROM userdata
             WHERE "userId" = $1`,
            [decoded.userId]
        );

        let currentCurriculum = {};

        if (result.rows.length > 0 && result.rows[0].curriculum) {
            currentCurriculum = result.rows[0].curriculum;
        }

        currentCurriculum[key] = checked;

        await pool.query(
            `UPDATE userdata
             SET curriculum = $1::jsonb
             WHERE "userId" = $2`,
            [JSON.stringify(currentCurriculum), decoded.userId]
        );

        return res.status(200).json({
            message: 'Curriculum updated'
        });

    } catch (err) {
        console.error('Curriculum error:', err);
        return res.status(500).json({ error: 'Failed to update curriculum' });
    }
}


// ==============================
// ŞİFRE DEĞİŞTİR
// POST /api/user/change-password
// ==============================
async function changePassword(req, res) {
    const decoded = getAuthenticatedUser(req, res);
    if (!decoded) return;

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            error: 'New password must be at least 6 characters'
        });
    }

    try {
        const result = await pool.query(
            `SELECT password
             FROM users
             WHERE id = $1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(
            currentPassword,
            result.rows[0].password
        );

        if (!isValid) {
            return res.status(401).json({
                error: 'Current password is incorrect'
            });
        }

        const hashedPassword = await bcrypt.hash(
            newPassword,
            BCRYPT_ROUNDS
        );

        await pool.query(
            `UPDATE users
             SET password = $1
             WHERE id = $2`,
            [hashedPassword, decoded.userId]
        );

        return res.status(200).json({
            message: 'Password changed successfully'
        });

    } catch (err) {
        console.error('Password change error:', err);
        return res.status(500).json({
            error: 'Failed to change password'
        });
    }
}


// ==============================
// PRO AKTİVASYON
// POST /api/user/activate-pro
// ==============================
async function activatePro(req, res) {
    const decoded = getAuthenticatedUser(req, res);
    if (!decoded) return;

    const { code } = req.body || {};

    if (!code) {
        return res.status(400).json({
            error: 'License code required'
        });
    }

    try {
        const licenseResult = await pool.query(
            `SELECT id, used, "userId"
             FROM licenses
             WHERE code = $1`,
            [code]
        );

        if (licenseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'Invalid license code'
            });
        }

        const license = licenseResult.rows[0];

        if (license.used) {
            return res.status(409).json({
                error: 'This license code has already been used'
            });
        }

        await pool.query(
            `UPDATE licenses
             SET used = true,
                 "userId" = $1,
                 "usedAt" = NOW()
             WHERE id = $2`,
            [decoded.userId, license.id]
        );

        await pool.query(
            `UPDATE users
             SET "isPro" = true
             WHERE id = $1`,
            [decoded.userId]
        );

        return res.status(200).json({
            message: 'Pro activation successful',
            isPro: true
        });

    } catch (err) {
        console.error('Pro activation error:', err);
        return res.status(500).json({
            error: 'Failed to activate Pro'
        });
    }
}


// ==============================
// HESABI SİL
// DELETE/POST /api/user/delete-account
// ==============================
async function deleteAccount(req, res) {
    const decoded = getAuthenticatedUser(req, res);
    if (!decoded) return;

    try {
        await pool.query(
            `DELETE FROM userdata
             WHERE "userId" = $1`,
            [decoded.userId]
        );

        await pool.query(
            `DELETE FROM users
             WHERE id = $1`,
            [decoded.userId]
        );

        return res.status(200).json({
            message: 'Account deleted'
        });

    } catch (err) {
        console.error('Delete account error:', err);
        return res.status(500).json({
            error: 'Failed to delete account'
        });
    }
}


// ==============================
// DASHBOARD
// GET /api/user/dashboard
// ==============================
async function dashboard(req, res) {
    const decoded = getAuthenticatedUser(req, res);
    if (!decoded) return;

    try {
        const dataResult = await pool.query(
            `SELECT questions, exams
             FROM userdata
             WHERE "userId" = $1`,
            [decoded.userId]
        );

        const data = dataResult.rows[0] || {
            questions: [],
            exams: []
        };

        const questions = Array.isArray(data.questions)
            ? data.questions
            : [];

        const exams = Array.isArray(data.exams)
            ? data.exams
            : [];

        let totalCorrect = 0;
        let totalWrong = 0;

        questions.forEach((q) => {
            totalCorrect += Number(q.correct || 0);
            totalWrong += Number(q.wrong || 0);
        });

        const totalQuestions = totalCorrect + totalWrong;

        const successRate =
            totalQuestions > 0
                ? Math.round((totalCorrect / totalQuestions) * 100)
                : 0;

        const lastExam =
            exams.length > 0
                ? exams[exams.length - 1]
                : null;

        return res.status(200).json({
            streak: 0,
            totalQuestions,
            lastExamScore: lastExam?.score ?? '-',
            successRate,
            aiSuggestion:
                'Matematik konularına odaklanmanı öneriyorum.',
            motivation:
                'Her gün küçük ama düzenli bir adım at.'
        });

    } catch (err) {
        console.error('Dashboard error:', err);
        return res.status(500).json({
            error: 'Failed to load dashboard'
        });
    }
}


// ==============================
// ANA ROUTER
// ==============================
export default async function handler(req, res) {
    let endpoint = req.query.endpoint;

    if (Array.isArray(endpoint)) {
        endpoint = endpoint.join('/');
    }

    if (endpoint === 'profile') {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return profile(req, res);
    }

    if (endpoint === 'profile/update') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return updateProfile(req, res);
    }

    if (endpoint === 'curriculum') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return curriculum(req, res);
    }

    if (endpoint === 'change-password') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return changePassword(req, res);
    }

    if (endpoint === 'activate-pro') {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return activatePro(req, res);
    }

    if (endpoint === 'delete-account') {
        if (req.method !== 'POST' && req.method !== 'DELETE') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return deleteAccount(req, res);
    }

    if (endpoint === 'dashboard') {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        return dashboard(req, res);
    }

    return res.status(404).json({
        error: 'Endpoint not found'
    });
}
