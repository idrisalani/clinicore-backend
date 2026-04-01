-- ==========================================
-- PHASE 10: ADMIN DASHBOARD & RBAC
-- ==========================================
-- Role-Based Access Control
-- System Administration Features
-- Activity Logging & Audit Trail
-- ==========================================

-- ==========================================
-- Roles Table
-- ==========================================
CREATE TABLE IF NOT EXISTS roles (
  role_id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_name TEXT UNIQUE NOT NULL,
  description TEXT,
  level INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Permissions Table
-- ==========================================
CREATE TABLE IF NOT EXISTS permissions (
  permission_id INTEGER PRIMARY KEY AUTOINCREMENT,
  permission_name TEXT UNIQUE NOT NULL,
  module TEXT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Role Permissions (Many-to-Many)
-- ==========================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER,
  permission_id INTEGER,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(role_id),
  FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
);

-- ==========================================
-- Activity Logs (Audit Trail)
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_logs (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  module TEXT,
  entity_type TEXT,
  entity_id INTEGER,
  old_value TEXT,
  new_value TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ==========================================
-- System Settings
-- ==========================================
CREATE TABLE IF NOT EXISTS system_settings (
  setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  setting_key TEXT UNIQUE,
  setting_value TEXT,
  setting_type TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Indexes for Performance
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_roles_role_name ON roles(role_name);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_system_settings_setting_key ON system_settings(setting_key);

-- ==========================================
-- Seed Default Data
-- ==========================================

-- Default Roles
INSERT OR IGNORE INTO roles (role_name, description, level) VALUES
  ('Super Admin', 'Full system access - all permissions', 1),
  ('System Admin', 'Administrative access - most permissions', 2),
  ('Manager', 'Manager/Department admin', 3),
  ('Doctor', 'Clinical staff', 4),
  ('Staff', 'Support staff', 5),
  ('Patient', 'Patient user', 6);

-- Default Permissions (by module)
INSERT OR IGNORE INTO permissions (permission_name, module, description) VALUES
  ('view_dashboard', 'Dashboard', 'View dashboard'),
  ('view_users', 'Users', 'View all users'),
  ('create_users', 'Users', 'Create new users'),
  ('edit_users', 'Users', 'Edit user details'),
  ('delete_users', 'Users', 'Delete users'),
  ('manage_roles', 'Roles', 'Create/edit roles'),
  ('manage_permissions', 'Permissions', 'Assign permissions'),
  ('view_patients', 'Patients', 'View patients'),
  ('create_patients', 'Patients', 'Create patients'),
  ('edit_patients', 'Patients', 'Edit patient details'),
  ('delete_patients', 'Patients', 'Delete patients'),
  ('view_appointments', 'Appointments', 'View appointments'),
  ('create_appointments', 'Appointments', 'Create appointments'),
  ('view_consultations', 'Consultations', 'View consultations'),
  ('view_lab', 'Lab', 'View lab orders'),
  ('create_lab_orders', 'Lab', 'Create lab orders'),
  ('view_pharmacy', 'Pharmacy', 'View pharmacy'),
  ('create_prescriptions', 'Pharmacy', 'Create prescriptions'),
  ('view_billing', 'Billing', 'View billing/invoices'),
  ('create_invoices', 'Billing', 'Create invoices'),
  ('record_payments', 'Billing', 'Record payments'),
  ('view_logs', 'Admin', 'View activity logs'),
  ('manage_settings', 'Admin', 'Manage system settings');

-- Assign all permissions to Super Admin
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, permission_id FROM permissions;

-- ==========================================
-- NOTES FOR DEVELOPERS
-- ==========================================
/*
1. Roles Table:
   - Defines user roles/groups
   - Level: 1 = highest privilege, 6 = lowest
   - Default roles: Super Admin, System Admin, Manager, Doctor, Staff, Patient

2. Permissions Table:
   - Granular access control
   - Organized by module (Users, Patients, Billing, etc.)
   - Can be assigned to multiple roles

3. Role Permissions:
   - Many-to-many relationship
   - Role can have many permissions
   - Permission can be in many roles

4. Activity Logs:
   - Audit trail for compliance
   - Tracks WHO did WHAT, WHEN, and VALUE CHANGES
   - Essential for medical records compliance (GDPR, etc.)

5. System Settings:
   - Configuration management
   - Company info, tax rates, defaults
   - Can be updated without code changes

6. Security:
   - Use middleware to check permissions before actions
   - Example: checkPermission('create_invoices')
   - Log all admin actions to activity_logs

7. Default Setup:
   - Super Admin has ALL permissions
   - Other roles can be configured via admin panel
   - All permissions are seeded at install
*/