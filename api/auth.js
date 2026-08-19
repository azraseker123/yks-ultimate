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
// REGISTER
// ==============================
async function register(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, password, goal } = req.body;

    if (!name || !email || !password || !goal) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters'
        });
    }

    try {

        // Kullanıcı daha önce kayıt olmuş mu?
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                error: 'User already exists'
            });
        }


        // Şifreyi hashle
        const hashedPassword = await bcrypt.hash(
            password,
            BCRYPT_ROUNDS
        );


        // Kullanıcı oluştur
        const result = await pool.query(
            `INSERT INTO users
            (name, email, password, goal, "isPro", "createdAt")
            VALUES ($1, $2, $3, $4, false, NOW())
            RETURNING id, name, email, goal, "isPro"`,
            [name, email, hashedPassword, goal]
        );

        const user = result.rows[0];


        // Kullanıcının başlangıç verilerini oluştur
        await pool.query(
            `INSERT INTO userdata
            ("userId", curriculum, exams, questions, sleep, schedule, badges)
            VALUES ($1, '{}', '[]', '[]', '[]', '[]', '{}')`,
            [user.id]
        );


        // Token oluştur
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email
            },
            JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );


        return res.status(201).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                goal: user.goal,
                isPro: user.isPro
            }
        });

    } catch (err) {

        console.error('Register error:', err);

        return res.status(500).json({
            error: 'Registration failed'
        });
    }
}


// ==============================
// LOGIN
// ==============================
async function login(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }


    const { email, password } = req.body;


    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password required'
        });
    }


    try {

        const result = await pool.query(
            `SELECT id, name, email, password, goal, "isPro"
             FROM users
             WHERE email = $1`,
            [email]
        );


        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }


        const user = result.rows[0];


        const isValid = await bcrypt.compare(
            password,
            user.password
        );


        if (!isValid) {
            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }


        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email
            },
            JWT_SECRET,
            {
                expiresIn: '7d'
            }
        );


        return res.status(200).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                goal: user.goal,
                isPro: user.isPro
            }
        });


    } catch (err) {

        console.error('Login error:', err);

        return res.status(500).json({
            error: 'Login failed'
        });
    }
}


// ==============================
// VERCEL SERVERLESS HANDLER
// ==============================
export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({
            error: 'Method not allowed'
        });
    }


    const { action } = req.body || {};


    if (action === 'register') {
        return register(req, res);
    }


    if (action === 'login') {
        return login(req, res);
    }


    return res.status(400).json({
        error: 'Invalid action'
    });
}
