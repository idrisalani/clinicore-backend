-- ============================================
-- SEED DATA: Permissions
-- System-wide permissions by module
-- ============================================

-- ============================================
-- Dashboard Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_dashboard', 'View dashboard', 'Dashboard', 'read');

-- ============================================
-- Patient Management Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_patients', 'View patient records', 'Patients', 'read'),
('create_patient', 'Create new patient', 'Patients', 'create'),
('edit_patient', 'Edit patient records', 'Patients', 'update'),
('delete_patient', 'Delete patient records', 'Patients', 'delete');

-- ============================================
-- Appointment Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_appointments', 'View appointments', 'Appointments', 'read'),
('create_appointment', 'Create appointment', 'Appointments', 'create'),
('edit_appointment', 'Edit appointment', 'Appointments', 'update'),
('cancel_appointment', 'Cancel appointment', 'Appointments', 'delete');

-- ============================================
-- Consultation Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_consultations', 'View consultations', 'Consultations', 'read'),
('create_consultation', 'Create consultation', 'Consultations', 'create'),
('edit_consultation', 'Edit consultation', 'Consultations', 'update'),
('delete_consultation', 'Delete consultation', 'Consultations', 'delete');

-- ============================================
-- Laboratory Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_lab', 'View lab orders', 'Lab', 'read'),
('create_lab_order', 'Create lab order', 'Lab', 'create'),
('view_lab_results', 'View lab results', 'Lab', 'read'),
('enter_lab_results', 'Enter lab results', 'Lab', 'update');

-- ============================================
-- Pharmacy Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_pharmacy', 'View pharmacy', 'Pharmacy', 'read'),
('create_prescription', 'Create prescription', 'Pharmacy', 'create'),
('edit_prescription', 'Edit prescription', 'Pharmacy', 'update'),
('dispense_medication', 'Dispense medication', 'Pharmacy', 'update');

-- ============================================
-- Billing Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_billing', 'View billing/invoices', 'Billing', 'read'),
('create_invoice', 'Create invoice', 'Billing', 'create'),
('record_payment', 'Record payment', 'Billing', 'update'),
('refund_payment', 'Process refunds', 'Billing', 'delete');

-- ============================================
-- User Management Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_users', 'View all users', 'Users', 'read'),
('create_user', 'Create new user', 'Users', 'create'),
('edit_user', 'Edit user details', 'Users', 'update'),
('delete_user', 'Delete users', 'Users', 'delete'),
('manage_user_roles', 'Manage user roles', 'Users', 'update');

-- ============================================
-- Role Management Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_roles', 'View all roles', 'Roles', 'read'),
('create_role', 'Create custom role', 'Roles', 'create'),
('edit_role', 'Edit role details', 'Roles', 'update'),
('delete_role', 'Delete role', 'Roles', 'delete');

-- ============================================
-- Permission Management Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('manage_permissions', 'Assign permissions', 'Permissions', 'update');

-- ============================================
-- Admin & System Permissions
-- ============================================
INSERT OR IGNORE INTO permissions (name, description, resource, action) VALUES
('view_activity_logs', 'View activity logs', 'Admin', 'read'),
('view_settings', 'View system settings', 'Admin', 'read'),
('manage_settings', 'Manage system settings', 'Admin', 'update');

-- ============================================
-- Permissions seeded successfully!
-- ============================================