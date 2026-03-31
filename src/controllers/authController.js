import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Joi from 'joi';
import { query } from '../config/database.js';
import { generateAccessToken, generateRefreshToken } from '../utils/security.js';

export const register = async (req, res) => {
  try {
    const { email, password, username, full_name, phone, role } = req.body;

    console.log('📝 Register attempt:', email);

    // Validate input
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      username: Joi.string().min(3).required(),
      full_name: Joi.string().optional(),
      phone: Joi.string().optional(),
      role: Joi.string().default('patient'),
    });

    const { error } = schema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    // Check if user exists
    const existing = await query('SELECT user_id FROM users WHERE email = ? OR username = ?', [
      email,
      username,
    ]);

    if (existing.rows && existing.rows.length > 0) {
      console.log('❌ User already exists');
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create user
    const result = await query(
      'INSERT INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, hashedPassword, full_name || null, phone || null, role, 1]
    );

    console.log('✅ User registered:', username);

    res.status(201).json({
      message: 'User registered successfully',
      user_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const login = async (req, res) => {
  try {
    // Accept BOTH username and email
    const { username, email, password } = req.body;

    console.log('🔐 Login attempt:', username || email);

    if (!password) {
      console.log('❌ Missing password');
      return res.status(400).json({ error: 'Password required' });
    }

    if (!username && !email) {
      console.log('❌ Missing username or email');
      return res.status(400).json({ error: 'Username or email required' });
    }

    // Find user by username OR email
    let result;
    if (username) {
      result = await query(
        'SELECT user_id, username, email, password_hash, role, is_active FROM users WHERE username = ?',
        [username]
      );
    } else {
      result = await query(
        'SELECT user_id, username, email, password_hash, role, is_active FROM users WHERE email = ?',
        [email]
      );
    }

    if (!result.rows || result.rows.length === 0) {
      console.log('❌ User not found:', username || email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      console.log('❌ User inactive:', user.username);
      return res.status(401).json({ error: 'User account is inactive' });
    }

    // Verify password
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);
    if (!passwordMatch) {
      console.log('❌ Invalid password for:', user.username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const accessToken = generateAccessToken({ user_id: user.user_id });
    const refreshToken = generateRefreshToken({ user_id: user.user_id });

    // Store refresh token in database
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, datetime(\'now\', \'+7 days\'))',
      [user.user_id, refreshToken]
    );

    // Update last login
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = ?', [user.user_id]);

    console.log('✅ Login successful:', user.username);

    res.json({
      accessToken,
      refreshToken,
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

export const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await query('UPDATE refresh_tokens SET is_revoked = 1 WHERE token = ?', [refreshToken]);
      console.log('✅ Logout successful');
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      console.log('❌ No refresh token provided');
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token is in database
    const tokenResult = await query('SELECT user_id FROM refresh_tokens WHERE token = ? AND is_revoked = 0', [
      refreshToken,
    ]);

    if (!tokenResult.rows || tokenResult.rows.length === 0) {
      console.log('❌ Invalid refresh token');
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userId = tokenResult.rows[0].user_id;

    // Get user
    const userResult = await query('SELECT user_id, username, email, role FROM users WHERE user_id = ?', [userId]);

    if (!userResult.rows || userResult.rows.length === 0) {
      console.log('❌ User not found for refresh');
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Generate new tokens
    const newAccessToken = generateAccessToken({ user_id: user.user_id });
    const newRefreshToken = generateRefreshToken({ user_id: user.user_id });

    // Update refresh token in database
    await query(
      'UPDATE refresh_tokens SET token = ?, expires_at = datetime(\'now\', \'+7 days\') WHERE token = ?',
      [newRefreshToken, refreshToken]
    );

    console.log('✅ Token refreshed for user:', user.username);

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
};