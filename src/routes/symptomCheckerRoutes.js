// ============================================
// symptomCheckerRoutes.js
// File: backend/src/routes/symptomCheckerRoutes.js
// Mount: app.use('/api/v1/symptom-checker', symptomCheckerRoutes)
//
// This route:
//  1. Receives symptoms from the patient portal
//  2. Calls the Anthropic API (claude-sonnet-4-20250514)
//  3. Returns structured triage output
//  4. Logs the session to DB for clinical review
//
// .env needed:
//   ANTHROPIC_API_KEY=sk-ant-...
// ============================================
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = express.Router();
router.use(authenticate);

// ── System prompt (Nigerian clinical context) ─────────────────────────────────
const SYSTEM_PROMPT = `You are a medical triage assistant integrated into CliniCore, a healthcare management system used by clinics and hospitals in Lagos, Nigeria. Your role is to help patients understand their symptoms and determine the urgency of care they need.

IMPORTANT RULES:
- Always recommend the patient see a doctor for a definitive diagnosis
- Never diagnose — you assess urgency and provide information
- Consider common conditions in Nigeria: malaria, typhoid, hypertension, diabetes, sickle cell, GERD
- Be warm, clear, and use accessible language
- Always end with a clear next-step recommendation

You must respond ONLY with valid JSON in this exact structure:
{
  "urgency": "emergency" | "urgent" | "soon" | "routine" | "self_care",
  "urgency_label": "Go to Emergency Now" | "See a Doctor Today" | "See a Doctor This Week" | "Book a Routine Appointment" | "Home Care Recommended",
  "urgency_color": "red" | "orange" | "yellow" | "teal" | "green",
  "summary": "2-3 sentence plain-language summary of what the symptoms suggest",
  "possible_conditions": ["condition1", "condition2", "condition3"],
  "warning_signs": ["sign to watch for", "sign to watch for"],
  "recommended_actions": ["action1", "action2", "action3"],
  "self_care_tips": ["tip1", "tip2"],
  "questions_for_doctor": ["question1", "question2", "question3"],
  "disclaimer": "Standard medical disclaimer"
}`;

// ── POST /symptom-checker/assess ─────────────────────────────────────────────
router.post('/assess', async (req, res) => {
  try {
    const {
      symptoms, duration, severity, age, gender,
      existing_conditions, current_medications,
    } = req.body;

    if (!symptoms || symptoms.trim().length < 5) {
      return res.status(400).json({ error: 'Please describe your symptoms in more detail' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // Build patient context message
    const userMessage = `
Patient Information:
- Age: ${age || 'Not specified'}
- Gender: ${gender || 'Not specified'}
- Existing conditions: ${existing_conditions || 'None mentioned'}
- Current medications: ${current_medications || 'None mentioned'}

Symptoms:
${symptoms}

Duration: ${duration || 'Not specified'}
Severity (1-10): ${severity || 'Not specified'}

Please assess these symptoms and respond with the JSON structure.
    `.trim();

    // Call Anthropic API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':            'application/json',
        'x-api-key':               process.env.ANTHROPIC_API_KEY,
        'anthropic-version':       '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service temporarily unavailable' });
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || '';

    // Parse JSON from response
    let assessment;
    try {
      // Strip any markdown fences if present
      const clean = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      assessment = JSON.parse(clean);
    } catch {
      console.error('Failed to parse AI response:', rawText);
      return res.status(502).json({ error: 'Failed to process AI response' });
    }

    // Log to DB for clinical review (non-blocking)
    query(
      `INSERT INTO symptom_checker_log
        (patient_id, symptoms, duration, severity, age, gender,
         existing_conditions, current_medications,
         urgency, summary, raw_response, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        req.user.user_id, symptoms, duration || null,
        severity || null, age || null, gender || null,
        existing_conditions || null, current_medications || null,
        assessment.urgency, assessment.summary, JSON.stringify(assessment),
      ]
    ).catch(e => console.warn('Symptom log failed (non-critical):', e.message));

    res.json({ assessment });
  } catch (err) {
    console.error('Symptom checker error:', err);
    res.status(500).json({ error: 'Symptom assessment failed' });
  }
});

// ── GET /symptom-checker/history — patient's own history ─────────────────────
router.get('/history', async (req, res) => {
  try {
    const rows = await query(
      `SELECT id, symptoms, urgency, summary, created_at
       FROM symptom_checker_log
       WHERE patient_id = ?
       ORDER BY created_at DESC LIMIT 10`,
      [req.user.user_id]
    );
    res.json({ history: rows.rows || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /symptom-checker/admin — clinic view of recent assessments ─────────────
router.get('/admin', async (req, res) => {
  try {
    const role = (req.user.role || '').toLowerCase();
    if (!['admin', 'doctor', 'nurse'].includes(role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { limit = 50, urgency } = req.query;
    let where = '1=1';
    const params = [];
    if (urgency) { where += ' AND s.urgency = ?'; params.push(urgency); }

    const rows = await query(
      `SELECT s.*, p.first_name, p.last_name, p.phone
       FROM symptom_checker_log s
       LEFT JOIN patients p ON s.patient_id = p.user_id
       WHERE ${where}
       ORDER BY s.created_at DESC LIMIT ?`,
      [...params, limit]
    );
    res.json({ assessments: rows.rows || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;