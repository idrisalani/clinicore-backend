// ============================================
// encryption.js
// File: backend/src/utils/encryption.js
//
// AES-256-GCM field-level encryption for PHI.
// Uses Node.js built-in crypto — no extra packages.
//
// Setup: add to .env
//   ENCRYPTION_KEY=<64 hex chars = 32 bytes>
//
// Generate a key:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// ============================================
import crypto from 'crypto';

const ALGORITHM  = 'aes-256-gcm';
const IV_BYTES   = 12;   // 96-bit IV — recommended for GCM
const TAG_BYTES  = 16;   // 128-bit auth tag
const PREFIX     = 'enc:v1:';  // marks encrypted fields in DB

// ── Key loading ───────────────────────────────────────────────────────────────
let _key = null;
const getKey = () => {
  if (_key) return _key;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY environment variable is not set');
  if (raw.length !== 64) throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  _key = Buffer.from(raw, 'hex');
  return _key;
};

// ── Encrypt a single string value ────────────────────────────────────────────
// Returns: "enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
// Returns null/undefined unchanged
export const encrypt = (plaintext) => {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const str = String(plaintext);
  if (str.startsWith(PREFIX)) return str;  // already encrypted — idempotent

  const key = getKey();
  const iv  = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(str, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

// ── Decrypt a single encrypted value ─────────────────────────────────────────
// Returns original plaintext, or the value unchanged if not encrypted
export const decrypt = (ciphertext) => {
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext;
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;  // not encrypted

  const key  = getKey();
  const rest = ciphertext.slice(PREFIX.length);
  const parts = rest.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted field format');

  const [ivHex, tagHex, dataHex] = parts;
  const iv   = Buffer.from(ivHex,  'hex');
  const tag  = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex,'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]).toString('utf8');
};

// ── Check if a value is encrypted ────────────────────────────────────────────
export const isEncrypted = (value) =>
  typeof value === 'string' && value.startsWith(PREFIX);

// ── Encrypt/decrypt an entire object's selected fields ───────────────────────
export const encryptFields = (obj, fields) => {
  if (!obj) return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined) {
      result[field] = encrypt(result[field]);
    }
  }
  return result;
};

export const decryptFields = (obj, fields) => {
  if (!obj) return obj;
  const result = { ...obj };
  for (const field of fields) {
    if (result[field] !== undefined) {
      try { result[field] = decrypt(result[field]); }
      catch { /* leave as-is if decryption fails (e.g. legacy plaintext) */ }
    }
  }
  return result;
};

// Decrypt an array of rows
export const decryptRows = (rows, fields) =>
  rows.map(row => decryptFields(row, fields));

// ── PHI field definitions per table ──────────────────────────────────────────
// These are the fields that contain personally identifiable health information.
// Encrypt on write, decrypt on read. Non-PHI fields (names, dates) left plain
// so they remain searchable and sortable.
export const PHI_FIELDS = {
  patients: [
    'phone',
    'email',
    'address',
    'insurance_policy_number',
    'insurance_group_number',
    'emergency_contact_phone',
    'nin',                       // National Identity Number
    'next_of_kin_phone',
  ],
  users: [
    'phone',
  ],
  consultations: [
    'history_of_present_illness',
    'past_medical_history',
    'physical_examination',
    'medications',
    'allergies',
    'notes',
  ],
  lab_orders: [
    'clinical_notes',
    'sample_notes',
  ],
  lab_results: [
    'notes',
    'result_value',
  ],
};

// ── Searchable hash for encrypted lookups ─────────────────────────────────────
// Problem: encrypted values aren't searchable (WHERE phone = ?)
// Solution: store a deterministic HMAC hash alongside the encrypted value
// Use for: exact-match searches only (phone, email, NIN)
// Never for: partial searches (LIKE) — use name fields for that
const HMAC_KEY = () => {
  const raw = process.env.HMAC_SEARCH_KEY || process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY is not set');
  return Buffer.from(raw, 'hex').slice(0, 32);
};

export const hashForSearch = (value) => {
  if (!value) return null;
  return crypto
    .createHmac('sha256', HMAC_KEY())
    .update(String(value).toLowerCase().trim())
    .digest('hex');
};