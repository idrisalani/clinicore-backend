import { query } from '../config/database.js';
import Joi from 'joi';
import { sendAppointmentReminder, logNotification } from '../services/notificationService.js';

// ==========================================
// Validation Schemas
// ==========================================

const appointmentSchema = Joi.object({
  patient_id:       Joi.number().required().messages({ 'number.base': 'Patient ID is required' }),
  doctor_id:        Joi.number().optional(),
  appointment_date: Joi.date().required().messages({ 'date.base': 'Appointment date is required' }),
  appointment_time: Joi.string().required().messages({ 'string.empty': 'Appointment time is required' }),
  duration_minutes: Joi.number().optional().default(30),
  reason_for_visit: Joi.string().required().messages({ 'string.empty': 'Reason for visit is required' }),
  notes:            Joi.string().optional(),
  status:           Joi.string().valid('Scheduled','Completed','Cancelled','No-Show','Rescheduled').optional(),
  is_confirmed:     Joi.number().optional().default(0),
});

// ==========================================
// Get All Appointments with Pagination & Filter
// ==========================================
export const getAllAppointments = async (req, res) => {
  try {
    const { page=1, limit=10, status='', doctor_id='', from_date='', to_date='' } = req.query;
    const offset = (page - 1) * limit;
    console.log('📋 Getting appointments...');

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (status)    { whereClause += ' AND status = ?';               params.push(status);    }
    if (doctor_id) { whereClause += ' AND doctor_id = ?';            params.push(doctor_id); }
    if (from_date) { whereClause += ' AND appointment_date >= ?';    params.push(from_date); }
    if (to_date)   { whereClause += ' AND appointment_date <= ?';    params.push(to_date);   }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM appointments ${whereClause}`, params
    );
    const total = countResult.rows[0]?.total || 0;

    const appointmentsResult = await query(
      `SELECT a.*, p.first_name, p.last_name, p.phone
       FROM appointments a JOIN patients p ON a.patient_id = p.patient_id
       ${whereClause}
       ORDER BY a.appointment_date ASC, a.appointment_time ASC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const appointments = appointmentsResult.rows || [];
    console.log(`✅ Found ${appointments.length} appointments`);
    res.json({
      appointments,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('❌ Error getting appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

// ==========================================
// Get Single Appointment
// ==========================================
export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📅 Getting appointment: ${id}`);
    const result = await query(
      `SELECT a.*, p.first_name, p.last_name, p.email, p.phone
       FROM appointments a JOIN patients p ON a.patient_id = p.patient_id
       WHERE a.appointment_id = ?`, [id]
    );
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    console.log('✅ Appointment found');
    res.json({ appointment: result.rows[0] });
  } catch (error) {
    console.error('❌ Error getting appointment:', error);
    res.status(500).json({ error: 'Failed to fetch appointment' });
  }
};

// ==========================================
// Create Appointment
// ==========================================
export const createAppointment = async (req, res) => {
  try {
    const { error, value } = appointmentSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }

    console.log(`➕ Creating appointment...`);
    const {
      patient_id, doctor_id, appointment_date, appointment_time,
      duration_minutes, reason_for_visit, notes, status, is_confirmed,
    } = value;

    // Conflict check
    const conflictResult = await query(
      `SELECT COUNT(*) as count FROM appointments
       WHERE patient_id=? AND appointment_date=?
         AND (
           (appointment_time < TIME(?) AND TIME(DATE(appointment_time, '+' || duration_minutes || ' minutes')) > TIME(?)) OR
           (appointment_time = ?)
         )
         AND status != 'Cancelled'`,
      [patient_id, appointment_date, appointment_time, appointment_time, appointment_time]
    );
    if (conflictResult.rows[0].count > 0) {
      console.log('❌ Appointment conflict detected');
      return res.status(400).json({ error: 'Patient already has an appointment at this time' });
    }

    const result = await query(
      `INSERT INTO appointments (
        patient_id, doctor_id, appointment_date, appointment_time,
        duration_minutes, reason_for_visit, notes, status, is_confirmed, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patient_id, doctor_id || null, appointment_date, appointment_time,
        duration_minutes || 30, reason_for_visit, notes || null,
        status || 'Scheduled', is_confirmed || 0, req.user.user_id,
      ]
    );
    console.log(`✅ Appointment created: ID ${result.lastID}`);

    // ── Fire-and-forget: send appointment reminder ────────────────────────────
    ;(async () => {
      try {
        const patResult = await query(
          'SELECT first_name, last_name, phone, email FROM patients WHERE patient_id = ?',
          [patient_id]
        );
        const patient = patResult.rows?.[0];
        if (!patient) return;

        let doctorName = 'your doctor';
        if (doctor_id) {
          const docResult = await query('SELECT full_name FROM users WHERE user_id = ?', [doctor_id]);
          doctorName = docResult.rows?.[0]?.full_name || doctorName;
        }

        await sendAppointmentReminder({
          patientName:     `${patient.first_name} ${patient.last_name}`,
          patientPhone:    patient.phone,
          patientEmail:    patient.email,
          doctorName,
          appointmentDate: appointment_date,
          appointmentTime: appointment_time,
        });

        await logNotification(query, {
          patient_id,
          type:        'appointment_reminder',
          channel:     patient.phone && patient.email ? 'both' : patient.phone ? 'sms' : 'email',
          recipient:   patient.phone || patient.email,
          body:        `Appointment reminder for ${appointment_date} at ${appointment_time}`,
          status:      'sent',
          reference_id:String(result.lastID),
        });
      } catch (notifErr) {
        console.warn('Appointment reminder failed (non-critical):', notifErr.message);
      }
    })();

    res.status(201).json({
      message:        'Appointment created successfully',
      appointment_id: result.lastID,
    });
  } catch (error) {
    console.error('❌ Error creating appointment:', error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
};

// ==========================================
// Update Appointment
// ==========================================
export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = appointmentSchema.validate(req.body);
    if (error) {
      console.log('❌ Validation error:', error.message);
      return res.status(400).json({ error: error.message });
    }
    console.log(`✏️ Updating appointment: ${id}`);

    const existing = await query('SELECT appointment_id FROM appointments WHERE appointment_id = ?', [id]);
    if (!existing.rows || existing.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const {
      patient_id, doctor_id, appointment_date, appointment_time,
      duration_minutes, reason_for_visit, notes, status, is_confirmed,
    } = value;

    await query(
      `UPDATE appointments SET
        patient_id=?, doctor_id=?, appointment_date=?,
        appointment_time=?, duration_minutes=?, reason_for_visit=?,
        notes=?, status=?, is_confirmed=?,
        updated_by=?, updated_at=CURRENT_TIMESTAMP
       WHERE appointment_id=?`,
      [
        patient_id, doctor_id || null, appointment_date,
        appointment_time, duration_minutes || 30, reason_for_visit,
        notes || null, status || 'Scheduled', is_confirmed || 0,
        req.user.user_id, id,
      ]
    );

    console.log(`✅ Appointment updated: ${id}`);
    res.json({ message: 'Appointment updated successfully', appointment_id: id });
  } catch (error) {
    console.error('❌ Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
};

// ==========================================
// Cancel/Delete Appointment
// ==========================================
export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🗑️ Deleting appointment: ${id}`);
    const result = await query(
      `UPDATE appointments SET status='Cancelled', updated_by=?, updated_at=CURRENT_TIMESTAMP WHERE appointment_id=?`,
      [req.user.user_id, id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Appointment not found' });
    console.log(`✅ Appointment cancelled: ${id}`);
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('❌ Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
};

// ==========================================
// Get Appointments by Patient
// ==========================================
export const getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status='', upcoming=true } = req.query;
    console.log(`📅 Getting appointments for patient: ${patientId}`);

    let whereClause = 'WHERE a.patient_id = ?';
    let params = [patientId];
    if (status)   { whereClause += ' AND a.status = ?';                    params.push(status); }
    if (upcoming) { whereClause += ' AND a.appointment_date >= date("now")'; }

    const result = await query(
      `SELECT a.*, p.first_name, p.last_name
       FROM appointments a JOIN patients p ON a.patient_id = p.patient_id
       ${whereClause} ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
      params
    );
    const appointments = result.rows || [];
    console.log(`✅ Found ${appointments.length} appointments`);
    res.json({ appointments });
  } catch (error) {
    console.error('❌ Error getting patient appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
};

// ==========================================
// Get Doctor Availability/Calendar
// ==========================================
export const getDoctorAvailability = async (req, res) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) return res.status(400).json({ error: 'Doctor ID and date are required' });
    console.log(`📅 Getting availability for doctor ${doctorId} on ${date}`);

    const result = await query(
      `SELECT appointment_time, duration_minutes FROM appointments
       WHERE doctor_id=? AND appointment_date=? AND status IN ('Scheduled','Completed')
       ORDER BY appointment_time ASC`,
      [doctorId, date]
    );
    const bookedSlots = result.rows || [];

    const availableSlots = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
        const isBooked = bookedSlots.some(slot => {
          const slotEnd = new Date(`2000-01-01 ${slot.appointment_time}`);
          slotEnd.setMinutes(slotEnd.getMinutes() + slot.duration_minutes);
          const checkTime = new Date(`2000-01-01 ${timeStr}`);
          return checkTime >= new Date(`2000-01-01 ${slot.appointment_time}`) && checkTime < slotEnd;
        });
        if (!isBooked) availableSlots.push(timeStr);
      }
    }

    console.log(`✅ Found ${availableSlots.length} available slots`);
    res.json({ date, doctor_id: doctorId, available_slots: availableSlots, booked_slots: bookedSlots.map(s => s.appointment_time) });
  } catch (error) {
    console.error('❌ Error getting availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
};

// ==========================================
// Get Appointments Statistics
// ==========================================
export const getAppointmentStats = async (req, res) => {
  try {
    console.log('📊 Getting appointment statistics');
    const [total, scheduled, completed, cancelled, noShow] = await Promise.all([
      query('SELECT COUNT(*) as total FROM appointments WHERE status != "Cancelled"'),
      query('SELECT COUNT(*) as total FROM appointments WHERE status="Scheduled" AND appointment_date>=date("now")'),
      query('SELECT COUNT(*) as total FROM appointments WHERE status="Completed"'),
      query('SELECT COUNT(*) as total FROM appointments WHERE status="Cancelled"'),
      query('SELECT COUNT(*) as total FROM appointments WHERE status="No-Show"'),
    ]);

    const stats = {
      total:     total.rows[0]?.total     || 0,
      scheduled: scheduled.rows[0]?.total || 0,
      completed: completed.rows[0]?.total || 0,
      cancelled: cancelled.rows[0]?.total || 0,
      no_show:   noShow.rows[0]?.total    || 0,
    };
    console.log('✅ Statistics retrieved:', stats);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};