// ============================================
// twoFactorRoutes.js
// File: backend/src/routes/twoFactorRoutes.js
// Mount in server.js: app.use('/api/v1/auth/2fa', twoFactorRoutes)
// ============================================

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  setup2FA, verify2FA, validate2FA,
  disable2FA, useBackupCode, get2FAStatus,
} from '../services/twoFactorService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET  /auth/2fa/status  — check if 2FA is enabled
router.get('/status', async (req, res) => {
  try {
    const status = await get2FAStatus(req.db, req.user.user_id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/2fa/setup  — generate secret + QR code
router.post('/setup', async (req, res) => {
  try {
    const result = await setup2FA(req.db, req.user);
    res.json({
      message:     'Scan the QR code with Google Authenticator or Authy',
      qrCode:      result.qrCode,
      secret:      result.secret,         // for manual entry
      backupCodes: result.backupCodes,    // show once — user must save
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/2fa/verify  — verify first TOTP to confirm setup
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const result = await verify2FA(req.db, req.user.user_id, token);
    if (!result.success) return res.status(400).json({ error: result.message });

    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/2fa/validate  — validate token on login (called after password check)
router.post('/validate', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });

    const result = await validate2FA(req.db, req.user.user_id, token);
    if (!result.success) return res.status(401).json({ error: result.message });

    res.json({ message: 'Authentication successful' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/2fa/backup  — use a backup code instead of TOTP
router.post('/backup', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Backup code is required' });

    const result = await useBackupCode(req.db, req.user.user_id, code);
    if (!result.success) return res.status(400).json({ error: result.message });

    res.json({ message: 'Backup code accepted', codesRemaining: result.codesRemaining });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/2fa/disable  — disable 2FA (requires current password)
router.post('/disable', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const result = await disable2FA(req.db, req.user.user_id, password);
    if (!result.success) return res.status(400).json({ error: result.message });

    res.json({ message: '2FA disabled successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;