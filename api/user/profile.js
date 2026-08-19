import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const JWT_SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {

    if (req.method !== 'GET') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'No authorization token'
        });
    }

    const token = authHeader.substring(7);

    let decoded;

    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(401).json({
            error: 'Invalid token'
        });
    }

    try {

        const userResult = await pool.query(
            `SELECT id, name, email, goal, "isPro"
             FROM users
             WHERE id = $1`,
            [decoded.userId]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
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

        return res.status(500).json({
            error: 'Failed to load profile'
        });
    }
}
