-- ============================================
-- SEED DATA: Roles
-- Default system roles with permission levels
-- ============================================

-- ============================================
-- Default Roles
-- ============================================

-- Super Admin - Full system access
INSERT OR IGNORE INTO roles (role_name, description, level) VALUES
('Super Admin', 'Full system access - all permissions', 1);

-- System Admin - Most permissions except user deletion
INSERT OR IGNORE INTO roles (role_name, description, level) VALUES
('System Admin', 'Administrative access - most permissions', 2);

-- Manager Admin - Department/module specific access
INSERT OR IGNORE INTO roles (role_name, description, level) VALUES
('Manager', 'Manager/Department admin', 3);

-- Doctor - Clinical staff permissions
INSERT OR IGNORE INTO roles (role_name, description, level) VALUES
('Doctor', 'Clinical staff', 4);

-- Staff - Limited permissions
INSERT OR IGNORE INTO roles (role_name, description, level) VALUES
('Staff', 'Support staff', 5);

-- Patient - Self-service only
INSERT OR IGNORE INTO roles (role_name, description, level) VALUES
('Patient', 'Patient user', 6);

-- ============================================
-- Assign Permissions to Super Admin Role (role_id = 1)
-- (All permissions)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 1, permission_id FROM permissions;

-- ============================================
-- Assign Permissions to System Admin Role (role_id = 2)
-- (All except delete_users and delete_patients)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 2, permission_id FROM permissions
WHERE name NOT IN ('delete_users', 'delete_patients');

-- ============================================
-- Assign Permissions to Doctor Role (role_id = 4)
-- (Clinical modules only)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 4, permission_id FROM permissions
WHERE resource IN ('Dashboard', 'Patients', 'Appointments', 'Consultations', 'Lab', 'Pharmacy');

-- ============================================
-- Assign Permissions to Staff Role (role_id = 5)
-- (Limited permissions)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 5, permission_id FROM permissions
WHERE name IN (
  'view_dashboard',
  'view_patients',
  'create_patients',
  'view_appointments',
  'create_appointments',
  'view_pharmacy',
  'view_billing'
);

-- ============================================
-- Assign Permissions to Patient Role (role_id = 6)
-- (Self-service only)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT 6, permission_id FROM permissions
WHERE name IN (
  'view_dashboard'
);

-- ============================================
-- Roles and permissions seeded successfully!
-- ============================================