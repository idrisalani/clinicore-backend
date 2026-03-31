-- ==========================================
-- PHASE 7: BILLING & PAYMENTS SYSTEM
-- ==========================================
-- This SQL adds billing management tables
-- Currency: Nigerian Naira (NGN)
-- Run AFTER Phase 6 is complete

-- ==========================================
-- Service Catalog Table
-- ==========================================
CREATE TABLE IF NOT EXISTS services (
  service_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Service Information
  service_name TEXT NOT NULL,
  service_code TEXT UNIQUE,
  category TEXT,                   -- Consultation, Lab, Procedure, etc.
  description TEXT,
  
  -- Pricing (NGN - Nigerian Naira)
  base_price REAL NOT NULL,        -- Price in NGN
  currency TEXT DEFAULT 'NGN',
  
  -- Status
  is_active INTEGER DEFAULT 1,
  
  -- Audit Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Invoices Table
-- ==========================================
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  patient_id INTEGER NOT NULL,
  
  -- ✅ NEW: Recipient Information Fields (Added 2026-03-31)
  -- These fields ensure invoices have complete recipient information
  recipient_name TEXT NOT NULL,    -- Name of invoice recipient (patient/guardian)
  recipient_email TEXT NOT NULL,   -- Email for sending invoice
  recipient_phone TEXT,            -- Phone for follow-up
  -- ✅ END NEW
  
  consultation_id INTEGER,
  doctor_id INTEGER,
  
  -- Invoice Details
  invoice_number TEXT UNIQUE NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  
  -- Amount Information (NGN)
  subtotal REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  tax_percentage REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  discount_percentage REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  currency TEXT DEFAULT 'NGN',
  
  -- Status
  status TEXT CHECK(status IN ('Draft', 'Issued', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled')) DEFAULT 'Draft',
  
  -- Payment Details
  amount_paid REAL DEFAULT 0,
  amount_due REAL,
  
  -- Notes
  notes TEXT,
  payment_terms TEXT,
  
  -- Audit Fields
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (consultation_id) REFERENCES consultations(consultation_id),
  FOREIGN KEY (doctor_id) REFERENCES users(user_id)
);

-- ==========================================
-- Invoice Line Items Table
-- ==========================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  line_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  invoice_id INTEGER NOT NULL,
  service_id INTEGER,
  
  -- Line Item Details
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price REAL NOT NULL,       -- Price in NGN
  line_total REAL NOT NULL,       -- quantity * unit_price
  
  -- Audit Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
  FOREIGN KEY (service_id) REFERENCES services(service_id)
);

-- ==========================================
-- Payments Table
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
  payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  invoice_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  
  -- Payment Details
  payment_date DATE NOT NULL,
  amount_paid REAL NOT NULL,      -- Amount in NGN
  currency TEXT DEFAULT 'NGN',
  
  -- Payment Method
  payment_method TEXT CHECK(payment_method IN ('Cash', 'Bank Transfer', 'Card', 'Cheque', 'Mobile Money', 'Other')) DEFAULT 'Cash',
  reference_number TEXT,          -- Transaction/Cheque reference
  
  -- Notes
  notes TEXT,
  
  -- Audit Fields
  received_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (invoice_id) REFERENCES invoices(invoice_id),
  FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  FOREIGN KEY (received_by) REFERENCES users(user_id)
);

