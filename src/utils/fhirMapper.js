// ============================================
// fhirMapper.js
// File: backend/src/utils/fhirMapper.js
//
// Pure functions that transform CliniCore DB rows
// into valid HL7 FHIR R4 resources (JSON format).
// No DB calls here — just data transformation.
//
// FHIR R4 spec: https://hl7.org/fhir/R4/
// ============================================

const FHIR_BASE = process.env.FHIR_BASE_URL || 'https://clinicore-backend-71qa.onrender.com/api/v1/fhir';

// ── Shared helpers ────────────────────────────────────────────────────────────
const fhirDate     = (d) => d ? d.split('T')[0] : undefined;
const fhirDateTime = (d) => d ? new Date(d).toISOString() : undefined;
const gender       = (g) => ({ Male:'male', Female:'female', Other:'other' }[g] || 'unknown');

const codeable = (code, display, system = 'http://snomed.info/sct') => ({
  coding: [{ system, code, display }],
  text: display,
});

const ref = (resource, id) => ({ reference: `${resource}/${id}` });

// ── Patient resource ──────────────────────────────────────────────────────────
// Maps: patients row + optional users row
export const toFHIRPatient = (patient) => ({
  resourceType: 'Patient',
  id:           String(patient.patient_id),
  meta: {
    profile:     ['http://hl7.org/fhir/R4/StructureDefinition/Patient'],
    lastUpdated: fhirDateTime(patient.updated_at),
  },
  identifier: [
    {
      use:    'official',
      system: `${FHIR_BASE}/identifier/patient`,
      value:  patient.patient_number,
    },
    ...(patient.insurance_policy_number ? [{
      use:    'secondary',
      type:   codeable('SB', 'Social Beneficiary Identifier', 'http://terminology.hl7.org/CodeSystem/v2-0203'),
      system: `${FHIR_BASE}/identifier/insurance`,
      value:  patient.insurance_policy_number,
      assigner: { display: patient.insurance_provider || 'Unknown' },
    }] : []),
  ],
  active: patient.is_active === 1,
  name: [{
    use:    'official',
    family: patient.last_name,
    given:  [patient.first_name],
    text:   `${patient.first_name} ${patient.last_name}`,
  }],
  telecom: [
    ...(patient.phone ? [{ system:'phone', value: patient.phone, use:'mobile' }] : []),
    ...(patient.email ? [{ system:'email', value: patient.email              }] : []),
  ],
  gender:    gender(patient.gender),
  birthDate: fhirDate(patient.date_of_birth),
  address: patient.address ? [{
    use:   'home',
    text:  patient.address,
    state: patient.state,
    country: 'NG',
  }] : undefined,
  contact: patient.emergency_contact_name ? [{
    relationship: patient.emergency_contact_relationship ? [
      codeable(patient.emergency_contact_relationship, patient.emergency_contact_relationship,
               'http://terminology.hl7.org/CodeSystem/v2-0131')
    ] : undefined,
    name:    { text: patient.emergency_contact_name },
    telecom: patient.emergency_contact_phone ? [{ system:'phone', value: patient.emergency_contact_phone }] : undefined,
  }] : undefined,
  communication: [{ language: { coding: [{ system:'urn:ietf:bcp:47', code:'en' }] }, preferred: true }],
  extension: [
    ...(patient.blood_type ? [{
      url:         'http://hl7.org/fhir/StructureDefinition/patient-bloodType',
      valueString: patient.blood_type,
    }] : []),
    ...(patient.genotype ? [{
      url:         `${FHIR_BASE}/StructureDefinition/patient-genotype`,
      valueString: patient.genotype,
    }] : []),
    ...(patient.allergies ? [{
      url:         `${FHIR_BASE}/StructureDefinition/patient-allergies`,
      valueString: patient.allergies,
    }] : []),
  ].filter(Boolean),
});

