// Vercel Functions - api/user/[endpoint].js
// Place this file in: vercel project/api/user/[endpoint].js

import { sql } from '@vercel/postgres';
import bcrypt from 'bcrypt';
import { withAuth, verifyToken } from './auth';

const BCRYPT_ROUNDS = 10;

// ===== GET USER PROFILE =====
export async function profile(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        const userResult = await sql`
            SELECT id, name, email, goal, isPro FROM users WHERE id = ${decoded.userId}
        `;

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = userResult.rows[0];

        const dataResult = await sql`
            SELECT curriculum, exams, questions, sleep, schedule, badges FROM userdata WHERE userId = ${user.id}
        `;

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
                curriculum: typeof userData.curriculum === 'string' ? JSON.parse(userData.curriculum) : userData.curriculum,
                exams: typeof userData.exams === 'string' ? JSON.parse(userData.exams) : userData.exams,
                questions: typeof userData.questions === 'string' ? JSON.parse(userData.questions) : userData.questions,
                sleep: typeof userData.sleep === 'string' ? JSON.parse(userData.sleep) : userData.sleep,
                schedule: typeof userData.schedule === 'string' ? JSON.parse(userData.schedule) : userData.schedule,
                badges: typeof userData.badges === 'string' ? JSON.parse(userData.badges) : userData.badges
            }
        });
    } catch (err) {
        console.error('Profile error:', err);
        return res.status(500).json({ error: 'Failed to load profile' });
    }
}

// ===== UPDATE PROFILE =====
export async function updateProfile(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { name, goal } = req.body;

    if (!name || !goal) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await sql`
            UPDATE users SET name = ${name}, goal = ${goal} WHERE id = ${decoded.userId}
            RETURNING id, name, email, goal, isPro
        `;

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        return res.status(200).json({
            message: 'Profile updated',
            user
        });
    } catch (err) {
        console.error('Update error:', err);
        return res.status(500).json({ error: 'Failed to update profile' });
    }
}

// ===== CURRICULUM UPDATE =====
export async function curriculum(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { key, checked } = req.body;

    if (!key) {
        return res.status(400).json({ error: 'Missing key' });
    }

    try {
        // Get current curriculum
        const result = await sql`
            SELECT curriculum FROM userdata WHERE userId = ${decoded.userId}
        `;

        let curriculum = {};
        if (result.rows.length > 0) {
            curriculum = typeof result.rows[0].curriculum === 'string' 
                ? JSON.parse(result.rows[0].curriculum) 
                : result.rows[0].curriculum;
        }

        // Update
        curriculum[key] = checked;

        // Save
        await sql`
            UPDATE userdata SET curriculum = ${JSON.stringify(curriculum)} WHERE userId = ${decoded.userId}
        `;

        return res.status(200).json({ message: 'Curriculum updated' });
    } catch (err) {
        console.error('Curriculum error:', err);
        return res.status(500).json({ error: 'Failed to update curriculum' });
    }
}

// ===== CHANGE PASSWORD =====
export async function changePassword(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    try {
        const result = await sql`
            SELECT password FROM users WHERE id = ${decoded.userId}
        `;

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isValid = await bcrypt.compare(currentPassword, result.rows[0].password);
        if (!isValid) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

        await sql`
            UPDATE users SET password = ${hashedPassword} WHERE id = ${decoded.userId}
        `;

        return res.status(200).json({ message: 'Password changed successfully' });
    } catch (err) {
        console.error('Password change error:', err);
        return res.status(500).json({ error: 'Failed to change password' });
    }
}

// ===== ACTIVATE PRO LICENSE =====
export async function activatePro(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'License code required' });
    }

    try {
        // Check if license exists and hasn't been used
        const licenseResult = await sql`
            SELECT id, used, userId FROM licenses WHERE code = ${code}
        `;

        if (licenseResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invalid license code' });
        }

        const license = licenseResult.rows[0];

        if (license.used) {
            return res.status(409).json({ error: 'This license code has already been used' });
        }

        // Mark license as used
        await sql`
            UPDATE licenses SET used = true, userId = ${decoded.userId}, usedAt = NOW() WHERE id = ${license.id}
        `;

        // Update user isPro
        await sql`
            UPDATE users SET isPro = true WHERE id = ${decoded.userId}
        `;

        return res.status(200).json({
            message: 'Pro activation successful',
            isPro: true
        });
    } catch (err) {
        console.error('Pro activation error:', err);
        return res.status(500).json({ error: 'Failed to activate Pro' });
    }
}

// ===== DELETE ACCOUNT =====
export async function deleteAccount(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        // Delete all user data
        await sql`DELETE FROM userdata WHERE userId = ${decoded.userId}`;
        await sql`DELETE FROM exams WHERE userId = ${decoded.userId}`;
        await sql`DELETE FROM questions WHERE userId = ${decoded.userId}`;
        await sql`DELETE FROM sleep WHERE userId = ${decoded.userId}`;
        await sql`DELETE FROM schedule WHERE userId = ${decoded.userId}`;
        await sql`DELETE FROM badges WHERE userId = ${decoded.userId}`;
        await sql`DELETE FROM users WHERE id = ${decoded.userId}`;

        return res.status(200).json({ message: 'Account deleted' });
    } catch (err) {
        console.error('Delete account error:', err);
        return res.status(500).json({ error: 'Failed to delete account' });
    }
}

// ===== DASHBOARD =====
export async function dashboard(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }

    try {
        // Get exams
        const examsResult = await sql`
            SELECT score FROM exams WHERE userId = ${decoded.userId} ORDER BY date DESC LIMIT 1
        `;

        // Get questions
        const questionsResult = await sql`
            SELECT correct, wrong FROM questions WHERE userId = ${decoded.userId}
        `;

        let totalCorrect = 0, totalWrong = 0;
        questionsResult.rows.forEach(q => {
            totalCorrect += q.correct || 0;
            totalWrong += q.wrong || 0;
        });

        const totalQuestions = totalCorrect + totalWrong;
        const successRate = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

        return res.status(200).json({
            streak: 0, // Calculate from consecutive days
            totalQuestions,
            lastExamScore: examsResult.rows.length > 0 ? examsResult.rows[0].score : '-',
            successRate,
            aiSuggestion: 'Matematik konularına odaklanmanı öneriyorum. Son sorularına bakıldığında bu alanda daha çok pratik yapabilirsin.',
            motivation: 'Başarı, bir anlık ilhamdan değil günlük çalışmadan geliştir. Her gün bir adım daha yaklaş hedefine! 💪'
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        return res.status(500).json({ error: 'Failed to load dashboard' });
    }
}