-- ==========================================
-- Billing Settings Table
-- ==========================================
CREATE TABLE IF NOT EXISTS billing_settings (
  setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Organization Details
  clinic_name TEXT,
  clinic_address TEXT,
  clinic_phone TEXT,
  clinic_email TEXT,
  tax_id TEXT,                    -- Tax registration number
  
  -- Tax Settings
  default_tax_percentage REAL DEFAULT 0,
  currency TEXT DEFAULT 'NGN',
  
  -- Invoice Settings
  invoice_prefix TEXT DEFAULT 'INV-',
  next_invoice_number INTEGER DEFAULT 1000,
  
  -- Payment Terms
  default_payment_terms TEXT,
  default_due_days INTEGER,
  
  -- Audit Fields
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Receipt Table
-- ==========================================
CREATE TABLE IF NOT EXISTS receipts (
  receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Foreign Keys
  payment_id INTEGER NOT NULL,
  issued_by INTEGER,
  
  -- Receipt Details
  receipt_number TEXT UNIQUE NOT NULL,
  receipt_date DATE NOT NULL,
  
  -- Amount
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'NGN',
  
  -- Audit Fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (payment_id) REFERENCES payments(payment_id),
  FOREIGN KEY (issued_by) REFERENCES users(user_id)
);

-- ==========================================
-- Indexes for Performance
-- ==========================================

-- Services Indexes
CREATE INDEX IF NOT EXISTS idx_services_service_code ON services(service_code);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON services(is_active);

-- Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_consultation_id ON invoices(consultation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_doctor_id ON invoices(doctor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Invoice Line Items Indexes
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_service_id ON invoice_line_items(service_id);

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);

-- Receipts Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON receipts(receipt_number);

-- ==========================================
-- SAMPLE DATA (Optional - for testing)
-- ==========================================

-- Sample Services (uncomment to seed)
/*
INSERT INTO services (service_name, service_code, category, description, base_price) VALUES
  ('Consultation', 'SVC-001', 'Consultation', 'General doctor consultation', 5000),
  ('Blood Test (CBC)', 'SVC-002', 'Laboratory', 'Complete blood count test', 3500),
  ('Ultrasound', 'SVC-003', 'Imaging', 'Ultrasound scan', 8000),
  ('Injection', 'SVC-004', 'Procedure', 'Intramuscular injection', 2000),
  ('Pharmacy Markup', 'SVC-005', 'Medication', 'Medication dispensing charge', 500);

-- Sample Billing Settings
INSERT INTO billing_settings (
  clinic_name, clinic_address, clinic_phone, clinic_email,
  default_tax_percentage, invoice_prefix, next_invoice_number,
  default_payment_terms, default_due_days
) VALUES
  ('CliniCore Medical Center', '123 Medical Street, Lagos', '+234-800-CLINIC', 'billing@clinicore.ng',
   0, 'INV-', 1001, 'Payment due within 7 days', 7);
*/

-- ==========================================
-- NOTES FOR DEVELOPERS
-- ==========================================
/*
1. Services Table:
   - Central repository of billable services
   - Prices stored in NGN (Nigerian Naira)
   - Categories: Consultation, Lab, Imaging, Procedure, Medication
   - is_active flag for discontinued services

2. Invoices Table:
   - Main billing document
   - Links to patient, consultation, doctor
   - Unique invoice_number for reference
   - Automatic invoice_date and due_date calculation
   - ✅ NEW: Recipient information fields (recipient_name, recipient_email, recipient_phone)
     These ensure every invoice has complete recipient details for professional invoicing
   - Status tracking: Draft → Issued → Sent → Paid/Partially Paid
   - Supports discounts and taxes
   - Track amount_paid vs amount_due

3. Invoice Line Items:
   - Individual charges on invoice
   - Can reference services catalog or be custom
   - Supports quantity (for bundled services)
   - Auto-calculates line_total

4. Payments Table:
   - Records all payments received
   - Multiple payments can be recorded for one invoice
   - Payment methods: Cash, Bank Transfer, Card, Cheque, Mobile Money
   - Reference number tracks transaction ID/cheque number
   - Tracks who received payment

5. Billing Settings:
   - Organization information
   - Tax rate configuration
   - Invoice numbering system
   - Default payment terms

6. Receipts Table:
   - Official receipt for payment
   - Links to payment record
   - Unique receipt number for audit trail
   - Tracks who issued receipt

7. Currency:
   - All monetary values in NGN (Nigerian Naira)
   - Default currency field for future multi-currency support

8. Status Types:
   - Draft: Invoice being prepared
   - Issued: Invoice created
   - Sent: Invoice sent to patient
   - Partially Paid: Some payment received
   - Paid: Full payment received
   - Overdue: Past due date without full payment
   - Cancelled: Invoice cancelled

9. Integration:
   - Invoices link to consultations
   - Payments update invoice status
   - Multiple payments can be made per invoice
   - Receipts provide payment proof
   - Statistics can be calculated per doctor, patient, period
   - ✅ Recipient information enables professional invoice delivery

10. Financial Reporting:
    - Daily, monthly, yearly revenue
    - Outstanding receivables
    - Payment collection rate
    - Service-wise revenue breakdown

11. ✅ UPDATES (2026-03-31):
    - Added recipient_name, recipient_email, recipient_phone to invoices table
    - These fields are now REQUIRED for professional invoicing
    - Enables proper invoice delivery to customers
*/