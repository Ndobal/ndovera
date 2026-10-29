/**
 * Help request validation shared by the future support API route.
 * This module intentionally does not accept client-supplied tenant, user,
 * assignee or status fields. Those must come from verified auth context.
 */
export const HELP_REQUEST_LIMITS = Object.freeze({
  subject: 160,
  description: 4000,
  category: 64,
  page: 240,
});

export type HelpRequestInput = {
  subject: string;
  description: string;
  category?: string;
  page?: string;
};

export type HelpRequestActor = {
  userId: string;
  tenantId: string;
  role: string;
};

export function validateHelpRequestInput(value: unknown): HelpRequestInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid support request.');
  }
  const input = value as Record<string, unknown>;
  const required = (key: 'subject' | 'description') => {
    if (typeof input[key] !== 'string') throw new Error(`A valid ${key} is required.`);
    const result = input[key].trim();
    if (!result || result.length > HELP_REQUEST_LIMITS[key]) throw new Error(`The ${key} must be between 1 and ${HELP_REQUEST_LIMITS[key]} characters.`);
    return result;
  };
  const optional = (key: 'category' | 'page') => {
    if (input[key] == null) return '';
    if (typeof input[key] !== 'string') throw new Error(`Invalid ${key}.`);
    const result = input[key].trim();
    if (result.length > HELP_REQUEST_LIMITS[key]) throw new Error(`The ${key} is too long.`);
    return result;
  };
  const page = optional('page');
  if (page && !/^\/roles\/[a-z-]+(?:\/[a-z0-9/_-]+)*$/i.test(page)) {
    throw new Error('Invalid dashboard page.');
  }
  return {
    subject: required('subject'),
    description: required('description'),
    category: optional('category'),
    page,
  };
}

export function validateHelpActor(actor: HelpRequestActor): HelpRequestActor {
  if (!actor || !actor.userId?.trim() || !actor.tenantId?.trim() || !actor.role?.trim()) {
    throw new Error('Authenticated user and tenant are required.');
  }
  return actor;
}

export type HelpRequestStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export const HELP_REQUEST_STATUSES: readonly HelpRequestStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

export async function ensureHelpRequestTables(db: D1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS help_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    requester_id TEXT NOT NULL,
    requester_role TEXT NOT NULL,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    source_page TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    assigned_to TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_help_requests_tenant_requester
    ON help_requests (tenant_id, requester_id, created_at DESC)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS help_request_events (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_help_request_events_tenant
    ON help_request_events (tenant_id, request_id, created_at)`).run();
}

export async function createHelpRequest(db: D1Database, actor: HelpRequestActor, raw: unknown) {
  const identity = validateHelpActor(actor);
  const request = validateHelpRequestInput(raw);
  const id = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO help_requests
      (id, tenant_id, requester_id, requester_role, subject, description, category, source_page)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, identity.tenantId, identity.userId, identity.role,
        request.subject, request.description, request.category || '', request.page || ''),
    db.prepare(`INSERT INTO help_request_events
      (id, request_id, tenant_id, actor_id, action)
      VALUES (?, ?, ?, ?, 'created')`)
      .bind(eventId, id, identity.tenantId, identity.userId),
  ]);
  return { id, status: 'open' as const };
}

export async function listOwnHelpRequests(db: D1Database, actor: HelpRequestActor) {
  const identity = validateHelpActor(actor);
  return db.prepare(`SELECT id, subject, category, status, created_at, updated_at
    FROM help_requests WHERE tenant_id = ? AND requester_id = ?
    ORDER BY created_at DESC LIMIT 100`)
    .bind(identity.tenantId, identity.userId).all();
}

export async function getOwnHelpRequest(db: D1Database, actor: HelpRequestActor, id: string) {
  const identity = validateHelpActor(actor);
  return db.prepare(`SELECT id, subject, description, category, source_page, status, created_at, updated_at
    FROM help_requests WHERE tenant_id = ? AND requester_id = ? AND id = ? LIMIT 1`)
    .bind(identity.tenantId, identity.userId, id).first();
}

// Platform support staff must use a separately verified platform permission path.
// Tenant help desks are limited to tenant-local school management roles.
const HELP_STAFF_ROLES = new Set(['owner', 'hos']);

export function assertHelpStaffRole(actor: HelpRequestActor) {
  const identity = validateHelpActor(actor);
  if (!HELP_STAFF_ROLES.has(identity.role.toLowerCase())) {
    throw new Error('Not authorised to manage support requests.');
  }
  return identity;
}

export async function listTenantHelpRequests(db: D1Database, actor: HelpRequestActor) {
  const identity = assertHelpStaffRole(actor);
  return db.prepare(`SELECT id, requester_id, requester_role, subject, category, status, assigned_to, created_at, updated_at
    FROM help_requests WHERE tenant_id = ?
    ORDER BY created_at DESC LIMIT 100`)
    .bind(identity.tenantId).all();
}

export async function updateHelpRequestStatus(
  db: D1Database,
  actor: HelpRequestActor,
  requestId: string,
  status: HelpRequestStatus,
  note = '',
) {
  const identity = assertHelpStaffRole(actor);
  if (!HELP_REQUEST_STATUSES.includes(status)) throw new Error('Invalid support status.');
  if (typeof requestId !== 'string' || !requestId.trim()) throw new Error('Request id required.');
  if (typeof note !== 'string' || note.length > 2000) throw new Error('Invalid support note.');
  const existing = await db.prepare(`SELECT id, status FROM help_requests WHERE id = ? AND tenant_id = ?`)
    .bind(requestId, identity.tenantId).first<{ id: string; status: string }>();
  if (!existing) return null;
  if (existing.status === status) return { id: requestId, status };
  if (existing.status === 'closed' && status !== 'open') throw new Error('Closed requests must be reopened before another status change.');
  await db.batch([
    db.prepare(`UPDATE help_requests SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?`).bind(status, requestId, identity.tenantId),
    db.prepare(`INSERT INTO help_request_events
      (id, request_id, tenant_id, actor_id, action, note)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), requestId, identity.tenantId, identity.userId, `status:${status}`, note.trim()),
  ]);
  return { id: requestId, status };
}

export async function listHelpRequestEvents(db: D1Database, actor: HelpRequestActor, requestId: string) {
  const identity = validateHelpActor(actor);
  const request = await db.prepare(`SELECT requester_id FROM help_requests
    WHERE id = ? AND tenant_id = ?`).bind(requestId, identity.tenantId).first<{ requester_id: string }>();
  if (!request || (request.requester_id !== identity.userId && !HELP_STAFF_ROLES.has(identity.role.toLowerCase()))) {
    throw new Error('Support request not found.');
  }
  return db.prepare(`SELECT action, note, created_at FROM help_request_events
    WHERE tenant_id = ? AND request_id = ? ORDER BY created_at ASC LIMIT 200`)
    .bind(identity.tenantId, requestId).all();
}
