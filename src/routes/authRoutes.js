import express from 'express';
import { register, login, logout, refreshToken } from '../controllers/authController.js';

const router = express.Router();

// Register new user
router.post('/register', register);

// Login
router.post('/login', login);

// Logout
router.post('/logout', logout);

// Refresh token
router.post('/refresh-token', refreshToken);

export default router;