// ============================================
// supply_chain_migration.mjs
// Run: node supply_chain_migration.mjs  (from backend/)
// ============================================
import { query } from './src/config/database.js';

console.log('📦 Running Supply Chain migration...\n');

// ── suppliers ─────────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name           TEXT NOT NULL,
    contact_person TEXT,
    phone          TEXT,
    email          TEXT,
    address        TEXT,
    supplier_type  TEXT DEFAULT 'Drug'
      CHECK(supplier_type IN ('Drug','Equipment','Consumable','Mixed')),
    payment_terms  TEXT DEFAULT 'Net 30',
    rating         INTEGER DEFAULT 3 CHECK(rating BETWEEN 1 AND 5),
    tax_id         TEXT,
    bank_name      TEXT,
    bank_account   TEXT,
    notes          TEXT,
    is_active      INTEGER DEFAULT 1,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ suppliers'))
  .catch(e => console.log('  ⏭  suppliers:', e.message.split('\n')[0]));

// ── purchase_orders ───────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    po_number      TEXT NOT NULL UNIQUE,
    supplier_id    INTEGER NOT NULL REFERENCES suppliers(supplier_id),
    status         TEXT NOT NULL DEFAULT 'Draft'
      CHECK(status IN (
        'Draft','Submitted','Approved','Ordered',
        'Partially Received','Received','Cancelled'
      )),
    order_date     DATE NOT NULL DEFAULT (date('now')),
    expected_date  DATE,
    received_date  DATE,
    subtotal       REAL DEFAULT 0,
    tax_amount     REAL DEFAULT 0,
    discount       REAL DEFAULT 0,
    total_amount   REAL DEFAULT 0,
    amount_paid    REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'Unpaid'
      CHECK(payment_status IN ('Unpaid','Partial','Paid')),
    delivery_address TEXT,
    notes          TEXT,
    approved_by    INTEGER REFERENCES users(user_id),
    approved_at    DATETIME,
    created_by     INTEGER REFERENCES users(user_id),
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ purchase_orders'))
  .catch(e => console.log('  ⏭  purchase_orders:', e.message.split('\n')[0]));

// ── po_items ──────────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS po_items (
    po_item_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    po_id           INTEGER NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    medication_id   INTEGER REFERENCES medication_catalog(medication_id),
    item_name       TEXT NOT NULL,
    quantity_ordered INTEGER NOT NULL DEFAULT 1,
    quantity_received INTEGER DEFAULT 0,
    unit_cost       REAL NOT NULL DEFAULT 0,
    total_cost      REAL NOT NULL DEFAULT 0,
    unit            TEXT,
    notes           TEXT
  )
`).then(() => console.log('  ✅ po_items'))
  .catch(e => console.log('  ⏭  po_items:', e.message.split('\n')[0]));

// ── goods_received ────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS goods_received (
    grn_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_number      TEXT NOT NULL UNIQUE,
    po_id           INTEGER REFERENCES purchase_orders(po_id),
    supplier_id     INTEGER NOT NULL REFERENCES suppliers(supplier_id),
    received_date   DATE NOT NULL DEFAULT (date('now')),
    invoice_number  TEXT,
    invoice_date    DATE,
    invoice_amount  REAL,
    status          TEXT DEFAULT 'Complete'
      CHECK(status IN ('Complete','Partial','Rejected')),
    notes           TEXT,
    received_by     INTEGER REFERENCES users(user_id),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ goods_received'))
  .catch(e => console.log('  ⏭  goods_received:', e.message.split('\n')[0]));

// ── grn_items ─────────────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS grn_items (
    grn_item_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    grn_id          INTEGER NOT NULL REFERENCES goods_received(grn_id) ON DELETE CASCADE,
    po_item_id      INTEGER REFERENCES po_items(po_item_id),
    medication_id   INTEGER REFERENCES medication_catalog(medication_id),
    item_name       TEXT NOT NULL,
    quantity_received INTEGER NOT NULL DEFAULT 0,
    unit_cost       REAL DEFAULT 0,
    batch_number    TEXT,
    expiry_date     DATE,
    storage_location TEXT,
    condition       TEXT DEFAULT 'Good'
      CHECK(condition IN ('Good','Damaged','Expired','Rejected'))
  )
`).then(() => console.log('  ✅ grn_items'))
  .catch(e => console.log('  ⏭  grn_items:', e.message.split('\n')[0]));

// ── stock_movements ───────────────────────────────────────────────────────────
await query(`
  CREATE TABLE IF NOT EXISTS stock_movements (
    movement_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id   INTEGER NOT NULL REFERENCES medication_catalog(medication_id),
    movement_type   TEXT NOT NULL
      CHECK(movement_type IN (
        'Purchase','Dispensed','Adjustment','Expired',
        'Damaged','Return','Transfer'
      )),
    quantity        INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL DEFAULT 0,
    quantity_after  INTEGER NOT NULL DEFAULT 0,
    reference_type  TEXT,
    reference_id    INTEGER,
    batch_number    TEXT,
    expiry_date     DATE,
    unit_cost       REAL,
    notes           TEXT,
    created_by      INTEGER REFERENCES users(user_id),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).then(() => console.log('  ✅ stock_movements'))
  .catch(e => console.log('  ⏭  stock_movements:', e.message.split('\n')[0]));

// ── indexes ───────────────────────────────────────────────────────────────────
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_po_supplier   ON purchase_orders(supplier_id)',
  'CREATE INDEX IF NOT EXISTS idx_po_status     ON purchase_orders(status)',
  'CREATE INDEX IF NOT EXISTS idx_po_date       ON purchase_orders(order_date)',
  'CREATE INDEX IF NOT EXISTS idx_poi_po        ON po_items(po_id)',
  'CREATE INDEX IF NOT EXISTS idx_grn_po        ON goods_received(po_id)',
  'CREATE INDEX IF NOT EXISTS idx_grn_supplier  ON goods_received(supplier_id)',
  'CREATE INDEX IF NOT EXISTS idx_grni_grn      ON grn_items(grn_id)',
  'CREATE INDEX IF NOT EXISTS idx_grni_med      ON grn_items(medication_id)',
  'CREATE INDEX IF NOT EXISTS idx_stkm_med      ON stock_movements(medication_id)',
  'CREATE INDEX IF NOT EXISTS idx_stkm_type     ON stock_movements(movement_type)',
  'CREATE INDEX IF NOT EXISTS idx_stkm_date     ON stock_movements(created_at)',
];
for (const sql of indexes) await query(sql).catch(() => {});
console.log('  ✅ Indexes');

const [s, p, g, m] = await Promise.all([
  query('SELECT COUNT(*) as c FROM suppliers'),
  query('SELECT COUNT(*) as c FROM purchase_orders'),
  query('SELECT COUNT(*) as c FROM goods_received'),
  query('SELECT COUNT(*) as c FROM stock_movements'),
]);
console.log(`\n🎉 Done!`);
console.log(`  suppliers: ${s.rows[0]?.c} · purchase_orders: ${p.rows[0]?.c}`);
console.log(`  goods_received: ${g.rows[0]?.c} · stock_movements: ${m.rows[0]?.c}`);