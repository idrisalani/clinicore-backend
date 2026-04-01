// ============================================
// Admin Controller - API Handlers
// File: backend/src/controllers/adminController.js
// ============================================

import { AdminService } from '../services/adminService.js';

const adminService = new AdminService();

export const adminController = {
  // ==========================================
  // DASHBOARD
  // ==========================================

  async getDashboard(req, res) {
    try {
      const stats = await adminService.getDashboardStats();
      res.json({
        status: 'success',
        data: stats
      });
    } catch (err) {
      res.status(500).json({
        error: err.message,
        status: 'error'
      });
    }
  },

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getAllUsers(req, res) {
    try {
      const {limit = 50, offset = 0} = req.query;
      const users = await adminService.getAllUsers(parseInt(limit), parseInt(offset));
      res.json({
        status: 'success',
        data: users,
        count: users.length
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async getUserById(req, res) {
    try {
      const {id} = req.params;
      const user = await adminService.getUserById(id);
      
      if (!user) {
        return res.status(404).json({error: 'User not found'});
      }

      res.json({
        status: 'success',
        data: user
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async createUser(req, res) {
    try {
      const {username, email, password, full_name, phone, role} = req.body;

      // Validate required fields
      if (!username || !email || !password || !full_name) {
        return res.status(400).json({
          error: 'Missing required fields: username, email, password, full_name'
        });
      }

      const result = await adminService.createUser({
        username,
        email,
        password,
        full_name,
        phone: phone || null,
        role: role || 'staff'
      });

      res.status(201).json({
        status: 'success',
        message: 'User created successfully',
        data: {user_id: result.user_id}
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  async updateUser(req, res) {
    try {
      const {id} = req.params;
      const updates = req.body;

      await adminService.updateUser(id, updates);

      res.json({
        status: 'success',
        message: 'User updated successfully'
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  async deleteUser(req, res) {
    try {
      const {id} = req.params;
      const result = await adminService.deleteUser(id);

      res.json({
        status: 'success',
        message: 'User deleted successfully',
        data: result
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  async changeUserRole(req, res) {
    try {
      const {id} = req.params;
      const {role} = req.body;

      if (!role) {
        return res.status(400).json({error: 'Role is required'});
      }

      await adminService.changeUserRole(id, role);

      res.json({
        status: 'success',
        message: 'User role changed successfully'
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  async toggleUserStatus(req, res) {
    try {
      const {id} = req.params;
      const result = await adminService.toggleUserStatus(id);

      res.json({
        status: 'success',
        message: 'User status toggled',
        data: result
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  // ==========================================
  // ROLE MANAGEMENT
  // ==========================================

  async getAllRoles(req, res) {
    try {
      const roles = await adminService.getAllRoles();
      res.json({
        status: 'success',
        data: roles,
        count: roles.length
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async getRoleById(req, res) {
    try {
      const {id} = req.params;
      const role = await adminService.getRoleById(id);

      if (!role) {
        return res.status(404).json({error: 'Role not found'});
      }

      res.json({
        status: 'success',
        data: role
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async createRole(req, res) {
    try {
      const {role_name, description, level} = req.body;

      if (!role_name || !level) {
        return res.status(400).json({
          error: 'Missing required fields: role_name, level'
        });
      }

      const result = await adminService.createRole({
        role_name,
        description: description || '',
        level
      });

      res.status(201).json({
        status: 'success',
        message: 'Role created successfully',
        data: {role_id: result.role_id}
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  async updateRole(req, res) {
    try {
      const {id} = req.params;
      const {description, level} = req.body;

      await adminService.updateRole(id, {description, level});

      res.json({
        status: 'success',
        message: 'Role updated successfully'
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  async deleteRole(req, res) {
    try {
      const {id} = req.params;
      const result = await adminService.deleteRole(id);

      res.json({
        status: 'success',
        message: 'Role deleted successfully',
        data: result
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  async getUsersWithRole(req, res) {
    try {
      const {id} = req.params;
      const users = await adminService.getUsersWithRole(id);

      res.json({
        status: 'success',
        data: users,
        count: users.length
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  // ==========================================
  // PERMISSION MANAGEMENT
  // ==========================================

  async getAllPermissions(req, res) {
    try {
      const permissions = await adminService.getAllPermissions();
      res.json({
        status: 'success',
        data: permissions,
        count: permissions.length
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async getRolePermissions(req, res) {
    try {
      const {roleId} = req.params;
      const permissions = await adminService.getRolePermissions(roleId);

      res.json({
        status: 'success',
        data: permissions,
        count: permissions.length
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async assignPermissionsToRole(req, res) {
    try {
      const {roleId} = req.params;
      const {permission_ids} = req.body;

      if (!Array.isArray(permission_ids)) {
        return res.status(400).json({
          error: 'permission_ids must be an array'
        });
      }

      const result = await adminService.assignPermissionsToRole(roleId, permission_ids);

      res.json({
        status: 'success',
        message: 'Permissions assigned successfully',
        data: result
      });
    } catch (err) {
      res.status(400).json({error: err.message});
    }
  },

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================

  async getActivityLogs(req, res) {
    try {
      const {limit = 100, offset = 0} = req.query;
      const logs = await adminService.getActivityLogs(parseInt(limit), parseInt(offset));

      res.json({
        status: 'success',
        data: logs,
        count: logs.length
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async getActivityLogById(req, res) {
    try {
      const {logId} = req.params;
      const log = await adminService.getActivityLogById(logId);

      if (!log) {
        return res.status(404).json({error: 'Log not found'});
      }

      res.json({
        status: 'success',
        data: log
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async getUserActivityLogs(req, res) {
    try {
      const {userId} = req.params;
      const {limit = 50} = req.query;
      const logs = await adminService.getActivityLogsByUser(userId, parseInt(limit));

      res.json({
        status: 'success',
        data: logs,
        count: logs.length
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async clearOldActivityLogs(req, res) {
    try {
      const {daysOld = 90} = req.body;
      const result = await adminService.clearOldActivityLogs(daysOld);

      res.json({
        status: 'success',
        message: `Cleared activity logs older than ${daysOld} days`,
        data: result
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================

  async getAllSettings(req, res) {
    try {
      const settings = await adminService.getAllSettings();
      res.json({
        status: 'success',
        data: settings
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async getSetting(req, res) {
    try {
      const {key} = req.params;
      const value = await adminService.getSetting(key);

      res.json({
        status: 'success',
        data: {key, value}
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async updateSetting(req, res) {
    try {
      const {key} = req.params;
      const {value, type = 'string'} = req.body;

      if (!value) {
        return res.status(400).json({error: 'Value is required'});
      }

      await adminService.updateSetting(key, value, type);

      res.json({
        status: 'success',
        message: 'Setting updated successfully',
        data: {key, value}
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  },

  async deleteSetting(req, res) {
    try {
      const {key} = req.params;
      const result = await adminService.deleteSetting(key);

      res.json({
        status: 'success',
        message: 'Setting deleted successfully',
        data: result
      });
    } catch (err) {
      res.status(500).json({error: err.message});
    }
  }
};

export default adminController;