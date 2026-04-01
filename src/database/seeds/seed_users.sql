-- ============================================
-- SEED DATA: Users
-- Default system users and test accounts
-- ============================================

-- ============================================
-- Default Users (Passwords are hashed bcrypt)
-- ============================================

-- Super Admin User
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('admin1', 'admin1@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Admin One', '+234-800-000-0001', 'admin', 'Administration', 1);

INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('admin2', 'admin2@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Admin Two', '+234-800-000-0002', 'admin', 'Administration', 1);

INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('admin3', 'admin3@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Admin Three', '+234-800-000-0003', 'admin', 'Administration', 1);

-- Doctor Users
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('doctor1', 'doctor@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Dr Ahmed Hassan', '+234-801-234-5678', 'doctor', 'Clinical', 1);

INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('doctor2', 'doctor2@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Dr Chioma Eze', '+234-802-234-5678', 'doctor', 'Clinical', 1);

-- Staff Users
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('staff1', 'staff@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Nurse Sarah', '+234-803-234-5678', 'staff', 'Nursing', 1);

INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('receptionist1', 'reception@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Receptionist Tunde', '+234-804-234-5678', 'staff', 'Reception', 1);

-- Lab Technician
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('lab_tech1', 'lab@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Lab Technician Zainab', '+234-805-234-5678', 'staff', 'Laboratory', 1);

-- Pharmacist
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, department, is_active) VALUES
('pharmacist1', 'pharmacy@clinicore.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Pharmacist Amara', '+234-806-234-5678', 'staff', 'Pharmacy', 1);

-- Patient Users (for self-service portal)
INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES
('patient1', 'patient1@email.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Chioma Okafor', '+234-801-234-5600', 'patient', 1);

INSERT OR IGNORE INTO users (username, email, password_hash, full_name, phone, role, is_active) VALUES
('patient2', 'patient2@email.com', '$2b$10$YPM/aHqQ.X5Q9Y5Y5Y5Y5u5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y', 'Tunde Adeyemi', '+234-802-234-5601', 'patient', 1);

-- ============================================
-- NOTE: Password hashes are placeholder bcrypt
-- In production, regenerate with actual bcrypt hashes
-- Password: SecurePass123 → bcrypt hash
-- ============================================