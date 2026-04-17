// ============================================
// supplyChainController.js
// File: backend/src/controllers/supplyChainController.js
// ============================================
import { query } from '../config/database.js';

const n      = (v)       => (v === '' || v === undefined) ? null : v;
const today  = ()        => new Date().toISOString().split('T')[0];
const getOne = async (sql, p = []) => (await query(sql, p)).rows?.[0] || null;
const getAll = async (sql, p = []) => (await query(sql, p)).rows || [];

// ── Auto-number generators ────────────────────────────────────────────────────
const nextPONumber = async () => {
  const r = await getOne("SELECT COUNT(*) AS n FROM purchase_orders");
  return `PO-${new Date().getFullYear()}-${String((r?.n || 0) + 1).padStart(4, '0')}`;
};
const nextGRNNumber = async () => {
  const r = await getOne("SELECT COUNT(*) AS n FROM goods_received");
  return `GRN-${new Date().getFullYear()}-${String((r?.n || 0) + 1).padStart(4, '0')}`;
};

// ── Stock movement recorder (called internally) ───────────────────────────────
const recordMovement = async (medicationId, type, qty, refType, refId, extra = {}) => {
  const med = await getOne('SELECT stock_quantity FROM medication_catalog WHERE medication_id = ?', [medicationId]);
  const before = med?.stock_quantity || 0;
  const after  = type === 'Dispensed' || type === 'Expired' || type === 'Damaged'
    ? Math.max(0, before - qty)
    : before + qty;

  await query(
    `INSERT INTO stock_movements
      (medication_id, movement_type, quantity, quantity_before, quantity_after,
       reference_type, reference_id, batch_number, expiry_date, unit_cost, notes, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      medicationId, type, qty, before, after,
      n(refType), n(refId),
      n(extra.batch_number), n(extra.expiry_date),
      n(extra.unit_cost), n(extra.notes), n(extra.created_by),
    ]
  );
  return { before, after };
};

// ═══════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════

export const getAllSuppliers = async (req, res) => {
  try {
    const { search, supplier_type, is_active = 1 } = req.query;
    let where = ['s.is_active = ?'];
    const params = [is_active];
    if (search)        { where.push('(s.name LIKE ? OR s.contact_person LIKE ? OR s.phone LIKE ?)');
                         const q = `%${search}%`; params.push(q, q, q); }
    if (supplier_type) { where.push('s.supplier_type = ?'); params.push(supplier_type); }

    const rows = await getAll(
      `SELECT s.*,
         COUNT(DISTINCT po.po_id)  AS total_orders,
         SUM(po.total_amount)       AS total_spend,
         MAX(po.order_date)         AS last_order_date
       FROM suppliers s
       LEFT JOIN purchase_orders po ON po.supplier_id = s.supplier_id
       WHERE ${where.join(' AND ')}
       GROUP BY s.supplier_id
       ORDER BY s.name ASC`,
      params
    );
    res.json({ suppliers: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getSupplierById = async (req, res) => {
  try {
    const supplier = await getOne('SELECT * FROM suppliers WHERE supplier_id = ?', [req.params.id]);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    const orders = await getAll(
      'SELECT po_id, po_number, status, order_date, total_amount FROM purchase_orders WHERE supplier_id = ? ORDER BY order_date DESC LIMIT 10',
      [req.params.id]
    );
    res.json({ supplier, recent_orders: orders });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const createSupplier = async (req, res) => {
  try {
    const {
      name, contact_person, phone, email, address,
      supplier_type, payment_terms, rating, tax_id,
      bank_name, bank_account, notes,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required' });

    const result = await query(
      `INSERT INTO suppliers
        (name, contact_person, phone, email, address, supplier_type,
         payment_terms, rating, tax_id, bank_name, bank_account, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, n(contact_person), n(phone), n(email), n(address),
       supplier_type || 'Drug', payment_terms || 'Net 30',
       rating || 3, n(tax_id), n(bank_name), n(bank_account), n(notes)]
    );
    res.status(201).json({ message: 'Supplier created', supplier_id: result.lastID });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const s = await getOne('SELECT supplier_id FROM suppliers WHERE supplier_id = ?', [id]);
    if (!s) return res.status(404).json({ error: 'Supplier not found' });
    const {
      name, contact_person, phone, email, address, supplier_type,
      payment_terms, rating, tax_id, bank_name, bank_account, notes, is_active,
    } = req.body;
    await query(
      `UPDATE suppliers SET
        name=COALESCE(?,name), contact_person=COALESCE(?,contact_person),
        phone=COALESCE(?,phone), email=COALESCE(?,email),
        address=COALESCE(?,address), supplier_type=COALESCE(?,supplier_type),
        payment_terms=COALESCE(?,payment_terms), rating=COALESCE(?,rating),
        tax_id=COALESCE(?,tax_id), bank_name=COALESCE(?,bank_name),
        bank_account=COALESCE(?,bank_account), notes=COALESCE(?,notes),
        is_active=COALESCE(?,is_active), updated_at=CURRENT_TIMESTAMP
       WHERE supplier_id=?`,
      [n(name), n(contact_person), n(phone), n(email), n(address),
       n(supplier_type), n(payment_terms), n(rating), n(tax_id),
       n(bank_name), n(bank_account), n(notes), n(is_active), id]
    );
    res.json({ message: 'Supplier updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════

export const getAllPOs = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, supplier_id, start_date, end_date } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    if (status)      { where.push('po.status = ?');           params.push(status);      }
    if (supplier_id) { where.push('po.supplier_id = ?');      params.push(supplier_id); }
    if (start_date)  { where.push('po.order_date >= ?');      params.push(start_date);  }
    if (end_date)    { where.push('po.order_date <= ?');      params.push(end_date);    }

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM purchase_orders po ${w}`, params);
    const rows  = await getAll(
      `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone,
              u.full_name AS created_by_name,
              a.full_name AS approved_by_name,
              COUNT(poi.po_item_id) AS item_count
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.supplier_id
       LEFT JOIN users u ON po.created_by = u.user_id
       LEFT JOIN users a ON po.approved_by = a.user_id
       LEFT JOIN po_items poi ON poi.po_id = po.po_id
       ${w}
       GROUP BY po.po_id
       ORDER BY po.order_date DESC, po.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      purchase_orders: rows,
      pagination: { total: total?.n || 0, page: +page, limit: +limit,
                    totalPages: Math.ceil((total?.n || 0) / limit) },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getPOById = async (req, res) => {
  try {
    const po = await getOne(
      `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone,
              s.email AS supplier_email, s.payment_terms,
              u.full_name AS created_by_name, a.full_name AS approved_by_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.supplier_id
       LEFT JOIN users u ON po.created_by = u.user_id
       LEFT JOIN users a ON po.approved_by = a.user_id
       WHERE po.po_id = ?`,
      [req.params.id]
    );
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    const items = await getAll(
      `SELECT poi.*, mc.generic_name, mc.brand_name, mc.drug_code
       FROM po_items poi
       LEFT JOIN medication_catalog mc ON poi.medication_id = mc.medication_id
       WHERE poi.po_id = ?`,
      [req.params.id]
    );
    const grns = await getAll(
      'SELECT grn_id, grn_number, received_date, status FROM goods_received WHERE po_id = ?',
      [req.params.id]
    );
    res.json({ purchase_order: po, items, goods_received: grns });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const createPO = async (req, res) => {
  try {
    const { supplier_id, expected_date, delivery_address, notes, items } = req.body;
    if (!supplier_id)      return res.status(400).json({ error: 'supplier_id is required' });
    if (!items?.length)    return res.status(400).json({ error: 'At least one item is required' });

    const supplier = await getOne('SELECT supplier_id FROM suppliers WHERE supplier_id = ? AND is_active = 1', [supplier_id]);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const poNumber = await nextPONumber();
    const subtotal = items.reduce((s, i) => s + ((i.quantity_ordered || 1) * (i.unit_cost || 0)), 0);

    const result = await query(
      `INSERT INTO purchase_orders
        (po_number, supplier_id, order_date, expected_date, subtotal,
         total_amount, delivery_address, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [poNumber, supplier_id, today(), n(expected_date),
       subtotal, subtotal, n(delivery_address), n(notes), req.user.user_id]
    );
    const poId = result.lastID;

    for (const item of items) {
      const total = (item.quantity_ordered || 1) * (item.unit_cost || 0);
      await query(
        `INSERT INTO po_items
          (po_id, medication_id, item_name, quantity_ordered, unit_cost, total_cost, unit, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [poId, n(item.medication_id), item.item_name,
         item.quantity_ordered || 1, item.unit_cost || 0, total,
         n(item.unit), n(item.notes)]
      );
    }

    console.log(`✅ PO created: ${poNumber}`);
    res.status(201).json({ message: 'Purchase order created', po_id: poId, po_number: poNumber });
  } catch (err) {
    console.error('createPO error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const updatePOStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const validStatuses = ['Draft','Submitted','Approved','Ordered','Partially Received','Received','Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const po = await getOne('SELECT * FROM purchase_orders WHERE po_id = ?', [id]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    const approvedAt = status === 'Approved' ? new Date().toISOString() : null;
    const approvedBy = status === 'Approved' ? req.user.user_id : null;

    await query(
      `UPDATE purchase_orders SET
        status=?, notes=COALESCE(?,notes),
        approved_by=COALESCE(?,approved_by),
        approved_at=COALESCE(?,approved_at),
        updated_at=CURRENT_TIMESTAMP
       WHERE po_id=?`,
      [status, n(notes), approvedBy, approvedAt, id]
    );
    res.json({ message: `PO status updated to ${status}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const deletePO = async (req, res) => {
  try {
    const po = await getOne('SELECT status FROM purchase_orders WHERE po_id = ?', [req.params.id]);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (!['Draft','Cancelled'].includes(po.status)) {
      return res.status(400).json({ error: 'Only Draft or Cancelled POs can be deleted' });
    }
    await query('DELETE FROM purchase_orders WHERE po_id = ?', [req.params.id]);
    res.json({ message: 'Purchase order deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════
// GOODS RECEIVED (GRN)
// ═══════════════════════════════════════════

export const getAllGRNs = async (req, res) => {
  try {
    const { page = 1, limit = 20, supplier_id, po_id } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    if (supplier_id) { where.push('g.supplier_id = ?'); params.push(supplier_id); }
    if (po_id)       { where.push('g.po_id = ?');       params.push(po_id);       }

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM goods_received g ${w}`, params);
    const rows  = await getAll(
      `SELECT g.*, s.name AS supplier_name, po.po_number,
              u.full_name AS received_by_name
       FROM goods_received g
       JOIN suppliers s ON g.supplier_id = s.supplier_id
       LEFT JOIN purchase_orders po ON g.po_id = po.po_id
       LEFT JOIN users u ON g.received_by = u.user_id
       ${w}
       ORDER BY g.received_date DESC, g.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      grns: rows,
      pagination: { total: total?.n || 0, page: +page, limit: +limit },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const createGRN = async (req, res) => {
  try {
    const {
      po_id, supplier_id, received_date, invoice_number,
      invoice_date, invoice_amount, notes, items,
    } = req.body;

    if (!supplier_id)   return res.status(400).json({ error: 'supplier_id is required' });
    if (!items?.length) return res.status(400).json({ error: 'At least one item is required' });

    const grnNumber = await nextGRNNumber();

    const result = await query(
      `INSERT INTO goods_received
        (grn_number, po_id, supplier_id, received_date, invoice_number,
         invoice_date, invoice_amount, notes, received_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [grnNumber, n(po_id), supplier_id,
       received_date || today(), n(invoice_number),
       n(invoice_date), n(invoice_amount), n(notes), req.user.user_id]
    );
    const grnId = result.lastID;

    // Process each received item → update stock + record movement
    for (const item of items) {
      await query(
        `INSERT INTO grn_items
          (grn_id, po_item_id, medication_id, item_name, quantity_received,
           unit_cost, batch_number, expiry_date, storage_location, condition)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [grnId, n(item.po_item_id), n(item.medication_id), item.item_name,
         item.quantity_received || 0, n(item.unit_cost),
         n(item.batch_number), n(item.expiry_date),
         n(item.storage_location), item.condition || 'Good']
      );

      // Update stock in medication_catalog
      if (item.medication_id && item.quantity_received > 0 && item.condition === 'Good') {
        await query(
          `UPDATE medication_catalog SET
            stock_quantity    = stock_quantity + ?,
            batch_number      = COALESCE(?, batch_number),
            expiry_date       = COALESCE(?, expiry_date),
            supplier_name     = (SELECT name FROM suppliers WHERE supplier_id = ?),
            last_restocked_at = CURRENT_TIMESTAMP,
            updated_at        = CURRENT_TIMESTAMP
           WHERE medication_id = ?`,
          [item.quantity_received, n(item.batch_number),
           n(item.expiry_date), supplier_id, item.medication_id]
        );

        // Update quantity_received on PO item
        if (item.po_item_id) {
          await query(
            'UPDATE po_items SET quantity_received = quantity_received + ? WHERE po_item_id = ?',
            [item.quantity_received, item.po_item_id]
          );
        }

        // Record stock movement
        await recordMovement(
          item.medication_id, 'Purchase', item.quantity_received,
          'GRN', grnId,
          { batch_number: item.batch_number, expiry_date: item.expiry_date,
            unit_cost: item.unit_cost, created_by: req.user.user_id }
        );
      }
    }

    // Update PO status to Received/Partially Received
    if (po_id) {
      const poItems = await getAll(
        'SELECT quantity_ordered, quantity_received FROM po_items WHERE po_id = ?', [po_id]
      );
      const allReceived = poItems.every(i => i.quantity_received >= i.quantity_ordered);
      const anyReceived = poItems.some(i => i.quantity_received > 0);
      const newStatus = allReceived ? 'Received' : anyReceived ? 'Partially Received' : undefined;
      if (newStatus) {
        await query(
          'UPDATE purchase_orders SET status=?, received_date=?, updated_at=CURRENT_TIMESTAMP WHERE po_id=?',
          [newStatus, received_date || today(), po_id]
        );
      }
    }

    console.log(`✅ GRN created: ${grnNumber}`);
    res.status(201).json({ message: 'Goods received successfully', grn_id: grnId, grn_number: grnNumber });
  } catch (err) {
    console.error('createGRN error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ═══════════════════════════════════════════
// STOCK MOVEMENTS
// ═══════════════════════════════════════════

export const getStockMovements = async (req, res) => {
  try {
    const { medication_id, movement_type, page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;
    let where = ['1=1'];
    const params = [];
    if (medication_id)  { where.push('sm.medication_id = ?');   params.push(medication_id);  }
    if (movement_type)  { where.push('sm.movement_type = ?');   params.push(movement_type);  }

    const w = `WHERE ${where.join(' AND ')}`;
    const total = await getOne(`SELECT COUNT(*) AS n FROM stock_movements sm ${w}`, params);
    const rows  = await getAll(
      `SELECT sm.*,
              mc.generic_name, mc.brand_name,
              u.full_name AS created_by_name
       FROM stock_movements sm
       JOIN medication_catalog mc ON sm.medication_id = mc.medication_id
       LEFT JOIN users u ON sm.created_by = u.user_id
       ${w}
       ORDER BY sm.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json({
      movements: rows,
      pagination: { total: total?.n || 0, page: +page, limit: +limit },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const adjustStock = async (req, res) => {
  try {
    const { medication_id, adjustment, reason, notes } = req.body;
    if (!medication_id) return res.status(400).json({ error: 'medication_id is required' });
    if (!adjustment || adjustment === 0) return res.status(400).json({ error: 'adjustment quantity is required' });

    const med = await getOne('SELECT * FROM medication_catalog WHERE medication_id = ?', [medication_id]);
    if (!med) return res.status(404).json({ error: 'Medication not found' });

    const newQty = Math.max(0, (med.stock_quantity || 0) + adjustment);
    await query(
      'UPDATE medication_catalog SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE medication_id = ?',
      [newQty, medication_id]
    );

    await recordMovement(
      medication_id, 'Adjustment', Math.abs(adjustment),
      'Manual', null,
      { notes: `${reason || 'Manual adjustment'}: ${notes || ''}`, created_by: req.user.user_id }
    );

    res.json({
      message:          'Stock adjusted',
      previous_qty:     med.stock_quantity,
      adjustment,
      new_qty:          newQty,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ═══════════════════════════════════════════
// DASHBOARD & STATS
// ═══════════════════════════════════════════

export const getSupplyStats = async (req, res) => {
  try {
    const [poStats, lowStock, expiring, recentGRNs, topSuppliers] = await Promise.all([
      getOne(`
        SELECT
          COUNT(*)                                                              AS total_pos,
          SUM(CASE WHEN status='Draft'    THEN 1 ELSE 0 END)                   AS draft,
          SUM(CASE WHEN status='Approved' THEN 1 ELSE 0 END)                   AS approved,
          SUM(CASE WHEN status='Ordered'  THEN 1 ELSE 0 END)                   AS ordered,
          SUM(CASE WHEN status IN ('Received','Partially Received') THEN 1 ELSE 0 END) AS received,
          SUM(CASE WHEN status='Submitted' THEN 1 ELSE 0 END)                  AS pending_approval,
          SUM(total_amount)                                                     AS total_value
        FROM purchase_orders WHERE status != 'Cancelled'`
      ),
      getAll(`
        SELECT medication_id, generic_name, brand_name, stock_quantity, reorder_level,
               supplier_name
        FROM medication_catalog
        WHERE is_active=1 AND reorder_level > 0 AND stock_quantity <= reorder_level
        ORDER BY stock_quantity ASC LIMIT 10`
      ),
      getAll(`
        SELECT medication_id, generic_name, brand_name, expiry_date, stock_quantity,
               CAST(julianday(expiry_date)-julianday('now') AS INTEGER) AS days_left
        FROM medication_catalog
        WHERE is_active=1 AND expiry_date IS NOT NULL
          AND julianday(expiry_date) - julianday('now') <= 60
          AND julianday(expiry_date) >= julianday('now')
        ORDER BY expiry_date ASC LIMIT 10`
      ),
      getAll(`
        SELECT g.grn_number, g.received_date, s.name AS supplier_name, g.status
        FROM goods_received g JOIN suppliers s ON g.supplier_id=s.supplier_id
        ORDER BY g.received_date DESC LIMIT 5`
      ),
      getAll(`
        SELECT s.supplier_id, s.name, s.rating,
               COUNT(po.po_id) AS order_count,
               SUM(po.total_amount) AS total_spend
        FROM suppliers s LEFT JOIN purchase_orders po ON po.supplier_id=s.supplier_id
        WHERE s.is_active=1
        GROUP BY s.supplier_id ORDER BY total_spend DESC NULLS LAST LIMIT 5`
      ),
    ]);

    res.json({ po_stats: poStats, low_stock: lowStock, expiring_soon: expiring,
               recent_grns: recentGRNs, top_suppliers: topSuppliers });
  } catch (err) { res.status(500).json({ error: err.message }); }
};