// Vercel Functions - api/ai/[endpoint].js
// Place this file in: vercel project/api/ai/[endpoint].js

import { verifyToken } from './auth';
import { sql } from '@vercel/postgres';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

function getAuth(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    return verifyToken(token);
}

async function checkProStatus(userId) {
    try {
        const result = await sql`SELECT isPro FROM users WHERE id = ${userId}`;
        return result.rows[0]?.isPro || false;
    } catch (err) {
        return false;
    }
}

async function callGemini(prompt) {
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048
                }
            })
        });

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
        console.error('Gemini API error:', err);
        throw new Error('AI generation failed');
    }
}

// ===== AI COACH =====
export async function coach(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const isPro = await checkProStatus(decoded.userId);
    if (!isPro) {
        return res.status(403).json({ error: 'Pro membership required' });
    }

    const { message, userGoal } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message required' });
    }

    try {
        const prompt = `Sen bir sınav koçusun. Kullanıcının hedefi: ${userGoal === 'tyt' ? 'TYT sınavı' : userGoal === 'ayt' ? 'AYT sınavı' : 'Hem TYT hem AYT'}. 

Kullanıcı soruyor: "${message}"

Lütfen kısa, motive edici ve pratik bir cevap ver. Maksimum 3-4 cümle. Çalışma stratejisi, konu seçimi veya motivasyon hakkında yardım sağla.`;

        const response = await callGemini(prompt);

        return res.status(200).json({ response });
    } catch (err) {
        console.error('Coach error:', err);
        return res.status(500).json({ error: 'Failed to get AI response' });
    }
}

// ===== FLASHCARD GENERATOR =====
export async function generateFlashcard(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const isPro = await checkProStatus(decoded.userId);
    if (!isPro) {
        return res.status(403).json({ error: 'Pro membership required' });
    }

    const { examType, subject, topic, count } = req.body;
    if (!examType || !subject || !topic || !count) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const prompt = `Lütfen ${examType.toUpperCase()} sınavının ${subject} dersine yönelik "${topic}" konusu hakkında ${count} adet çalışma kartı (flashcard) oluştur.

Her flashcard şu JSON formatında olmalı:
{
  "question": "Soru yazısı",
  "answer": "Cevap yazısı"
}

SADECE geçerli JSON dizisini döndür, başka metin ekleme.
[...]`;

        const response = await callGemini(prompt);
        
        // Parse JSON response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        let cards = [];
        if (jsonMatch) {
            try {
                cards = JSON.parse(jsonMatch[0]);
            } catch (e) {
                // Fallback if JSON parsing fails
                cards = [];
            }
        }

        return res.status(200).json({ cards });
    } catch (err) {
        console.error('Flashcard error:', err);
        return res.status(500).json({ error: 'Failed to generate flashcards' });
    }
}

export async function saveFlashcard(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { cards } = req.body;
    if (!cards || !Array.isArray(cards)) {
        return res.status(400).json({ error: 'Cards array required' });
    }

    try {
        // Save to database - create flashcard_archive table
        for (const card of cards) {
            await sql`
                INSERT INTO flashcard_archive (userId, question, answer, createdAt)
                VALUES (${decoded.userId}, ${card.question}, ${card.answer}, NOW())
            `;
        }

        return res.status(201).json({ message: 'Flashcards saved' });
    } catch (err) {
        console.error('Save flashcard error:', err);
        return res.status(500).json({ error: 'Failed to save flashcards' });
    }
}

// ===== TEST LAB =====
export async function testlab(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const isPro = await checkProStatus(decoded.userId);
    if (!isPro) {
        return res.status(403).json({ error: 'Pro membership required' });
    }

    const { examType, subject, topic, count } = req.body;
    if (!examType || !subject || !topic || !count) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const prompt = `Lütfen ${examType.toUpperCase()} sınavının ${subject} dersine yönelik "${topic}" konusu hakkında ${count} adet çoktan seçmeli soru oluştur.

Her soru şu JSON formatında olmalı:
{
  "text": "Soru metni",
  "options": [
    {"id": "A", "text": "Seçenek A"},
    {"id": "B", "text": "Seçenek B"},
    {"id": "C", "text": "Seçenek C"},
    {"id": "D", "text": "Seçenek D"}
  ],
  "correctAnswer": "A",
  "explanation": "Kısa açıklama"
}

SADECE geçerli JSON dizisini döndür, başka metin ekleme.
[...]`;

        const response = await callGemini(prompt);
        
        // Parse JSON response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        let questions = [];
        if (jsonMatch) {
            try {
                questions = JSON.parse(jsonMatch[0]);
            } catch (e) {
                questions = [];
            }
        }

        return res.status(200).json({ questions });
    } catch (err) {
        console.error('Test lab error:', err);
        return res.status(500).json({ error: 'Failed to generate test questions' });
    }
}

// ===== PHOTO SOLVER =====
export async function photosolver(req, res) {
    const decoded = getAuth(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const isPro = await checkProStatus(decoded.userId);
    if (!isPro) {
        return res.status(403).json({ error: 'Pro membership required' });
    }

    const { photo } = req.body;
    if (!photo) {
        return res.status(400).json({ error: 'Photo data required' });
    }

    try {
        // Extract base64 from data URL
        let base64Data = photo;
        if (photo.startsWith('data:')) {
            base64Data = photo.split(',')[1];
        }

        // Call Gemini with vision capability
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-vision:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: base64Data
                            }
                        },
                        {
                            text: 'Lütfen bu sınavı fotoğrafında görünen soruyu adım adım çöz. Her adımı açık bir şekilde açıkla. Sonunda nihai cevabı vermiş ol.'
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048
                }
            })
        });

        const data = await response.json();
        const solution = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Çözüm alınamadı';

        // Save to archive
        try {
            await sql`
                INSERT INTO question_archive (userId, photo, solution, createdAt)
                VALUES (${decoded.userId}, ${photo}, ${solution}, NOW())
            `;
        } catch (archiveErr) {
            console.error('Archive save error:', archiveErr);
            // Continue even if archive fails
        }

        return res.status(200).json({ solution });
    } catch (err) {
        console.error('Photo solver error:', err);
        return res.status(500).json({ error: 'Failed to solve problem' });
    }
}
