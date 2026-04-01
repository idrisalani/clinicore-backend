-- ============================================
-- CliniCore Phase 2 - SEED DATA ONLY
-- Insert test patients and appointments
-- ============================================

-- Clear existing seed data (if any) and insert fresh data
DELETE FROM medical_history;
DELETE FROM medications;
DELETE FROM appointments;

-- Insert 5 test patients
INSERT INTO patients (
  first_name, last_name, email, phone, date_of_birth, gender,
  blood_type, city, state, country,
  insurance_provider, emergency_contact_name, emergency_contact_phone,
  user_id, created_by, is_active
) VALUES
('Chioma', 'Okafor', 'chioma.okafor@clinic.ng', '+234-801-234-5678', '1985-06-15', 'Female',
 'O+', 'Lagos', 'Lagos', 'Nigeria', 'NHIS', 'Emeka Okafor', '+234-801-234-5679', NULL, 1, 1),
('Tunde', 'Adeyemi', 'tunde.adeyemi@clinic.ng', '+234-802-345-6789', '1978-03-22', 'Male',
 'A+', 'Ibadan', 'Oyo', 'Nigeria', 'Axa Mansard', 'Ayo Adeyemi', '+234-802-345-6790', NULL, 1, 1),
('Zainab', 'Hassan', 'zainab.hassan@clinic.ng', '+234-803-456-7890', '1992-09-10', 'Female',
 'B-', 'Kano', 'Kano', 'Nigeria', 'UAC', 'Ibrahim Hassan', '+234-803-456-7891', NULL, 1, 1),
('Ikechukwu', 'Nwosu', 'ikechukwu.nwosu@clinic.ng', '+234-804-567-8901', '1988-12-05', 'Male',
 'AB+', 'Port Harcourt', 'Rivers', 'Nigeria', 'Allianz', 'Chinedu Nwosu', '+234-804-567-8902', NULL, 1, 1),
('Amara', 'Okoro', 'amara.okoro@clinic.ng', '+234-805-678-9012', '1995-01-28', 'Female',
 'O-', 'Abuja', 'FCT', 'Nigeria', 'NHIS', 'Nonso Okoro', '+234-805-678-9013', NULL, 1, 1);

-- Insert test appointments
INSERT INTO appointments (
  patient_id, doctor_id, appointment_date, appointment_time,
  duration_minutes, reason_for_visit, status, is_confirmed, created_by
) VALUES
(1, 1, date('now', '+1 day'), '09:00', 30, 'General Checkup', 'Scheduled', 0, 1),
(2, 1, date('now', '+2 days'), '10:30', 30, 'Follow-up', 'Scheduled', 0, 1),
(3, 1, date('now', '+3 days'), '14:00', 45, 'Consultation', 'Scheduled', 0, 1);

-- Insert test medical history
INSERT INTO medical_history (
  patient_id, doctor_id, visit_date, visit_type,
  chief_complaint, diagnosis, treatment_plan, created_by
) VALUES
(1, 1, date('now', '-7 days'), 'Consultation',
 'Headache and fever', 'Malaria', 'Antimalarial drugs for 3 days', 1),
(2, 1, date('now', '-14 days'), 'Follow-up',
 'Post-treatment check', 'Recovery on track', 'Continue medication', 1);

-- ============================================
-- Seed data inserted successfully!
-- ============================================