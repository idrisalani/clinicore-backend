-- ============================================
-- SEED DATA: Patients
-- Test patient records with medical history
-- ============================================

-- ============================================
-- Test Patients
-- ============================================
INSERT OR IGNORE INTO patients (
  first_name, last_name, email, phone, date_of_birth, gender,
  blood_type, city, state, country,
  insurance_provider, emergency_contact_name, emergency_contact_phone,
  user_id, created_by, is_active
) VALUES
('Chioma', 'Okafor', 'chioma.okafor@clinic.ng', '+234-801-234-5678', '1985-06-15', 'Female',
 'O+', 'Lagos', 'Lagos', 'Nigeria', 'NHIS', 'Emeka Okafor', '+234-801-234-5679', 9, 2, 1);

INSERT OR IGNORE INTO patients (
  first_name, last_name, email, phone, date_of_birth, gender,
  blood_type, city, state, country,
  insurance_provider, emergency_contact_name, emergency_contact_phone,
  user_id, created_by, is_active
) VALUES
('Tunde', 'Adeyemi', 'tunde.adeyemi@clinic.ng', '+234-802-345-6789', '1978-03-22', 'Male',
 'A+', 'Ibadan', 'Oyo', 'Nigeria', 'Axa Mansard', 'Ayo Adeyemi', '+234-802-345-6790', 10, 2, 1);

INSERT OR IGNORE INTO patients (
  first_name, last_name, email, phone, date_of_birth, gender,
  blood_type, city, state, country,
  insurance_provider, emergency_contact_name, emergency_contact_phone,
  created_by, is_active
) VALUES
('Zainab', 'Hassan', 'zainab.hassan@clinic.ng', '+234-803-456-7890', '1992-09-10', 'Female',
 'B-', 'Kano', 'Kano', 'Nigeria', 'UAC', 'Ibrahim Hassan', '+234-803-456-7891', 2, 1);

INSERT OR IGNORE INTO patients (
  first_name, last_name, email, phone, date_of_birth, gender,
  blood_type, city, state, country,
  insurance_provider, emergency_contact_name, emergency_contact_phone,
  created_by, is_active
) VALUES
('Ikechukwu', 'Nwosu', 'ikechukwu.nwosu@clinic.ng', '+234-804-567-8901', '1988-12-05', 'Male',
 'AB+', 'Port Harcourt', 'Rivers', 'Nigeria', 'Allianz', 'Chinedu Nwosu', '+234-804-567-8902', 2, 1);

INSERT OR IGNORE INTO patients (
  first_name, last_name, email, phone, date_of_birth, gender,
  blood_type, city, state, country,
  insurance_provider, emergency_contact_name, emergency_contact_phone,
  created_by, is_active
) VALUES
('Amara', 'Okoro', 'amara.okoro@clinic.ng', '+234-805-678-9012', '1995-01-28', 'Female',
 'O-', 'Abuja', 'FCT', 'Nigeria', 'NHIS', 'Nonso Okoro', '+234-805-678-9013', 2, 1);

-- ============================================
-- Seed data inserted successfully!
-- ============================================