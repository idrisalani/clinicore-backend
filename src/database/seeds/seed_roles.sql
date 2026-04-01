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
-- Assign Permissions to Super Admin Role
-- (All permissions)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role, permission_id)
SELECT 'Super Admin', permission_id FROM permissions;

-- ============================================
-- Assign Permissions to System Admin Role
-- (All except user deletion and role deletion)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role, permission_id)
SELECT 'System Admin', permission_id FROM permissions
WHERE name NOT IN ('delete_user', 'delete_role');

-- ============================================
-- Assign Permissions to Doctor Role
-- (Clinical modules only)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role, permission_id)
SELECT 'Doctor', permission_id FROM permissions
WHERE resource IN ('Dashboard', 'Patients', 'Appointments', 'Consultations', 'Lab', 'Pharmacy');

-- ============================================
-- Assign Permissions to Staff Role
-- (Limited permissions)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role, permission_id)
SELECT 'Staff', permission_id FROM permissions
WHERE name IN (
  'view_dashboard',
  'view_patients',
  'create_patient',
  'view_appointments',
  'create_appointment',
  'view_pharmacy',
  'view_billing'
);

-- ============================================
-- Assign Permissions to Patient Role
-- (Self-service only)
-- ============================================

INSERT OR IGNORE INTO role_permissions (role, permission_id)
SELECT 'Patient', permission_id FROM permissions
WHERE name IN (
  'view_dashboard'
);

-- ============================================
-- Roles and permissions seeded successfully!
-- ============================================