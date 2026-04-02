// ============================================
// Admin Service - Business Logic
// File: backend/src/services/adminService.js
// ============================================

import db from '../config/database.js';
import bcrypt from 'bcryptjs';

export class AdminService {
  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getAllUsers(limit = 50, offset = 0) {
    const sql = `
      SELECT 
        user_id, username, email, full_name, phone, 
        role, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    return new Promise((resolve, reject) => {
      db.all(sql, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getUserById(userId) {
    const sql = `
      SELECT 
        user_id, username, email, full_name, phone,
        role, department, is_active, created_at
      FROM users
      WHERE user_id = ?
    `;
    return new Promise((resolve, reject) => {
      db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createUser(userData) {
    const {username, email, password, full_name, phone, role} = userData;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users 
      (username, email, password_hash, full_name, phone, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `;

    return new Promise((resolve, reject) => {
      db.run(sql, [username, email, hashedPassword, full_name, phone, role], function(err) {
        if (err) reject(err);
        else resolve({user_id: this.lastID});
      });
    });
  }

  async updateUser(userId, updates) {
    const allowedFields = ['full_name', 'email', 'phone', 'department'];
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return {success: true, message: 'No changes'};
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`;
    values.push(userId);

    return new Promise((resolve, reject) => {
      db.run(sql, values, function(err) {
        if (err) reject(err);
        else resolve({success: true, changes: this.changes});
      });
    });
  }

  async deleteUser(userId) {
    // Prevent deleting last admin
    const adminCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM users WHERE role = ? OR role = ?',
        ['admin', 'Super Admin'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    if (adminCount <= 1) {
      throw new Error('Cannot delete the last admin user');
    }

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE user_id = ?', [userId], function(err) {
        if (err) reject(err);
        else resolve({success: true, deleted: this.changes});
      });
    });
  }

  async changeUserRole(userId, newRole) {
    const sql = `UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [newRole, userId], function(err) {
        if (err) reject(err);
        else resolve({success: true});
      });
    });
  }

  async toggleUserStatus(userId) {
    const user = await this.getUserById(userId);
    const newStatus = user.is_active ? 0 : 1;

    const sql = `UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`;
    
    return new Promise((resolve, reject) => {
      db.run(sql, [newStatus, userId], function(err) {
        if (err) reject(err);
        else resolve({success: true, is_active: newStatus});
      });
    });
  }

  // ==========================================
  // ROLE MANAGEMENT
  // ==========================================

  async getAllRoles() {
    const sql = `
      SELECT role_id, role_name, description, level, created_at
      FROM roles
      ORDER BY level ASC
    `;
    return new Promise((resolve, reject) => {
      db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getRoleById(roleId) {
    const sql = `SELECT * FROM roles WHERE role_id = ?`;
    return new Promise((resolve, reject) => {
      db.get(sql, [roleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createRole(roleData) {
    const {role_name, description, level} = roleData;
    const sql = `
      INSERT INTO roles (role_name, description, level)
      VALUES (?, ?, ?)
    `;

    return new Promise((resolve, reject) => {
      db.run(sql, [role_name, description, level], function(err) {
        if (err) reject(err);
        else resolve({role_id: this.lastID});
      });
    });
  }

  async updateRole(roleId, updates) {
    const {description, level} = updates;
    const sql = `
      UPDATE roles 
      SET description = ?, level = ?, updated_at = CURRENT_TIMESTAMP
      WHERE role_id = ?
    `;

    return new Promise((resolve, reject) => {
      db.run(sql, [description, level, roleId], function(err) {
        if (err) reject(err);
        else resolve({success: true});
      });
    });
  }

  async deleteRole(roleId) {
    // Prevent deleting role with users
    const userCount = await new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM users WHERE role = (SELECT role_name FROM roles WHERE role_id = ?)',
        [roleId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    if (userCount > 0) {
      throw new Error('Cannot delete role with active users');
    }

    return new Promise((resolve, reject) => {
      db.run('DELETE FROM roles WHERE role_id = ?', [roleId], function(err) {
        if (err) reject(err);
        else resolve({success: true});
      });
    });
  }

  async getUsersWithRole(roleId) {
    const role = await this.getRoleById(roleId);
    const sql = `
      SELECT user_id, username, email, full_name, role, is_active
      FROM users
      WHERE role = ?
      ORDER BY created_at DESC
    `;

    return new Promise((resolve, reject) => {
      db.all(sql, [role.role_name], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // ==========================================
  // PERMISSION MANAGEMENT
  // ==========================================

  async getAllPermissions() {
    const sql = `
      SELECT permission_id, name, description, resource, action
      FROM permissions
      ORDER BY resource, action
    `;
    return new Promise((resolve, reject) => {
      db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getRolePermissions(roleId) {
    const role = await this.getRoleById(roleId);
    const sql = `
      SELECT p.permission_id, p.name, p.description, p.resource, p.action
      FROM permissions p
      JOIN role_permissions rp ON p.permission_id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.resource, p.action
    `;

    return new Promise((resolve, reject) => {
      db.all(sql, [role.role_name], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async assignPermissionsToRole(roleId, permissionIds) {
    const role = await this.getRoleById(roleId);

    return new Promise((resolve, reject) => {
      // Start transaction: delete existing permissions
      db.run(
        'DELETE FROM role_permissions WHERE role = ?',
        [role.role_name],
        (err) => {
          if (err) return reject(err);

          // Insert new permissions
          let completed = 0;
          for (const permId of permissionIds) {
            db.run(
              'INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)',
              [role.role_name, permId],
              (err) => {
                if (err) return reject(err);
                completed++;
                if (completed === permissionIds.length) {
                  resolve({success: true, permissions_assigned: completed});
                }
              }
            );
          }

          // Handle empty array
          if (permissionIds.length === 0) {
            resolve({success: true, permissions_assigned: 0});
          }
        }
      );
    });
  }

  // ==========================================
  // ACTIVITY LOGS
  // ==========================================

  async getActivityLogs(limit = 100, offset = 0) {
    const sql = `
      SELECT 
        al.log_id, al.user_id, al.action, al.resource_type, 
        al.resource_id, al.ip_address, al.created_at,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;

    return new Promise((resolve, reject) => {
      db.all(sql, [limit, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getActivityLogById(logId) {
    const sql = `
      SELECT al.*, u.username, u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE al.log_id = ?
    `;

    return new Promise((resolve, reject) => {
      db.get(sql, [logId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getActivityLogsByUser(userId, limit = 50) {
    const sql = `
      SELECT *
      FROM audit_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      db.all(sql, [userId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async clearOldActivityLogs(daysOld = 90) {
    const sql = `
      DELETE FROM audit_logs
      WHERE created_at < datetime('now', '-' || ? || ' days')
    `;

    return new Promise((resolve, reject) => {
      db.run(sql, [daysOld], function(err) {
        if (err) reject(err);
        else resolve({deleted: this.changes});
      });
    });
  }

  // ==========================================
  // SYSTEM SETTINGS
  // ==========================================

  async getAllSettings() {
    const sql = `SELECT setting_key, setting_value, setting_type FROM system_settings`;
    return new Promise((resolve, reject) => {
      db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getSetting(key) {
    const sql = `SELECT setting_value, setting_type FROM system_settings WHERE setting_key = ?`;
    return new Promise((resolve, reject) => {
      db.get(sql, [key], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.setting_value : null);
      });
    });
  }

  async updateSetting(key, value, type = 'string') {
    const sql = `
      INSERT INTO system_settings (setting_key, setting_value, setting_type)
      VALUES (?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET 
        setting_value = excluded.setting_value,
        updated_at = CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
      db.run(sql, [key, value, type], function(err) {
        if (err) reject(err);
        else resolve({success: true});
      });
    });
  }

  async deleteSetting(key) {
    const sql = `DELETE FROM system_settings WHERE setting_key = ?`;
    return new Promise((resolve, reject) => {
      db.run(sql, [key], function(err) {
        if (err) reject(err);
        else resolve({deleted: this.changes});
      });
    });
  }

  // ==========================================
  // DASHBOARD STATS
  // ==========================================

  async getDashboardStats() {
    try {
      const stats = {};

      // Total users
      stats.totalUsers = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // Active users
      stats.activeUsers = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users WHERE is_active = 1', (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // Total patients
      stats.totalPatients = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM patients', (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });

      // Today's appointments
      stats.appointmentsToday = await new Promise((resolve, reject) => {
        db.get(
          `SELECT COUNT(*) as count FROM appointments 
           WHERE DATE(appointment_date) = DATE('now')`,
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      // Recent activity
      stats.recentActivities = await new Promise((resolve, reject) => {
        db.all(
          `SELECT al.*, u.username FROM audit_logs al
           LEFT JOIN users u ON al.user_id = u.user_id
           ORDER BY al.created_at DESC LIMIT 10`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      return stats;
    } catch (err) {
      throw new Error(`Failed to get dashboard stats: ${err.message}`);
    }
  }
}

export default AdminService;