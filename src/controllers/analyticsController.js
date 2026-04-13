// ============================================
// analyticsController.js
// File: backend/src/controllers/analyticsController.js
// ============================================
import { query } from '../config/database.js';

const getAll = async (sql, params = []) => {
  const r = await query(sql, params);
  return r.rows || [];
};
const getOne = async (sql, params = []) => {
  const r = await query(sql, params);
  return r.rows?.[0] || {};
};

// ── GET /analytics/overview — KPI summary card data ──────────────────────────
export const getOverview = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);

    const [
      patients, newPatientsThisMonth, newPatientsLastMonth,
      consultationsToday, consultationsThisMonth,
      revenueToday, revenueThisMonth, revenueLastMonth,
      outstanding,
      appointmentsToday, appointmentsThisMonth,
      labOrders, pendingLab,
      activeMaternity,
    ] = await Promise.all([
      getOne(`SELECT COUNT(*) AS total FROM patients`),
      getOne(`SELECT COUNT(*) AS c FROM patients WHERE strftime('%Y-%m', created_at) = ?`, [thisMonth]),
      getOne(`SELECT COUNT(*) AS c FROM patients WHERE strftime('%Y-%m', created_at) = ?`, [lastMonth]),
      getOne(`SELECT COUNT(*) AS c FROM consultations WHERE date(consultation_date) = ?`, [today]),
      getOne(`SELECT COUNT(*) AS c FROM consultations WHERE strftime('%Y-%m', consultation_date) = ?`, [thisMonth]),
      getOne(`SELECT COALESCE(SUM(amount_paid),0) AS r FROM payments WHERE date(payment_date) = ?`, [today]),
      getOne(`SELECT COALESCE(SUM(amount_paid),0) AS r FROM payments WHERE strftime('%Y-%m', payment_date) = ?`, [thisMonth]),
      getOne(`SELECT COALESCE(SUM(amount_paid),0) AS r FROM payments WHERE strftime('%Y-%m', payment_date) = ?`, [lastMonth]),
      getOne(`SELECT COALESCE(SUM(amount_due),0) AS r FROM invoices WHERE status NOT IN ('Paid','Cancelled')`),
      getOne(`SELECT COUNT(*) AS c FROM appointments WHERE date(appointment_date) = ?`, [today]),
      getOne(`SELECT COUNT(*) AS c FROM appointments WHERE strftime('%Y-%m', appointment_date) = ?`, [thisMonth]),
      getOne(`SELECT COUNT(*) AS c FROM lab_orders`),
      getOne(`SELECT COUNT(*) AS c FROM lab_orders WHERE status IN ('Pending','In Progress')`),
      getOne(`SELECT COUNT(*) AS c FROM maternity_cases WHERE status = 'Active'`).catch(() => ({ c: 0 })),
    ]);

    const revGrowth = revenueLastMonth.r > 0
      ? ((revenueThisMonth.r - revenueLastMonth.r) / revenueLastMonth.r * 100).toFixed(1)
      : null;
    const ptGrowth = newPatientsLastMonth.c > 0
      ? ((newPatientsThisMonth.c - newPatientsLastMonth.c) / newPatientsLastMonth.c * 100).toFixed(1)
      : null;

    res.json({
      patients:           { total: patients.total, new_this_month: newPatientsThisMonth.c, growth_pct: ptGrowth },
      consultations:      { today: consultationsToday.c, this_month: consultationsThisMonth.c },
      revenue:            { today: revenueToday.r, this_month: revenueThisMonth.r, last_month: revenueLastMonth.r, growth_pct: revGrowth, outstanding: outstanding.r },
      appointments:       { today: appointmentsToday.c, this_month: appointmentsThisMonth.c },
      lab:                { total: labOrders.c, pending: pendingLab.c },
      maternity:          { active: activeMaternity.c },
    });
  } catch (err) {
    console.error('getOverview:', err);
    res.status(500).json({ error: 'Failed to fetch overview' });
  }
};

