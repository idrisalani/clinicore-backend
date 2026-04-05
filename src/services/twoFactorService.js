// ============================================
// twoFactorService.js — TOTP-based 2FA
// File: backend/src/services/twoFactorService.js
//
// Install: npm install speakeasy qrcode crypto
//
// Flow:
//   1. POST /auth/2fa/setup     → generate secret + QR code
//   2. POST /auth/2fa/verify    → verify TOTP token, enable 2FA
//   3. POST /auth/2fa/validate  → validate token on login
//   4. POST /auth/2fa/disable   → disable 2FA (requires password)
//   5. POST /auth/2fa/backup    → use a backup code
// ============================================

import speakeasy from 'speakeasy';
import QRCode    from 'qrcode';
import crypto    from 'crypto';
import bcrypt    from 'bcryptjs';

const CLINIC_NAME     = process.env.CLINIC_NAME || 'CliniCore';
const ENCRYPTION_KEY  = process.env.TWO_FA_ENCRYPTION_KEY || 'clinicore-2fa-key-change-in-prod-32c';

// ── Encrypt/decrypt secret at rest ────────────────────────────────────────────
const ALGO = 'aes-256-cbc';
const KEY  = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);

const encrypt = (text) => {
  const iv   = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

const decrypt = (text) => {
  const [ivHex, encHex] = text.split(':');
  const iv       = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]);
  return decrypted.toString();
};

// ── Generate backup codes ─────────────────────────────────────────────────────
const generateBackupCodes = async () => {
  const plain  = Array.from({ length: 8 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
  const hashed = await Promise.all(plain.map(c => bcrypt.hash(c, 10)));
  return { plain, hashed };
};

// ── Setup: generate secret + QR code ─────────────────────────────────────────
export const setup2FA = async (db, user) => {
  // Generate TOTP secret
  const secret = speakeasy.generateSecret({
    name:   `${CLINIC_NAME} (${user.email})`,
    issuer: CLINIC_NAME,
    length: 20,
  });

  // Generate backup codes
  const { plain: backupCodes, hashed: hashedCodes } = await generateBackupCodes();

  // Encrypt secret and store (not enabled yet — user must verify first)
  const encryptedSecret = encrypt(secret.base32);
  await db.run(
    `INSERT INTO user_2fa (user_id, secret, backup_codes)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       secret = excluded.secret,
       backup_codes = excluded.backup_codes,
       is_enabled = 0`,
    [user.user_id, encryptedSecret, JSON.stringify(hashedCodes)]
  );

  // Generate QR code data URL for authenticator app scanning
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret:       secret.base32,   // show once for manual entry
    qrCode:       qrCodeUrl,       // base64 PNG for display
    backupCodes,                   // show once — user must save these
  };
};

// ── Verify token and enable 2FA ───────────────────────────────────────────────
export const verify2FA = async (db, userId, token) => {
  const row = await db.get(
    'SELECT secret FROM user_2fa WHERE user_id = ?',
    [userId]
  );
  if (!row) throw new Error('2FA setup not found — call /2fa/setup first');

  const secret = decrypt(row.secret);
  const valid  = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token:    token.replace(/\s/g, ''),
    window:   1,   // allow 1 step drift (30s)
  });

  if (!valid) return { success: false, message: 'Invalid code — check your authenticator app' };

  // Enable 2FA
  await db.run(
    `UPDATE user_2fa SET is_enabled = 1, enrolled_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [userId]
  );
  await db.run(
    `UPDATE users SET two_fa_enabled = 1, two_fa_enforced_at = CURRENT_TIMESTAMP WHERE user_id = ?`,
    [userId]
  );

  return { success: true };
};

// ── Validate token on login ───────────────────────────────────────────────────
export const validate2FA = async (db, userId, token) => {
  const row = await db.get(
    'SELECT secret, is_enabled FROM user_2fa WHERE user_id = ? AND is_enabled = 1',
    [userId]
  );
  if (!row) return { success: false, message: '2FA not enabled for this account' };

  const secret = decrypt(row.secret);
  const valid  = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token:    token.replace(/\s/g, ''),
    window:   1,
  });

  if (!valid) return { success: false, message: 'Invalid 2FA code' };

  await db.run(
    'UPDATE user_2fa SET last_used_at = CURRENT_TIMESTAMP WHERE user_id = ?',
    [userId]
  );

  return { success: true };
};

// ── Use a backup code (one-time) ──────────────────────────────────────────────
export const useBackupCode = async (db, userId, code) => {
  const row = await db.get(
    'SELECT backup_codes FROM user_2fa WHERE user_id = ?',
    [userId]
  );
  if (!row?.backup_codes) return { success: false, message: 'No backup codes found' };

  const codes = JSON.parse(row.backup_codes);
  let matchIndex = -1;

  for (let i = 0; i < codes.length; i++) {
    if (await bcrypt.compare(code.replace(/\s/g, '').toUpperCase(), codes[i])) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) return { success: false, message: 'Invalid backup code' };

  // Remove used code
  codes.splice(matchIndex, 1);
  await db.run(
    'UPDATE user_2fa SET backup_codes = ? WHERE user_id = ?',
    [JSON.stringify(codes), userId]
  );

  return { success: true, codesRemaining: codes.length };
};

// ── Disable 2FA ───────────────────────────────────────────────────────────────
export const disable2FA = async (db, userId, password) => {
  const user = await db.get(
    'SELECT password_hash FROM users WHERE user_id = ?',
    [userId]
  );
  if (!user) throw new Error('User not found');

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) return { success: false, message: 'Incorrect password' };

  await db.run('DELETE FROM user_2fa WHERE user_id = ?', [userId]);
  await db.run(
    'UPDATE users SET two_fa_enabled = 0, two_fa_enforced_at = NULL WHERE user_id = ?',
    [userId]
  );

  return { success: true };
};

// ── Get 2FA status ────────────────────────────────────────────────────────────
export const get2FAStatus = async (db, userId) => {
  const row = await db.get(
    'SELECT is_enabled, enrolled_at, last_used_at, backup_codes FROM user_2fa WHERE user_id = ?',
    [userId]
  );
  if (!row) return { enabled: false, enrolled: false };

  const codes = row.backup_codes ? JSON.parse(row.backup_codes) : [];
  return {
    enabled:          !!row.is_enabled,
    enrolled:         true,
    enrolledAt:       row.enrolled_at,
    lastUsedAt:       row.last_used_at,
    backupCodesLeft:  codes.length,
  };
};