import express from 'express';
import { getCurrentUser, getUserPermissions, updateProfile } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get current user profile
router.get('/me', authenticate, getCurrentUser);

// Get user permissions
router.get('/me/permissions', authenticate, getUserPermissions);

// Update user profile
router.put('/me', authenticate, updateProfile);

export default router;