// ── GET /analytics/revenue — Monthly revenue trend ───────────────────────────
export const getRevenueTrend = async (req, res) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear(), months = 12 } = req.query;
    let groupBy, dateLabel;
    if (period === 'daily') {
      groupBy   = `strftime('%Y-%m-%d', payment_date)`;
      dateLabel = `strftime('%d %b', payment_date)`;
    } else if (period === 'weekly') {
      groupBy   = `strftime('%Y-%W', payment_date)`;
      dateLabel = `'Wk ' || strftime('%W', payment_date)`;
    } else {
      groupBy   = `strftime('%Y-%m', payment_date)`;
      dateLabel = `strftime('%m/%Y', payment_date)`;
    }

    const rows = await getAll(
      `SELECT ${groupBy} AS period, ${dateLabel} AS label,
              ROUND(SUM(amount_paid), 2) AS revenue,
              COUNT(*) AS payment_count
       FROM payments
       WHERE strftime('%Y', payment_date) = ?
       GROUP BY ${groupBy}
       ORDER BY period ASC
       LIMIT ?`,
      [String(year), parseInt(months)]
    );

    const summary = await getOne(
      `SELECT ROUND(SUM(amount_paid),2) AS total,
              COUNT(*) AS payments,
              ROUND(AVG(amount_paid),2) AS avg_payment,
              MAX(amount_paid) AS largest_payment
       FROM payments WHERE strftime('%Y', payment_date) = ?`,
      [String(year)]
    );

    res.json({ trend: rows, summary, period, year });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch revenue trend' });
  }
};

