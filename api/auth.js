import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { sql } from '@vercel/postgres';

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;

// REGISTER FONKSİYONU
async function register(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, email, password, goal } = req.body;

    if (!name || !email || !password || !goal) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const result = await sql`
            INSERT INTO users (name, email, password, goal, isPro, createdAt)
            VALUES (${name}, ${email}, ${hashedPassword}, ${goal}, false, NOW())
            RETURNING id, name, email, goal, isPro
        `;

        const user = result.rows[0];

        await sql`
            INSERT INTO userdata (userId, curriculum, exams, questions, sleep, schedule, badges)
            VALUES (${user.id}, '{}', '[]', '[]', '[]', '[]', '{}')
        `;

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, goal: user.goal, isPro: user.isPro } });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Registration failed' });
    }
}

// LOGIN FONKSİYONU
async function login(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const result = await sql`SELECT id, name, email, password, goal, isPro FROM users WHERE email = ${email}`;

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

        return res.status(200).json({ token, user: { id: user.id, name: user.name, email: user.email, goal: user.goal, isPro: user.isPro } });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Login failed' });
    }
}

// ⭐ DEFAULT HANDLER - BU ÖNEMLİ!
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action } = req.body;

    if (action === 'register') {
        return register(req, res);
    }
    
    if (action === 'login') {
        return login(req, res);
    }

    return res.status(400).json({ error: 'Invalid action' });
}
