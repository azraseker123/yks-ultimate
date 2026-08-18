// Vercel Functions - api/auth/[endpoint].js
// Place this file in: vercel project/api/auth/[endpoint].js

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { sql } from '@vercel/postgres';

const JWT_SECRET = process.env.JWT_SECRET;
const BCRYPT_ROUNDS = 10;

// ===== REGISTER =====
export async function register(req, res) {
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
        // Check if user exists
        const existing = await sql`
            SELECT id FROM users WHERE email = ${email}
        `;

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create user
        const result = await sql`
            INSERT INTO users (name, email, password, goal, isPro, createdAt)
            VALUES (${name}, ${email}, ${hashedPassword}, ${goal}, false, NOW())
            RETURNING id, name, email, goal, isPro
        `;

        const user = result.rows[0];

        // Create user data record
        await sql`
            INSERT INTO userdata (userId, curriculum, exams, questions, sleep, schedule, badges)
            VALUES (${user.id}, '{}', '[]', '[]', '[]', '[]', '{}')
        `;

        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

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
        return res.status(500).json({ error: 'Registration failed' });
    }
}

// ===== LOGIN =====
export async function login(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        // Get user
        const result = await sql`
            SELECT id, name, email, password, goal, isPro FROM users WHERE email = ${email}
        `;

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

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
        return res.status(500).json({ error: 'Login failed' });
    }
}

// ===== LOGOUT =====
export async function logout(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Token validation happens in middleware, logout is just a client-side action
    return res.status(200).json({ message: 'Logged out successfully' });
}

// ===== VERIFY TOKEN =====
export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (err) {
        return null;
    }
}

// ===== MIDDLEWARE =====
export function withAuth(handler) {
    return async (req, res) => {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token' });
        }

        const token = authHeader.substring(7);
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        req.userId = decoded.userId;
        return handler(req, res);
    };
}