// ── GET /analytics/patients — Patient demographics and growth ─────────────────
export const getPatientAnalytics = async (req, res) => {
  try {
    const [
      byGender, byBloodGroup, byAgeGroup,
      growthByMonth, topLGAs,
    ] = await Promise.all([
      getAll(`SELECT gender, COUNT(*) AS count FROM patients WHERE gender IS NOT NULL GROUP BY gender ORDER BY count DESC`),
      getAll(`SELECT blood_type, COUNT(*) AS count FROM patients WHERE blood_type IS NOT NULL GROUP BY blood_type ORDER BY count DESC`),
      getAll(`
        SELECT
          CASE
            WHEN CAST(julianday('now') - julianday(date_of_birth) AS INTEGER)/365 < 5   THEN '0-4'
            WHEN CAST(julianday('now') - julianday(date_of_birth) AS INTEGER)/365 < 18  THEN '5-17'
            WHEN CAST(julianday('now') - julianday(date_of_birth) AS INTEGER)/365 < 35  THEN '18-34'
            WHEN CAST(julianday('now') - julianday(date_of_birth) AS INTEGER)/365 < 50  THEN '35-49'
            WHEN CAST(julianday('now') - julianday(date_of_birth) AS INTEGER)/365 < 65  THEN '50-64'
            ELSE '65+'
          END AS age_group,
          COUNT(*) AS count
        FROM patients WHERE date_of_birth IS NOT NULL
        GROUP BY age_group ORDER BY age_group`),
      getAll(`
        SELECT strftime('%Y-%m', created_at) AS month,
               COUNT(*) AS new_patients
        FROM patients
        GROUP BY month ORDER BY month DESC LIMIT 12`),
      getAll(`
        SELECT city, COUNT(*) AS count FROM patients
        WHERE city IS NOT NULL AND city != ''
        GROUP BY city ORDER BY count DESC LIMIT 10`),
    ]);

    res.json({ by_gender: byGender, by_blood_group: byBloodGroup, by_age_group: byAgeGroup, growth: growthByMonth.reverse(), top_lgas: topLGAs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch patient analytics' });
  }
};

// ── GET /analytics/clinical — Disease burden and clinical patterns ─────────────
export const getClinicalAnalytics = async (req, res) => {
  try {
    const { limit = 10, days = 90 } = req.query;
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

    const [
      topDiagnoses, topComplaints,
      consultsByStatus, consultsByDoctor,
      topLabTests, labCompletion,
      avgVisitsPerPatient,
    ] = await Promise.all([
      getAll(`
        SELECT diagnosis, COUNT(*) AS count
        FROM consultations
        WHERE diagnosis IS NOT NULL AND diagnosis != '' AND date(consultation_date) >= ?
        GROUP BY LOWER(TRIM(diagnosis)) ORDER BY count DESC LIMIT ?`,
        [since, parseInt(limit)]),
      getAll(`
        SELECT chief_complaint, COUNT(*) AS count
        FROM consultations
        WHERE chief_complaint IS NOT NULL AND date(consultation_date) >= ?
        GROUP BY LOWER(TRIM(chief_complaint)) ORDER BY count DESC LIMIT ?`,
        [since, parseInt(limit)]),
      getAll(`SELECT status, COUNT(*) AS count FROM consultations GROUP BY status ORDER BY count DESC`),
      getAll(`
        SELECT u.full_name AS doctor, COUNT(c.consultation_id) AS consultations
        FROM consultations c JOIN users u ON c.doctor_id = u.user_id
        WHERE date(c.consultation_date) >= ?
        GROUP BY c.doctor_id ORDER BY consultations DESC LIMIT 10`, [since]),
      getAll(`
        SELECT test_name, COUNT(*) AS orders,
               SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) AS completed
        FROM lab_orders WHERE date(order_date) >= ?
        GROUP BY LOWER(TRIM(test_name)) ORDER BY orders DESC LIMIT ?`,
        [since, parseInt(limit)]),
      getOne(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status='Pending'   THEN 1 ELSE 0 END) AS pending,
          ROUND(SUM(CASE WHEN status='Completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) AS completion_rate
        FROM lab_orders WHERE date(order_date) >= ?`, [since]),
      getOne(`
        SELECT ROUND(AVG(visit_count),1) AS avg
        FROM (SELECT patient_id, COUNT(*) AS visit_count FROM consultations GROUP BY patient_id)`),
    ]);

    res.json({
      top_diagnoses:       topDiagnoses,
      top_complaints:      topComplaints,
      consults_by_status:  consultsByStatus,
      consults_by_doctor:  consultsByDoctor,
      top_lab_tests:       topLabTests,
      lab_completion:      labCompletion,
      avg_visits_per_patient: avgVisitsPerPatient.avg,
      period_days: parseInt(days),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch clinical analytics' });
  }
};

// ── GET /analytics/appointments — Appointment patterns ───────────────────────
export const getAppointmentAnalytics = async (req, res) => {
  try {
    const [byStatus, byDoctor, byMonth, byDayOfWeek, noShowRate] = await Promise.all([
      getAll(`SELECT status, COUNT(*) AS count FROM appointments GROUP BY status ORDER BY count DESC`),
      getAll(`
        SELECT u.full_name AS doctor, COUNT(a.appointment_id) AS count
        FROM appointments a LEFT JOIN users u ON a.doctor_id = u.user_id
        GROUP BY a.doctor_id ORDER BY count DESC LIMIT 10`),
      getAll(`
        SELECT strftime('%Y-%m', appointment_date) AS month, COUNT(*) AS count
        FROM appointments GROUP BY month ORDER BY month DESC LIMIT 12`),
      getAll(`
        SELECT CASE strftime('%w', appointment_date)
          WHEN '0' THEN 'Sun' WHEN '1' THEN 'Mon' WHEN '2' THEN 'Tue'
          WHEN '3' THEN 'Wed' WHEN '4' THEN 'Thu' WHEN '5' THEN 'Fri'
          ELSE 'Sat' END AS day, COUNT(*) AS count
        FROM appointments GROUP BY strftime('%w', appointment_date) ORDER BY strftime('%w', appointment_date)`),
      getOne(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='No Show' THEN 1 ELSE 0 END) AS no_shows,
          ROUND(SUM(CASE WHEN status='No Show' THEN 1 ELSE 0 END)*100.0/COUNT(*),1) AS no_show_rate
        FROM appointments WHERE status NOT IN ('Scheduled')`),
    ]);

    res.json({
      by_status:    byStatus,
      by_doctor:    byDoctor,
      by_month:     byMonth.reverse(),
      by_day:       byDayOfWeek,
      no_show_rate: noShowRate,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointment analytics' });
  }
};

// ── GET /analytics/payment-methods — Payment method breakdown ─────────────────
export const getPaymentMethodBreakdown = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const params = [];
    let where = '1=1';
    if (start_date) { where += ' AND payment_date >= ?'; params.push(start_date); }
    if (end_date)   { where += ' AND payment_date <= ?'; params.push(end_date); }

    const [byMethod, topPatients, dailyTrend] = await Promise.all([
      getAll(`
        SELECT payment_method,
               COUNT(*) AS count,
               ROUND(SUM(amount_paid),2) AS total,
               ROUND(SUM(amount_paid)*100.0/(SELECT SUM(amount_paid) FROM payments WHERE ${where}),1) AS pct
        FROM payments WHERE ${where}
        GROUP BY payment_method ORDER BY total DESC`, params),
      getAll(`
        SELECT p.first_name||' '||p.last_name AS name, p.phone,
               COUNT(DISTINCT pay.invoice_id) AS invoices,
               ROUND(SUM(pay.amount_paid),2) AS total_paid
        FROM payments pay
        JOIN invoices i ON pay.invoice_id = i.invoice_id
        JOIN patients p ON i.patient_id = p.patient_id
        WHERE ${where}
        GROUP BY p.patient_id ORDER BY total_paid DESC LIMIT 10`, params),
      getAll(`
        SELECT date(payment_date) AS day, ROUND(SUM(amount_paid),2) AS revenue, COUNT(*) AS payments
        FROM payments WHERE ${where}
        GROUP BY day ORDER BY day DESC LIMIT 30`, params),
    ]);

    res.json({ by_method: byMethod, top_patients: topPatients, daily_trend: dailyTrend.reverse() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment breakdown' });
  }
};

// ── GET /analytics/outstanding — Aged receivables ────────────────────────────
export const getOutstandingReport = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [aging, summary] = await Promise.all([
      getAll(`
        SELECT
          i.invoice_id, i.invoice_number, i.invoice_date, i.due_date,
          i.total_amount, i.amount_paid, i.amount_due, i.status,
          p.first_name||' '||p.last_name AS patient_name, p.phone, p.email,
          CAST(julianday('now') - julianday(COALESCE(i.due_date, i.invoice_date)) AS INTEGER) AS days_overdue,
          CASE
            WHEN julianday('now') - julianday(COALESCE(i.due_date,i.invoice_date)) <= 30  THEN '0-30 days'
            WHEN julianday('now') - julianday(COALESCE(i.due_date,i.invoice_date)) <= 60  THEN '31-60 days'
            WHEN julianday('now') - julianday(COALESCE(i.due_date,i.invoice_date)) <= 90  THEN '61-90 days'
            ELSE '90+ days'
          END AS aging_bucket
        FROM invoices i JOIN patients p ON i.patient_id = p.patient_id
        WHERE i.status NOT IN ('Paid','Cancelled') AND i.amount_due > 0
        ORDER BY days_overdue DESC`),
      getOne(`
        SELECT
          COUNT(*) AS total_invoices,
          ROUND(SUM(amount_due),2) AS total_outstanding,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(COALESCE(due_date,invoice_date))<=30  THEN amount_due ELSE 0 END),2) AS age_0_30,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(COALESCE(due_date,invoice_date)) BETWEEN 31 AND 60 THEN amount_due ELSE 0 END),2) AS age_31_60,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(COALESCE(due_date,invoice_date)) BETWEEN 61 AND 90 THEN amount_due ELSE 0 END),2) AS age_61_90,
          ROUND(SUM(CASE WHEN julianday('now')-julianday(COALESCE(due_date,invoice_date))>90  THEN amount_due ELSE 0 END),2) AS age_90_plus
        FROM invoices WHERE status NOT IN ('Paid','Cancelled') AND amount_due > 0`),
    ]);
    res.json({ aging, summary });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch outstanding report' });
  }
};