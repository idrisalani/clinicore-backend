// ============================================
// schedulingController.js
// File: backend/src/controllers/schedulingController.js
// ============================================
import { query } from '../config/database.js';

const n      = (v)       => (v === '' || v === undefined) ? null : v;
const today  = ()        => new Date().toISOString().split('T')[0];
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ═══════════════════════════════════════════
// SHIFT TEMPLATES
// ═══════════════════════════════════════════

export const getTemplates = async (req, res) => {
  try {
    const rows = await getAll(
      "SELECT * FROM shift_templates WHERE is_active = 1 ORDER BY shift_type, name"
    );
    res.json({ templates: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const createTemplate = async (req, res) => {
  try {
    const { name, shift_type, start_time, end_time, department, color, description } = req.body;
    if (!name || !start_time || !end_time)
      return res.status(400).json({ error: 'name, start_time, end_time are required' });

    // Auto-calc duration
    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins < 0) mins += 1440; // overnight
    const duration_hours = Math.round((mins / 60) * 10) / 10;

    const result = await query(
      `INSERT INTO shift_templates (name, shift_type, start_time, end_time, duration_hours, department, color, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, shift_type || 'Custom', start_time, end_time, duration_hours,
       n(department), color || '#0F6E56', n(description)]
    );
    res.status(201).json({ message: 'Template created', template_id: result.lastID });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════
// SCHEDULES
// ═══════════════════════════════════════════

export const getSchedules = async (req, res) => {
  try {
    const {
      start_date, end_date, user_id, department,
      shift_type, status, week,
    } = req.query;

    // If week param given, compute Mon–Sun
    let sDate = start_date;
    let eDate = end_date;
    if (week) {
      const d = new Date(week);
      const day = d.getDay();
      const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      sDate = mon.toISOString().split('T')[0];
      eDate = sun.toISOString().split('T')[0];
    }

    let where = ['1=1'];
    const params = [];
    if (sDate)      { where.push('ss.schedule_date >= ?'); params.push(sDate);     }
    if (eDate)      { where.push('ss.schedule_date <= ?'); params.push(eDate);     }
    if (user_id)    { where.push('ss.user_id = ?');        params.push(user_id);   }
    if (department) { where.push('ss.department = ?');     params.push(department);}
    if (shift_type) { where.push('ss.shift_type = ?');     params.push(shift_type);}
    if (status)     { where.push('ss.status = ?');         params.push(status);    }

    const rows = await getAll(
      `SELECT ss.*,
              u.full_name, u.role, u.department AS user_department, u.phone,
              t.name AS template_name, t.color
       FROM staff_schedules ss
       JOIN users u ON ss.user_id = u.user_id
       LEFT JOIN shift_templates t ON ss.template_id = t.template_id
       WHERE ${where.join(' AND ')}
       ORDER BY ss.schedule_date ASC, ss.start_time ASC`,
      params
    );
    res.json({ schedules: rows, start_date: sDate, end_date: eDate });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getMySchedule = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const sDate = start_date || today();
    const eDate = end_date   || (() => { const d = new Date(sDate); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })();

    const rows = await getAll(
      `SELECT ss.*, t.name AS template_name, t.color
       FROM staff_schedules ss
       LEFT JOIN shift_templates t ON ss.template_id = t.template_id
       WHERE ss.user_id = ? AND ss.schedule_date BETWEEN ? AND ?
       ORDER BY ss.schedule_date ASC, ss.start_time ASC`,
      [req.user.user_id, sDate, eDate]
    );
    res.json({ schedules: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const createSchedule = async (req, res) => {
  try {
    const {
      user_id, template_id, schedule_date, shift_type,
      start_time, end_time, department, location, notes,
    } = req.body;
    if (!user_id || !schedule_date)
      return res.status(400).json({ error: 'user_id and schedule_date are required' });

    // Pull times from template if not provided
    let sTime = start_time, eTime = end_time, sType = shift_type;
    if (template_id && (!sTime || !eTime)) {
      const tmpl = await getOne('SELECT * FROM shift_templates WHERE template_id = ?', [template_id]);
      if (tmpl) { sTime = sTime || tmpl.start_time; eTime = eTime || tmpl.end_time; sType = sType || tmpl.shift_type; }
    }

    const result = await query(
      `INSERT INTO staff_schedules
        (user_id, template_id, schedule_date, shift_type, start_time, end_time,
         department, location, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)`,
      [user_id, n(template_id), schedule_date, sType || 'Morning',
       n(sTime), n(eTime), n(department), n(location), n(notes), req.user.user_id]
    );
    res.status(201).json({ message: 'Schedule created', schedule_id: result.lastID });
  } catch (err) {
    if (err.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Staff already has a shift at that time on this date' });
    res.status(500).json({ error: err.message });
  }
};

export const bulkCreateSchedule = async (req, res) => {
  try {
    const { schedules } = req.body;
    if (!schedules?.length) return res.status(400).json({ error: 'schedules array is required' });

    let created = 0, skipped = 0;
    for (const s of schedules) {
      try {
        let sTime = s.start_time, eTime = s.end_time, sType = s.shift_type;
        if (s.template_id && (!sTime || !eTime)) {
          const tmpl = await getOne('SELECT * FROM shift_templates WHERE template_id = ?', [s.template_id]);
          if (tmpl) { sTime = sTime || tmpl.start_time; eTime = eTime || tmpl.end_time; sType = sType || tmpl.shift_type; }
        }
        await query(
          `INSERT OR IGNORE INTO staff_schedules
            (user_id, template_id, schedule_date, shift_type, start_time, end_time,
             department, location, notes, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scheduled', ?)`,
          [s.user_id, n(s.template_id), s.schedule_date, sType || 'Morning',
           n(sTime), n(eTime), n(s.department), n(s.location), n(s.notes), req.user.user_id]
        );
        created++;
      } catch { skipped++; }
    }
    res.status(201).json({ message: `Bulk schedule created`, created, skipped });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await getOne('SELECT * FROM staff_schedules WHERE schedule_id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    const { shift_type, start_time, end_time, department, location, status, notes } = req.body;
    await query(
      `UPDATE staff_schedules SET
        shift_type  = COALESCE(?, shift_type),
        start_time  = COALESCE(?, start_time),
        end_time    = COALESCE(?, end_time),
        department  = COALESCE(?, department),
        location    = COALESCE(?, location),
        status      = COALESCE(?, status),
        notes       = COALESCE(?, notes),
        updated_at  = CURRENT_TIMESTAMP
       WHERE schedule_id = ?`,
      [n(shift_type), n(start_time), n(end_time), n(department),
       n(location), n(status), n(notes), id]
    );
    res.json({ message: 'Schedule updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const deleteSchedule = async (req, res) => {
  try {
    const s = await getOne('SELECT * FROM staff_schedules WHERE schedule_id = ?', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Schedule not found' });
    if (s.status === 'Completed') return res.status(400).json({ error: 'Cannot delete a completed shift' });
    await query('DELETE FROM staff_schedules WHERE schedule_id = ?', [req.params.id]);
    res.json({ message: 'Schedule deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const checkIn = async (req, res) => {
  try {
    const s = await getOne('SELECT * FROM staff_schedules WHERE schedule_id = ?', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Schedule not found' });
    if (s.user_id !== req.user.user_id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'You can only check in to your own shifts' });
    await query(
      "UPDATE staff_schedules SET check_in_time=CURRENT_TIMESTAMP, status='Confirmed', updated_at=CURRENT_TIMESTAMP WHERE schedule_id=?",
      [req.params.id]
    );
    res.json({ message: 'Checked in successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const checkOut = async (req, res) => {
  try {
    const s = await getOne('SELECT * FROM staff_schedules WHERE schedule_id = ?', [req.params.id]);
    if (!s) return res.status(404).json({ error: 'Schedule not found' });
    if (s.user_id !== req.user.user_id && req.user.role !== 'admin')
      return res.status(403).json({ error: 'You can only check out of your own shifts' });
    await query(
      "UPDATE staff_schedules SET check_out_time=CURRENT_TIMESTAMP, status='Completed', updated_at=CURRENT_TIMESTAMP WHERE schedule_id=?",
      [req.params.id]
    );
    res.json({ message: 'Checked out successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════
// SHIFT SWAPS
// ═══════════════════════════════════════════

export const getSwapRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const isAdmin = ['admin','doctor'].includes(req.user.role);
    let where = isAdmin ? ['1=1'] : ['(sw.requester_id = ? OR sw.target_id = ?)'];
    const params = isAdmin ? [] : [req.user.user_id, req.user.user_id];
    if (status) { where.push('sw.status = ?'); params.push(status); }

    const rows = await getAll(
      `SELECT sw.*,
              r.full_name AS requester_name, r.role AS requester_role,
              t.full_name AS target_name,    t.role AS target_role,
              rev.full_name AS reviewer_name
       FROM shift_swaps sw
       JOIN users r  ON sw.requester_id = r.user_id
       JOIN users t  ON sw.target_id    = t.user_id
       LEFT JOIN users rev ON sw.reviewed_by = rev.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY sw.created_at DESC`,
      params
    );
    res.json({ swaps: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const requestSwap = async (req, res) => {
  try {
    const { target_id, requester_schedule_id, target_schedule_id, swap_date, reason } = req.body;
    if (!target_id || !swap_date)
      return res.status(400).json({ error: 'target_id and swap_date are required' });

    const result = await query(
      `INSERT INTO shift_swaps (requester_id, target_id, requester_schedule_id, target_schedule_id, swap_date, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.user_id, target_id, n(requester_schedule_id), n(target_schedule_id), swap_date, n(reason)]
    );
    res.status(201).json({ message: 'Swap request submitted', swap_id: result.lastID });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const respondToSwap = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, review_notes } = req.body; // action: 'accept' | 'reject' | 'approve' | 'cancel'
    const swap = await getOne('SELECT * FROM shift_swaps WHERE swap_id = ?', [id]);
    if (!swap) return res.status(404).json({ error: 'Swap request not found' });

    const isAdmin = ['admin'].includes(req.user.role);
    const isTarget = swap.target_id === req.user.user_id;

    let newStatus;
    if (action === 'accept'  && isTarget)  newStatus = 'Accepted';
    if (action === 'reject'  && isTarget)  newStatus = 'Rejected';
    if (action === 'approve' && isAdmin)   newStatus = 'Approved';
    if (action === 'cancel'  && (swap.requester_id === req.user.user_id || isAdmin)) newStatus = 'Cancelled';

    if (!newStatus) return res.status(403).json({ error: 'Not authorised to perform this action' });

    await query(
      `UPDATE shift_swaps SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP, review_notes=?
       WHERE swap_id=?`,
      [newStatus, req.user.user_id, n(review_notes), id]
    );

    // If approved — swap the actual schedule assignments
    if (newStatus === 'Approved' && swap.requester_schedule_id && swap.target_schedule_id) {
      const [rs, ts] = await Promise.all([
        getOne('SELECT user_id FROM staff_schedules WHERE schedule_id = ?', [swap.requester_schedule_id]),
        getOne('SELECT user_id FROM staff_schedules WHERE schedule_id = ?', [swap.target_schedule_id]),
      ]);
      if (rs && ts) {
        await query('UPDATE staff_schedules SET user_id=? WHERE schedule_id=?', [ts.user_id, swap.requester_schedule_id]);
        await query('UPDATE staff_schedules SET user_id=? WHERE schedule_id=?', [rs.user_id, swap.target_schedule_id]);
      }
    }

    res.json({ message: `Swap ${newStatus.toLowerCase()}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════
// LEAVE REQUESTS
// ═══════════════════════════════════════════

export const getLeaveRequests = async (req, res) => {
  try {
    const { status, user_id } = req.query;
    const isAdmin = ['admin'].includes(req.user.role);
    let where = isAdmin ? ['1=1'] : ['lr.user_id = ?'];
    const params = isAdmin ? [] : [req.user.user_id];
    if (status)  { where.push('lr.status = ?');  params.push(status);  }
    if (user_id && isAdmin) { where.push('lr.user_id = ?'); params.push(user_id); }

    const rows = await getAll(
      `SELECT lr.*, u.full_name, u.role AS user_role, u.department,
              rev.full_name AS reviewer_name
       FROM leave_requests lr
       JOIN users u ON lr.user_id = u.user_id
       LEFT JOIN users rev ON lr.reviewed_by = rev.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY lr.created_at DESC`,
      params
    );
    res.json({ leaves: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const requestLeave = async (req, res) => {
  try {
    const { leave_type, start_date, end_date, reason } = req.body;
    if (!start_date || !end_date) return res.status(400).json({ error: 'start_date and end_date are required' });
    if (start_date > end_date)    return res.status(400).json({ error: 'end_date must be on or after start_date' });

    const days = Math.round((new Date(end_date) - new Date(start_date)) / 86400000) + 1;
    const result = await query(
      `INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, days_count, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.user_id, leave_type || 'Annual', start_date, end_date, days, n(reason)]
    );
    res.status(201).json({ message: 'Leave request submitted', leave_id: result.lastID, days_count: days });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const reviewLeave = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;
    if (!['Approved','Rejected'].includes(status)) return res.status(400).json({ error: 'status must be Approved or Rejected' });

    const leave = await getOne('SELECT * FROM leave_requests WHERE leave_id = ?', [id]);
    if (!leave) return res.status(404).json({ error: 'Leave request not found' });
    if (leave.status !== 'Pending') return res.status(400).json({ error: 'Leave request already reviewed' });

    await query(
      `UPDATE leave_requests SET status=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP,
        review_notes=?, updated_at=CURRENT_TIMESTAMP WHERE leave_id=?`,
      [status, req.user.user_id, n(review_notes), id]
    );

    // If approved — mark schedule days as Off/Cancelled
    if (status === 'Approved') {
      await query(
        `UPDATE staff_schedules SET status='Cancelled', notes='On approved leave', updated_at=CURRENT_TIMESTAMP
         WHERE user_id=? AND schedule_date BETWEEN ? AND ?`,
        [leave.user_id, leave.start_date, leave.end_date]
      );
    }

    res.json({ message: `Leave ${status.toLowerCase()}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════
// STATS & OVERVIEW
// ═══════════════════════════════════════════

export const getSchedulingStats = async (req, res) => {
  try {
    const todayStr = today();
    const weekStart = (() => {
      const d = new Date(); const day = d.getDay();
      d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return d.toISOString().split('T')[0];
    })();
    const weekEnd = (() => {
      const d = new Date(weekStart); d.setDate(d.getDate() + 6);
      return d.toISOString().split('T')[0];
    })();

    const [todayShifts, weekStats, pendingLeaves, pendingSwaps, staffOnLeave] = await Promise.all([
      getAll(`
        SELECT ss.*, u.full_name, u.role, t.color
        FROM staff_schedules ss JOIN users u ON ss.user_id=u.user_id
        LEFT JOIN shift_templates t ON ss.template_id=t.template_id
        WHERE ss.schedule_date=? AND ss.status NOT IN ('Cancelled')
        ORDER BY ss.start_time ASC
      `, [todayStr]),
      getOne(`
        SELECT
          COUNT(*)                                                          AS total,
          SUM(CASE WHEN status='Scheduled'  THEN 1 ELSE 0 END)            AS scheduled,
          SUM(CASE WHEN status='Completed'  THEN 1 ELSE 0 END)            AS completed,
          SUM(CASE WHEN status='Absent'     THEN 1 ELSE 0 END)            AS absent,
          SUM(CASE WHEN shift_type='Morning'   THEN 1 ELSE 0 END)         AS morning,
          SUM(CASE WHEN shift_type='Afternoon' THEN 1 ELSE 0 END)         AS afternoon,
          SUM(CASE WHEN shift_type='Night'     THEN 1 ELSE 0 END)         AS night
        FROM staff_schedules
        WHERE schedule_date BETWEEN ? AND ?
      `, [weekStart, weekEnd]),
      getOne("SELECT COUNT(*) AS n FROM leave_requests WHERE status='Pending'"),
      getOne("SELECT COUNT(*) AS n FROM shift_swaps WHERE status='Pending' OR status='Accepted'"),
      getAll(`
        SELECT lr.*, u.full_name, u.department
        FROM leave_requests lr JOIN users u ON lr.user_id=u.user_id
        WHERE lr.status='Approved' AND lr.end_date >= ? AND lr.start_date <= ?
      `, [todayStr, todayStr]),
    ]);

    res.json({
      today_shifts: todayShifts,
      week_stats:   weekStats || {},
      pending_leaves: pendingLeaves?.n || 0,
      pending_swaps:  pendingSwaps?.n  || 0,
      staff_on_leave: staffOnLeave,
      week: { start: weekStart, end: weekEnd },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};