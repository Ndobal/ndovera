import crypto from 'crypto';

import type { User } from '../../../rbac.js';
import { loadIdentityState } from '../../../../../identity-state.js';
import { ensureSqlSchema, executeSql, queryFirstSql, queryRowsSql } from '../../common/runtimeSqlStore.js';

type OrderStatus = 'Awaiting supply' | 'Pending payment' | 'Payment sent' | 'Paid';

type ProductRow = {
  id: string;
  school_id: string;
  name: string;
  category: string;
  image_url: string | null;
  price_naira: number;
  stock_quantity: number;
  updated_at: string;
};

type PaymentAccountRow = {
  id: string;
  school_id: string;
  method: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  aura_wallet_id: string;
  instructions: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  school_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  amount_naira: number;
  payment_method: string;
  status: OrderStatus;
  created_by_user_id: string;
  student_user_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type SaleRow = {
  id: string;
  school_id: string;
  buyer_user_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_naira: number;
  total_naira: number;
  amount_paid_naira: number;
  balance_naira: number;
  payment_source: string;
  note: string | null;
  status: string;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
};

type InstallmentRow = {
  id: string;
  school_id: string;
  sale_id: string;
  amount_paid_naira: number;
  note: string | null;
  created_at: string;
};

type BlockRow = {
  id: string;
  school_id: string;
  student_user_id: string;
  product_id: string;
  blocked: number | boolean;
  reason: string | null;
  updated_at: string;
};

const SCHEMA_KEY = 'tuckshop-v1';
const MANAGER_ROLES = new Set(['tuckshop manager', 'school admin', 'hos', 'owner', 'tenant school owner', 'super admin']);
const STAFF_ROLES = new Set(['teacher', 'class teacher', 'hod', 'principal', 'head teacher', 'nursery head', 'librarian', 'accountant', 'staff']);
const ORDER_STATUSES = new Set<OrderStatus>(['Awaiting supply', 'Pending payment', 'Payment sent', 'Paid']);
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tuckshop_products (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    price_naira REAL NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tuckshop_payment_accounts (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    method TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    aura_wallet_id TEXT NOT NULL,
    instructions TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (school_id, method)
  )`,
  `CREATE TABLE IF NOT EXISTS tuckshop_orders (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    amount_naira REAL NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL,
    status TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    student_user_id TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tuckshop_sales (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    buyer_user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_naira REAL NOT NULL DEFAULT 0,
    total_naira REAL NOT NULL DEFAULT 0,
    amount_paid_naira REAL NOT NULL DEFAULT 0,
    balance_naira REAL NOT NULL DEFAULT 0,
    payment_source TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tuckshop_installments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    sale_id TEXT NOT NULL,
    amount_paid_naira REAL NOT NULL DEFAULT 0,
    note TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS tuckshop_purchase_blocks (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    blocked BOOLEAN NOT NULL,
    reason TEXT,
    updated_at TEXT NOT NULL,
    UNIQUE (school_id, student_user_id, product_id)
  )`,
  `CREATE TABLE IF NOT EXISTS tuckshop_audit_logs (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    actor_user_id TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
];

function nowIso() {
  return new Date().toISOString();
}

function schoolIdFor(user: User) {
  return String(user.school_id || 'school-1').trim() || 'school-1';
}

function roleForUser(user: User) {
  return String(user.activeRole || user.roles?.[0] || '').trim();
}

function isManager(user: User) {
  return MANAGER_ROLES.has(roleForUser(user).toLowerCase());
}

function isParent(user: User) {
  return roleForUser(user).toLowerCase() === 'parent';
}

function isStudent(user: User) {
  return roleForUser(user).toLowerCase() === 'student';
}

function isStaff(user: User) {
  return STAFF_ROLES.has(roleForUser(user).toLowerCase());
}

function formatNaira(value: number) {
  return `₦${Math.max(0, Number(value || 0)).toLocaleString()}`;
}

function parseOrderStatus(value: unknown): OrderStatus {
  const next = String(value || '').trim() as OrderStatus;
  return ORDER_STATUSES.has(next) ? next : 'Awaiting supply';
}

async function ensureSchema() {
  await ensureSqlSchema(SCHEMA_KEY, SCHEMA);
}

async function logAudit(schoolId: string, actorUserId: string | null, message: string) {
  await executeSql(
    `INSERT INTO tuckshop_audit_logs (id, school_id, actor_user_id, message, created_at) VALUES (?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), schoolId, actorUserId, message, nowIso()],
  );
}

async function seedDefaults(schoolId: string) {
  const existing = await queryFirstSql<{ count: number }>(`SELECT COUNT(*) as count FROM tuckshop_products WHERE school_id = ?`, [schoolId]);
  if (Number(existing?.count || 0) > 0) return;

  const defaultProducts = [
    { id: 'ITM-001', name: 'Bottled Water', category: 'Drinks', priceNaira: 200, stockQuantity: 150 },
    { id: 'ITM-002', name: 'Fruit Juice', category: 'Drinks', priceNaira: 500, stockQuantity: 12 },
    { id: 'ITM-003', name: 'Snack Pack', category: 'Food', priceNaira: 350, stockQuantity: 85 },
    { id: 'ITM-004', name: 'Exercise Book', category: 'Stationery', priceNaira: 700, stockQuantity: 44 },
  ];

  for (const product of defaultProducts) {
    await executeSql(
      `INSERT INTO tuckshop_products (id, school_id, name, category, image_url, price_naira, stock_quantity, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [product.id, schoolId, product.name, product.category, null, product.priceNaira, product.stockQuantity, nowIso()],
    );
  }
}

function mapProduct(row: ProductRow, blocked = false, reason?: string | null) {
  const status = Number(row.stock_quantity || 0) > 20 ? 'In Stock' : Number(row.stock_quantity || 0) > 0 ? 'Low Stock' : 'Out of Stock';
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    imageUrl: row.image_url || undefined,
    price: formatNaira(Number(row.price_naira || 0)),
    stock: `${Number(row.stock_quantity || 0)} Units`,
    status,
    isBlocked: blocked,
    blockReason: reason || undefined,
  };
}

function getRoleFlags(user: User) {
  return {
    role: roleForUser(user) || null,
    isManager: isManager(user),
    isOversight: ['hos', 'owner', 'ami'].includes(roleForUser(user).toLowerCase()),
    isParent: isParent(user),
    isStudent: isStudent(user),
    isStaff: isStaff(user),
  };
}

function mapOrderForView(row: OrderRow, target: string) {
  return {
    id: row.id,
    date: row.created_at,
    item: row.product_name,
    quantity: Number(row.quantity || 0),
    amount: formatNaira(Number(row.amount_naira || 0)),
    paymentMethod: row.payment_method,
    status: row.status,
    target,
    note: row.note || '',
  };
}

function mapTransactionFromSale(row: SaleRow, childLabel: string) {
  return {
    id: row.id,
    item: row.product_name,
    quantity: Number(row.quantity || 0),
    date: row.created_at,
    amount: formatNaira(Number(row.total_naira || 0)),
    method: row.payment_source,
    child: childLabel,
  };
}

function fullNameFromUser(entry: { name?: string | null; first_name?: string | null; last_name?: string | null; id?: string }) {
  const joined = `${String(entry.first_name || '').trim()} ${String(entry.last_name || '').trim()}`.trim();
  return joined || String(entry.name || '').trim() || String(entry.id || 'Unknown');
}

async function listPeopleForSchool(user: User) {
  const state = await loadIdentityState();
  const schoolId = schoolIdFor(user);
  const users = state.users.filter((entry) => entry.schoolId === schoolId && entry.status === 'active');
  const students = state.students.filter((entry) => entry.schoolId === schoolId && entry.status !== 'transferred');

  const buyers = [
    ...students.map((student) => ({ id: student.userId, name: student.name, role: 'Student' })),
    ...users
      .filter((entry) => entry.category === 'staff' || entry.category === 'admin')
      .map((entry) => ({ id: entry.id, name: entry.name, role: entry.activeRole || entry.roles[0] || 'Staff' })),
  ];

  const parents = users.filter((entry) => entry.category === 'parent');
  const parentChildrenMap = new Map<string, Array<{ id: string; name: string }>>();
  for (const parent of parents) {
    const children = students
      .filter((student) => student.parentUserIds.includes(parent.id))
      .map((student) => ({ id: student.userId, name: student.name }));
    parentChildrenMap.set(parent.id, children);
  }

  const userNames = new Map<string, string>();
  for (const person of users) userNames.set(person.id, person.name);
  for (const student of students) userNames.set(student.userId, student.name);

  return { buyers, parents, parentChildrenMap, userNames };
}

export async function getTuckshopDashboard(user: User) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  await seedDefaults(schoolId);

  const { buyers, parentChildrenMap, userNames } = await listPeopleForSchool(user);
  const roleFlags = getRoleFlags(user);
  const selectedChildren = parentChildrenMap.get(user.id) || [];

  const productRows = await queryRowsSql<ProductRow>(`SELECT * FROM tuckshop_products WHERE school_id = ? ORDER BY name`, [schoolId]);
  const blockRows = await queryRowsSql<BlockRow>(`SELECT * FROM tuckshop_purchase_blocks WHERE school_id = ?`, [schoolId]);
  const accountRows = await queryRowsSql<PaymentAccountRow>(`SELECT * FROM tuckshop_payment_accounts WHERE school_id = ? ORDER BY method`, [schoolId]);

  const orders = await queryRowsSql<OrderRow>(`SELECT * FROM tuckshop_orders WHERE school_id = ? ORDER BY created_at DESC`, [schoolId]);
  const sales = await queryRowsSql<SaleRow>(`SELECT * FROM tuckshop_sales WHERE school_id = ? ORDER BY created_at DESC`, [schoolId]);
  const installments = await queryRowsSql<InstallmentRow>(`SELECT * FROM tuckshop_installments WHERE school_id = ? ORDER BY created_at DESC`, [schoolId]);
  const audit = await queryRowsSql<{ message: string; created_at: string }>(
    `SELECT message, created_at FROM tuckshop_audit_logs WHERE school_id = ? ORDER BY created_at DESC LIMIT 20`,
    [schoolId],
  );

  const childFilterSet = new Set(selectedChildren.map((entry) => entry.id));
  const orderVisible = roleFlags.isManager
    ? orders
    : roleFlags.isParent
      ? orders.filter((order) => order.student_user_id && childFilterSet.has(order.student_user_id))
      : roleFlags.isStudent
        ? orders.filter((order) => order.student_user_id === user.id || order.created_by_user_id === user.id)
        : roleFlags.isStaff
          ? orders.filter((order) => order.created_by_user_id === user.id)
          : orders;

  const saleVisible = roleFlags.isManager
    ? sales
    : roleFlags.isParent
      ? sales.filter((sale) => childFilterSet.has(sale.buyer_user_id))
      : sales.filter((sale) => sale.buyer_user_id === user.id);

  const products = productRows.map((product) => {
    const matchingBlock = roleFlags.isParent
      ? blockRows.find((block) => childFilterSet.has(block.student_user_id) && block.product_id === product.id && Boolean(block.blocked))
      : roleFlags.isStudent
        ? blockRows.find((block) => block.student_user_id === user.id && block.product_id === product.id && Boolean(block.blocked))
        : null;
    return mapProduct(product, Boolean(matchingBlock), matchingBlock?.reason || null);
  });

  const transactionItems = saleVisible.map((sale) => {
    const childLabel = userNames.get(sale.buyer_user_id) || 'Self';
    return mapTransactionFromSale(sale, childLabel);
  });

  const balanceOwn = saleVisible.reduce((sum, sale) => sum + Number(sale.balance_naira || 0), 0);
  const balanceOthers = sales.reduce((sum, sale) => sum + Number(sale.balance_naira || 0), 0);
  const totalWalletLike = saleVisible.reduce((sum, sale) => sum + Number(sale.amount_paid_naira || 0), 0);

  const debtByBuyer = new Map<string, number>();
  for (const sale of sales) {
    const next = Number(sale.balance_naira || 0);
    if (next <= 0) continue;
    debtByBuyer.set(sale.buyer_user_id, (debtByBuyer.get(sale.buyer_user_id) || 0) + next);
  }

  const debtors = [...debtByBuyer.entries()].map(([buyerUserId, total], index) => ({
    id: `DB-${String(index + 1).padStart(2, '0')}`,
    userId: buyerUserId,
    name: userNames.get(buyerUserId) || buyerUserId,
    type: 'User',
    balance: formatNaira(total),
    plan: total > 0 ? 'Installment in progress' : 'Cleared',
    status: total > 0 ? 'Active' : 'Cleared',
  }));

  const installmentsBySale = new Map<string, number>();
  for (const installment of installments) {
    installmentsBySale.set(installment.sale_id, (installmentsBySale.get(installment.sale_id) || 0) + Number(installment.amount_paid_naira || 0));
  }

  const installmentOptions = sales
    .filter((sale) => Number(sale.balance_naira || 0) > 0)
    .map((sale) => ({
      id: sale.id,
      label: `${sale.product_name} • ${userNames.get(sale.buyer_user_id) || sale.buyer_user_id}`,
      paymentStatus: sale.status,
      totalAmount: formatNaira(Number(sale.total_naira || 0)),
      amountDue: formatNaira(Number(sale.balance_naira || 0)),
    }));

  const reportDaily = [
    { period: 'Today', total: formatNaira(sales.filter((sale) => sale.created_at.slice(0, 10) === nowIso().slice(0, 10)).reduce((sum, sale) => sum + Number(sale.total_naira || 0), 0)) },
  ];

  const orderItems = orderVisible.map((order) => mapOrderForView(order, userNames.get(order.student_user_id || '') || userNames.get(order.created_by_user_id) || 'Self'));

  return {
    roleState: roleFlags,
    accountCards: [
      { label: 'Wallet Balance', value: formatNaira(totalWalletLike), tone: 'wallet' },
      { label: 'Credit Balance', value: formatNaira(balanceOwn), tone: 'credit' },
      { label: 'Pending Orders', value: String(orderItems.filter((order) => order.status !== 'Paid').length), tone: 'receipt' },
      { label: 'Audit Logs', value: String(audit.length), tone: 'audit' },
    ],
    paymentInstructions: accountRows.length
      ? accountRows.map((row) => `${row.method}: ${row.instructions}`)
      : ['Manager has not configured payment details yet.'],
    balances: {
      walletBalanceNaira: totalWalletLike,
      creditBalanceNaira: balanceOwn,
      spendingLimitNaira: 2500,
    },
    debtOverview: {
      ownOweNaira: balanceOwn,
      othersOweNaira: Math.max(0, balanceOthers - balanceOwn),
    },
    transactions: transactionItems,
    transactionLedger: transactionItems.map((entry, index) => ({
      sn: index + 1,
      date: entry.date,
      description: `${entry.item} x${entry.quantity}`,
      amount: entry.amount,
    })),
    periodTotals: {
      daily: reportDaily,
      weekly: [],
      monthly: [],
    },
    products,
    paymentAccounts: accountRows.map((row) => ({
      id: row.id,
      method: row.method,
      accountName: row.account_name,
      accountNumber: row.account_number,
      bankName: row.bank_name,
      auraWalletId: row.aura_wallet_id,
      instructions: row.instructions,
    })),
    buyerOptions: buyers,
    installmentOptions,
    children: selectedChildren,
    purchaseBlocks: blockRows
      .filter((block) => Boolean(block.blocked))
      .map((block) => ({
        studentUserId: block.student_user_id,
        productId: block.product_id,
        productName: productRows.find((product) => product.id === block.product_id)?.name || block.product_id,
        reason: block.reason || 'Blocked by parent instruction.',
      })),
    orders: orderItems,
    debtors,
    reports: [
      { label: 'Daily sales', value: reportDaily[0]?.total || formatNaira(0), note: 'Captured from immutable sales log.' },
      { label: 'Credit exposure', value: formatNaira(balanceOthers), note: 'Outstanding balances for all debtors.' },
      { label: 'Open installments', value: String(installmentOptions.length), note: 'Active debt repayment plans.' },
      { label: 'Payment accounts', value: String(accountRows.length), note: 'Channels available to users.' },
    ],
    auditLogs: audit.map((entry) => `${entry.message} (${entry.created_at})`),
  };
}

export async function getDebtorDetail(user: User, debtorId: string) {
  await ensureSchema();
  const dashboard = await getTuckshopDashboard(user);
  const target = dashboard.debtors.find((debtor) => debtor.id === debtorId || debtor.userId === debtorId);
  if (!target?.userId) throw new Error('Debtor was not found.');

  const schoolId = schoolIdFor(user);
  const sales = await queryRowsSql<SaleRow>(
    `SELECT * FROM tuckshop_sales WHERE school_id = ? AND buyer_user_id = ? ORDER BY created_at DESC`,
    [schoolId, target.userId],
  );
  const installments = await queryRowsSql<InstallmentRow>(
    `SELECT * FROM tuckshop_installments WHERE school_id = ? AND sale_id IN (SELECT id FROM tuckshop_sales WHERE school_id = ? AND buyer_user_id = ?) ORDER BY created_at DESC`,
    [schoolId, schoolId, target.userId],
  );

  return {
    debtor: {
      id: target.id,
      userId: target.userId,
      name: target.name,
      role: target.type,
      outstandingBalance: target.balance,
      repaymentPlan: target.plan,
      status: target.status,
    },
    sales: sales.map((sale) => ({
      id: sale.id,
      item: sale.product_name,
      quantity: Number(sale.quantity || 0),
      total: formatNaira(Number(sale.total_naira || 0)),
      paid: formatNaira(Number(sale.amount_paid_naira || 0)),
      due: formatNaira(Number(sale.balance_naira || 0)),
      method: sale.payment_source,
      status: sale.status,
      date: sale.created_at,
      note: sale.note || '',
    })),
    installments: installments.map((entry) => ({
      id: entry.id,
      saleId: entry.sale_id,
      item: sales.find((sale) => sale.id === entry.sale_id)?.product_name || entry.sale_id,
      amount: formatNaira(Number(entry.amount_paid_naira || 0)),
      note: entry.note || '',
      date: entry.created_at,
    })),
  };
}

export async function createOrder(user: User, input: { productId: string; quantity: number; paymentMethod?: string; note?: string; studentUserId?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const productId = String(input.productId || '').trim();
  if (!productId) throw new Error('productId is required.');
  const quantity = Math.max(1, Number(input.quantity || 1));
  const product = await queryFirstSql<ProductRow>(`SELECT * FROM tuckshop_products WHERE school_id = ? AND id = ?`, [schoolId, productId]);
  if (!product) throw new Error('Product not found.');
  const amountNaira = quantity * Number(product.price_naira || 0);
  const orderId = `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  await executeSql(
    `INSERT INTO tuckshop_orders (
      id, school_id, product_id, product_name, quantity, amount_naira, payment_method, status,
      created_by_user_id, student_user_id, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      schoolId,
      product.id,
      product.name,
      quantity,
      amountNaira,
      String(input.paymentMethod || 'Pending selection').trim() || 'Pending selection',
      'Awaiting supply',
      user.id,
      String(input.studentUserId || '').trim() || null,
      String(input.note || '').trim() || null,
      nowIso(),
      nowIso(),
    ],
  );
  await logAudit(schoolId, user.id, `Order ${orderId} created for ${product.name} x${quantity}.`);
  return { id: orderId };
}

export async function upsertPurchaseBlock(user: User, input: { studentUserId: string; productId: string; blocked: boolean; reason?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  await executeSql(
    `INSERT INTO tuckshop_purchase_blocks (id, school_id, student_user_id, product_id, blocked, reason, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (school_id, student_user_id, product_id)
     DO UPDATE SET blocked = excluded.blocked, reason = excluded.reason, updated_at = excluded.updated_at`,
    [
      crypto.randomUUID(),
      schoolId,
      String(input.studentUserId || '').trim(),
      String(input.productId || '').trim(),
      input.blocked ? 1 : 0,
      String(input.reason || '').trim() || null,
      nowIso(),
    ],
  );
  await logAudit(schoolId, user.id, `Purchase block ${input.blocked ? 'enabled' : 'disabled'} for ${input.studentUserId} on ${input.productId}.`);
}

export async function upsertPaymentAccount(user: User, input: { method: string; accountName: string; accountNumber: string; bankName: string; auraWalletId: string; instructions: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const method = String(input.method || '').trim();
  if (!method) throw new Error('method is required.');
  await executeSql(
    `INSERT INTO tuckshop_payment_accounts (
      id, school_id, method, account_name, account_number, bank_name, aura_wallet_id, instructions, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (school_id, method)
    DO UPDATE SET
      account_name = excluded.account_name,
      account_number = excluded.account_number,
      bank_name = excluded.bank_name,
      aura_wallet_id = excluded.aura_wallet_id,
      instructions = excluded.instructions,
      updated_at = excluded.updated_at`,
    [
      crypto.randomUUID(),
      schoolId,
      method,
      String(input.accountName || '').trim(),
      String(input.accountNumber || '').trim(),
      String(input.bankName || '').trim(),
      String(input.auraWalletId || '').trim(),
      String(input.instructions || '').trim(),
      nowIso(),
    ],
  );
  await logAudit(schoolId, user.id, `${method} payment account updated.`);
}

export async function acknowledgePayment(user: User, input: { orderId: string; method: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const orderId = String(input.orderId || '').trim();
  if (!orderId) throw new Error('orderId is required.');
  await executeSql(
    `UPDATE tuckshop_orders
       SET status = ?, payment_method = ?, updated_at = ?
     WHERE school_id = ? AND id = ?`,
    ['Payment sent', String(input.method || '').trim() || 'Bank Transfer', nowIso(), schoolId, orderId],
  );
  await logAudit(schoolId, user.id, `Payment acknowledged for order ${orderId}.`);
}

export async function updateOrderStatus(user: User, orderId: string, status: string) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const safeStatus = parseOrderStatus(status);
  await executeSql(
    `UPDATE tuckshop_orders SET status = ?, updated_at = ? WHERE school_id = ? AND id = ?`,
    [safeStatus, nowIso(), schoolId, String(orderId || '').trim()],
  );
  await logAudit(schoolId, user.id, `Order ${orderId} moved to ${safeStatus}.`);
}

export async function updateProduct(user: User, productId: string, input: { priceNaira?: number; stockQuantity?: number; imageUrl?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const existing = await queryFirstSql<ProductRow>(`SELECT * FROM tuckshop_products WHERE school_id = ? AND id = ?`, [schoolId, productId]);
  if (!existing) throw new Error('Product not found.');
  await executeSql(
    `UPDATE tuckshop_products
       SET price_naira = ?, stock_quantity = ?, image_url = ?, updated_at = ?
     WHERE school_id = ? AND id = ?`,
    [
      Number.isFinite(Number(input.priceNaira)) ? Number(input.priceNaira) : Number(existing.price_naira || 0),
      Number.isFinite(Number(input.stockQuantity)) ? Number(input.stockQuantity) : Number(existing.stock_quantity || 0),
      String(input.imageUrl || '').trim() || null,
      nowIso(),
      schoolId,
      productId,
    ],
  );
  await logAudit(schoolId, user.id, `Product ${productId} updated.`);
}

export async function createProduct(user: User, input: { name: string; category?: string; priceNaira?: number; stockQuantity?: number; imageUrl?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('Product name is required.');
  const id = `ITM-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  await executeSql(
    `INSERT INTO tuckshop_products (id, school_id, name, category, image_url, price_naira, stock_quantity, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      schoolId,
      name,
      String(input.category || 'General').trim() || 'General',
      String(input.imageUrl || '').trim() || null,
      Math.max(0, Number(input.priceNaira || 0)),
      Math.max(0, Number(input.stockQuantity || 0)),
      nowIso(),
    ],
  );
  await logAudit(schoolId, user.id, `Product ${name} (${id}) created.`);
  return { id };
}

export async function createSale(user: User, input: { buyerUserId: string; productId: string; quantity: number; unitPriceNaira: number; amountPaidNaira: number; paymentSource?: string; note?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const product = await queryFirstSql<ProductRow>(`SELECT * FROM tuckshop_products WHERE school_id = ? AND id = ?`, [schoolId, input.productId]);
  if (!product) throw new Error('Product not found.');

  const quantity = Math.max(1, Number(input.quantity || 1));
  const unitPrice = Math.max(0, Number(input.unitPriceNaira || product.price_naira || 0));
  const total = quantity * unitPrice;
  const amountPaid = Math.max(0, Math.min(total, Number(input.amountPaidNaira || 0)));
  const balance = Math.max(0, total - amountPaid);
  const status = balance === 0 ? 'Paid' : amountPaid > 0 ? 'Part-paid' : 'On credit';
  const saleId = `SAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  await executeSql(
    `INSERT INTO tuckshop_sales (
      id, school_id, buyer_user_id, product_id, product_name, quantity, unit_price_naira,
      total_naira, amount_paid_naira, balance_naira, payment_source, note, status, created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      saleId,
      schoolId,
      String(input.buyerUserId || '').trim(),
      product.id,
      product.name,
      quantity,
      unitPrice,
      total,
      amountPaid,
      balance,
      String(input.paymentSource || 'Wallet').trim() || 'Wallet',
      String(input.note || '').trim() || null,
      status,
      user.id,
      nowIso(),
      nowIso(),
    ],
  );

  await executeSql(
    `UPDATE tuckshop_products SET stock_quantity = ?, updated_at = ? WHERE school_id = ? AND id = ?`,
    [Math.max(0, Number(product.stock_quantity || 0) - quantity), nowIso(), schoolId, product.id],
  );

  await logAudit(schoolId, user.id, `Sale ${saleId} saved for ${product.name} x${quantity}.`);
  return { id: saleId };
}

export async function recordInstallment(user: User, input: { saleId: string; amountPaidNaira: number; note?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const saleId = String(input.saleId || '').trim();
  const sale = await queryFirstSql<SaleRow>(`SELECT * FROM tuckshop_sales WHERE school_id = ? AND id = ?`, [schoolId, saleId]);
  if (!sale) throw new Error('Sale not found.');

  const payment = Math.max(0, Number(input.amountPaidNaira || 0));
  if (payment <= 0) throw new Error('Installment amount must be greater than zero.');

  const nextPaid = Math.min(Number(sale.total_naira || 0), Number(sale.amount_paid_naira || 0) + payment);
  const nextBalance = Math.max(0, Number(sale.total_naira || 0) - nextPaid);
  const nextStatus = nextBalance === 0 ? 'Paid' : 'Part-paid';

  await executeSql(
    `INSERT INTO tuckshop_installments (id, school_id, sale_id, amount_paid_naira, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), schoolId, saleId, payment, String(input.note || '').trim() || null, nowIso()],
  );

  await executeSql(
    `UPDATE tuckshop_sales
       SET amount_paid_naira = ?, balance_naira = ?, status = ?, updated_at = ?
     WHERE school_id = ? AND id = ?`,
    [nextPaid, nextBalance, nextStatus, nowIso(), schoolId, saleId],
  );

  await logAudit(schoolId, user.id, `Installment of ${formatNaira(payment)} recorded for sale ${saleId}.`);
}
