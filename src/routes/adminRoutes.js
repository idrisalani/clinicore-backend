// ============================================
// Admin Routes - API Endpoints
// File: backend/src/routes/adminRoutes.js
// ============================================

import express from 'express';
import { adminController } from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { checkPermission, logActivity, isAdmin } from '../middleware/rbac.js';

const router = express.Router();

// ==========================================
// MIDDLEWARE: All admin routes require authentication
// ==========================================

router.use(authenticate);
router.use(isAdmin);

// ==========================================
// DASHBOARD
// ==========================================

router.get(
  '/dashboard',
  checkPermission('view_dashboard'),
  logActivity('VIEW', 'Dashboard'),
  adminController.getDashboard
);

// ==========================================
// USER MANAGEMENT ENDPOINTS
// ==========================================

// Get all users
router.get(
  '/users',
  checkPermission('view_users'),
  logActivity('LIST', 'Users'),
  adminController.getAllUsers
);

// Create new user
router.post(
  '/users',
  checkPermission('create_user'),
  logActivity('CREATE', 'User'),
  adminController.createUser
);

// Get specific user
router.get(
  '/users/:id',
  checkPermission('view_users'),
  adminController.getUserById
);

// Update user
router.put(
  '/users/:id',
  checkPermission('edit_user'),
  logActivity('UPDATE', 'User'),
  adminController.updateUser
);

// Delete user
router.delete(
  '/users/:id',
  checkPermission('delete_user'),
  logActivity('DELETE', 'User'),
  adminController.deleteUser
);

// Change user role
router.put(
  '/users/:id/role',
  checkPermission('manage_user_roles'),
  logActivity('UPDATE', 'UserRole'),
  adminController.changeUserRole
);

// Toggle user status (active/inactive)
router.put(
  '/users/:id/toggle',
  checkPermission('edit_user'),
  logActivity('UPDATE', 'UserStatus'),
  adminController.toggleUserStatus
);

// ==========================================
// ROLE MANAGEMENT ENDPOINTS
// ==========================================

// Get all roles
router.get(
  '/roles',
  checkPermission('view_roles'),
  adminController.getAllRoles
);

// Create role
router.post(
  '/roles',
  checkPermission('create_role'),
  logActivity('CREATE', 'Role'),
  adminController.createRole
);

// Get specific role
router.get(
  '/roles/:id',
  checkPermission('view_roles'),
  adminController.getRoleById
);

// Update role
router.put(
  '/roles/:id',
  checkPermission('edit_role'),
  logActivity('UPDATE', 'Role'),
  adminController.updateRole
);

// Delete role
router.delete(
  '/roles/:id',
  checkPermission('delete_role'),
  logActivity('DELETE', 'Role'),
  adminController.deleteRole
);

// Get users with specific role
router.get(
  '/roles/:id/users',
  checkPermission('view_roles'),
  adminController.getUsersWithRole
);

// ==========================================
// PERMISSION MANAGEMENT ENDPOINTS
// ==========================================

// Get all permissions
router.get(
  '/permissions',
  checkPermission('view_permissions'),
  adminController.getAllPermissions
);

// Get permissions for a role
router.get(
  '/roles/:roleId/permissions',
  checkPermission('view_permissions'),
  adminController.getRolePermissions
);

// Assign permissions to role
router.put(
  '/roles/:roleId/permissions',
  checkPermission('manage_permissions'),
  logActivity('UPDATE', 'RolePermissions'),
  adminController.assignPermissionsToRole
);

// ==========================================
// ACTIVITY LOGS ENDPOINTS
// ==========================================

// Get all activity logs
router.get(
  '/activity-logs',
  checkPermission('view_activity_logs'),
  adminController.getActivityLogs
);

// Get specific activity log
router.get(
  '/activity-logs/:logId',
  checkPermission('view_activity_logs'),
  adminController.getActivityLogById
);

// Get user's activity logs
router.get(
  '/users/:userId/activity-logs',
  checkPermission('view_activity_logs'),
  adminController.getUserActivityLogs
);

// Clear old activity logs
router.delete(
  '/activity-logs/clear-old',
  checkPermission('manage_settings'),
  logActivity('DELETE', 'ActivityLogs'),
  adminController.clearOldActivityLogs
);

// ==========================================
// SYSTEM SETTINGS ENDPOINTS
// ==========================================

// Get all settings
router.get(
  '/settings',
  checkPermission('view_settings'),
  adminController.getAllSettings
);

// Get specific setting
router.get(
  '/settings/:key',
  checkPermission('view_settings'),
  adminController.getSetting
);

// Update setting
router.put(
  '/settings/:key',
  checkPermission('manage_settings'),
  logActivity('UPDATE', 'Setting'),
  adminController.updateSetting
);

// Delete setting
router.delete(
  '/settings/:key',
  checkPermission('manage_settings'),
  logActivity('DELETE', 'Setting'),
  adminController.deleteSetting
);

// ==========================================
// ERROR HANDLING
// ==========================================

router.use((err, req, res, next) => {
  console.error('Admin route error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

export default router;