// ── Encounter resource ────────────────────────────────────────────────────────
// Maps: consultations row
export const toFHIREncounter = (consultation, patientId) => ({
  resourceType: 'Encounter',
  id:           String(consultation.consultation_id),
  meta: {
    lastUpdated: fhirDateTime(consultation.updated_at),
  },
  status: ({
    'Completed': 'finished',
    'In Progress': 'in-progress',
    'Cancelled': 'cancelled',
    'Scheduled': 'planned',
  }[consultation.status] || 'unknown'),
  class: {
    system:  'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code:    'AMB',
    display: 'ambulatory',
  },
  type: [{
    coding: [{
      system:  'http://snomed.info/sct',
      code:    '11429006',
      display: 'Consultation',
    }],
    text: 'General Consultation',
  }],
  subject: ref('Patient', patientId || consultation.patient_id),
  participant: consultation.doctor_id ? [{
    type: [codeable('PPRF', 'primary performer', 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType')],
    individual: ref('Practitioner', consultation.doctor_id),
  }] : undefined,
  period: {
    start: fhirDateTime(consultation.consultation_date),
    end:   consultation.status === 'Completed' ? fhirDateTime(consultation.updated_at) : undefined,
  },
  reasonCode: consultation.chief_complaint ? [{
    text: consultation.chief_complaint,
  }] : undefined,
  diagnosis: consultation.diagnosis ? [{
    condition: { display: consultation.diagnosis },
    use: codeable('AD', 'Admission diagnosis', 'http://terminology.hl7.org/CodeSystem/diagnosis-role'),
  }] : undefined,
  serviceProvider: { display: 'CliniCore Clinic' },
});

// ── Appointment resource ──────────────────────────────────────────────────────
export const toFHIRAppointment = (appointment) => ({
  resourceType: 'Appointment',
  id:           String(appointment.appointment_id),
  meta: { lastUpdated: fhirDateTime(appointment.updated_at) },
  status: ({
    'Scheduled':    'booked',
    'Completed':    'fulfilled',
    'Cancelled':    'cancelled',
    'No-Show':      'noshow',
    'Rescheduled':  'pending',
  }[appointment.status] || 'pending'),
  serviceType: [{ text: appointment.reason_for_visit || 'General consultation' }],
  start: appointment.appointment_date && appointment.appointment_time
    ? `${appointment.appointment_date}T${appointment.appointment_time}:00+01:00`
    : `${appointment.appointment_date}T00:00:00+01:00`,
  end: undefined,
  minutesDuration: appointment.duration_minutes || 30,
  participant: [
    {
      actor:  ref('Patient', appointment.patient_id),
      status: 'accepted',
    },
    ...(appointment.doctor_id ? [{
      actor:  ref('Practitioner', appointment.doctor_id),
      status: 'accepted',
    }] : []),
  ],
  comment: appointment.notes,
});

// ── Observation resource (lab result) ─────────────────────────────────────────
// Maps: lab_orders + lab_results rows
export const toFHIRObservation = (labOrder, labResult = null) => ({
  resourceType: 'Observation',
  id:           labResult ? `lr-${labResult.result_id}` : `lo-${labOrder.lab_order_id}`,
  meta:         { lastUpdated: fhirDateTime(labOrder.updated_at) },
  status: ({
    'Pending':    'registered',
    'Collected':  'preliminary',
    'Processing': 'preliminary',
    'Completed':  'final',
    'Cancelled':  'cancelled',
  }[labOrder.status] || 'unknown'),
  category: [{
    coding: [{
      system:  'http://terminology.hl7.org/CodeSystem/observation-category',
      code:    'laboratory',
      display: 'Laboratory',
    }],
  }],
  code: {
    coding: [{
      system:  'http://loinc.org',
      display: labOrder.test_name,
    }],
    text: labOrder.test_name,
  },
  subject: ref('Patient', labOrder.patient_id),
  effectiveDateTime: fhirDateTime(labOrder.ordered_date),
  issued:            labResult ? fhirDateTime(labResult.result_date || labOrder.updated_at) : undefined,
  performer: labOrder.doctor_id ? [ref('Practitioner', labOrder.doctor_id)] : undefined,
  valueString: labResult?.result_value,
  referenceRange: labResult?.reference_range ? [{
    text: labResult.reference_range,
  }] : undefined,
  note: labResult?.notes ? [{ text: labResult.notes }] : undefined,
  interpretation: labResult?.is_abnormal ? [{
    coding: [{
      system:  'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
      code:    'A',
      display: 'Abnormal',
    }],
  }] : undefined,
});

// ── MedicationRequest resource ────────────────────────────────────────────────
// Maps: medications (patient history) rows
export const toFHIRMedicationRequest = (medication) => ({
  resourceType: 'MedicationRequest',
  id:           String(medication.medication_id),
  meta:         { lastUpdated: fhirDateTime(medication.updated_at) },
  status: ({
    'Active':    'active',
    'Completed': 'completed',
    'Cancelled': 'cancelled',
    'Suspended': 'on-hold',
  }[medication.status] || 'unknown'),
  intent: 'order',
  medicationCodeableConcept: {
    coding: [{
      system:  'http://www.nlm.nih.gov/research/umls/rxnorm',
      display: medication.medication_name,
    }],
    text: medication.medication_name,
  },
  subject:      ref('Patient', medication.patient_id),
  authoredOn:   fhirDate(medication.start_date),
  requester:    medication.prescribed_by ? ref('Practitioner', medication.prescribed_by) : undefined,
  dosageInstruction: [{
    text: `${medication.dosage || ''} ${medication.frequency || ''}`.trim() || undefined,
    timing: medication.frequency ? {
      code: { text: medication.frequency },
    } : undefined,
    doseAndRate: medication.dosage ? [{
      doseQuantity: {
        value: parseFloat(medication.dosage) || undefined,
        unit:  medication.dosage_unit || 'dose',
      },
    }] : undefined,
  }],
  dispenseRequest: {
    validityPeriod: {
      start: fhirDate(medication.start_date),
      end:   fhirDate(medication.end_date),
    },
  },
  note: medication.notes ? [{ text: medication.notes }] : undefined,
});

// ── Bundle builder ────────────────────────────────────────────────────────────
// Wraps multiple resources in a FHIR Bundle
export const toFHIRBundle = (type, entries) => ({
  resourceType: 'Bundle',
  id:           `bundle-${Date.now()}`,
  type,  // 'searchset' | 'collection' | 'document'
  timestamp:    new Date().toISOString(),
  total:        entries.length,
  entry:        entries.map(resource => ({
    fullUrl:  `${FHIR_BASE}/${resource.resourceType}/${resource.id}`,
    resource,
  })),
});

// ── Patient summary Bundle (all key resources for one patient) ────────────────
export const toFHIRPatientSummary = (patient, consultations = [], labOrders = [], medications = []) =>
  toFHIRBundle('collection', [
    toFHIRPatient(patient),
    ...consultations.map(c => toFHIREncounter(c, patient.patient_id)),
    ...labOrders.map(o => toFHIRObservation(o)),
    ...medications.map(m => toFHIRMedicationRequest(m)),
  ]);