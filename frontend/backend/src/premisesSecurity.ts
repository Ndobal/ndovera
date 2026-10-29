export type PremisesActor = { userId: string; tenantId: string; role: string };
const permitted = new Set(['chiefsecurityofficer','securityofficer','owner','hos']);
const supervisors = new Set(['chiefsecurityofficer','owner','hos']);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const error = (message: string, status: number) => json({ error: message }, status);
const allowedKinds = new Set(['incident','visitor','patrol','handover','gate','hazard']);
const allowedSeverities = new Set(['low','medium','high','critical']);
const allowedStatuses = new Set(['open','investigating','resolved']);
const short = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const valid = (value: unknown) => value && typeof value === 'object' && !Array.isArray(value);
export async function handlePremisesSecurityRoute(request: Request, db: D1Database, actor: PremisesActor | null): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (path !== '/api/premises-security' && !path.startsWith('/api/premises-security/')) return null;
  if (!actor?.tenantId || !actor.userId) return error('Authentication required.', 401);
  if (!permitted.has(actor.role)) return error('Security role required.', 403);
  const isSupervisor = supervisors.has(actor.role);
  if (path === '/api/premises-security/overview' && request.method === 'GET') {
    const [summary, latest, visitors, escalations] = await db.batch([
      db.prepare(`SELECT kind, status, COUNT(*) AS total FROM premises_security_records WHERE tenant_id = ? GROUP BY kind, status`).bind(actor.tenantId),
      db.prepare(`SELECT id, kind, title, location, notes, severity, status, created_at, created_by, checked_out_at, escalated_at, acknowledged_at FROM premises_security_records WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 60`).bind(actor.tenantId),
      db.prepare(`SELECT COUNT(*) AS total FROM premises_security_records WHERE tenant_id = ? AND kind = 'visitor' AND checked_out_at IS NULL`).bind(actor.tenantId),
      db.prepare(`SELECT COUNT(*) AS total FROM premises_security_records WHERE tenant_id = ? AND escalated_at IS NOT NULL AND acknowledged_at IS NULL AND status != 'resolved'`).bind(actor.tenantId),
    ]);
    return json({ summary: summary.results, records: latest.results, supervisor: isSupervisor, activeVisitors: Number((visitors.results?.[0] as any)?.total || 0), pendingEscalations: Number((escalations.results?.[0] as any)?.total || 0) });
  }
  if (path === '/api/premises-security/records' && request.method === 'POST') {
    const raw = await request.text();
    if (raw.length > 12000) return error('Request too large.', 413);
    let input: any;
    try { input = JSON.parse(raw); } catch { return error('Invalid JSON.', 400); }
    if (!valid(input)) return error('Invalid record.', 400);
    const kind = short(input.kind, 30), title = short(input.title, 150);
    const location = short(input.location, 150), notes = short(input.notes, 3000);
    const severity = short(input.severity, 20) || 'low';
    if (!allowedKinds.has(kind) || !title || !location || !allowedSeverities.has(severity)) return error('Kind, title, location and severity are required.', 400);
    const id = crypto.randomUUID(), eventId = crypto.randomUUID();
    await db.batch([
      db.prepare(`INSERT INTO premises_security_records (id, tenant_id, kind, title, location, notes, severity, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`)
        .bind(id, actor.tenantId, kind, title, location, notes, severity, actor.userId),
      db.prepare(`INSERT INTO premises_security_events (id, tenant_id, record_id, actor_id, action, details) VALUES (?, ?, ?, ?, 'created', ?)`)
        .bind(eventId, actor.tenantId, id, actor.userId, kind),
    ]);
    return json({ id, status: 'open' }, 201);
  }
  const escalation = /^\/api\/premises-security\/records\/([0-9a-f-]{36})\/(escalate|acknowledge)$/.exec(path);
  if (escalation && request.method === 'PATCH') {
    const [, id, action] = escalation;
    if (action === 'acknowledge' && !isSupervisor) return error('Supervisor permission required.', 403);
    const condition = action === 'escalate'
      ? "escalated_at IS NULL AND status != 'resolved' AND kind IN ('incident','hazard','gate')"
      : "escalated_at IS NOT NULL AND acknowledged_at IS NULL AND status != 'resolved'";
    const field = action === 'escalate' ? 'escalated_at' : 'acknowledged_at';
    const [changed] = await db.batch([
      db.prepare(`UPDATE premises_security_records SET ${field} = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND id = ? AND ${condition}`).bind(actor.tenantId, id),
      db.prepare(`INSERT INTO premises_security_events (id, tenant_id, record_id, actor_id, action, details)
        SELECT ?, ?, ?, ?, ?, '' WHERE changes() = 1`)
        .bind(crypto.randomUUID(), actor.tenantId, id, actor.userId, action === 'escalate' ? 'escalated' : 'acknowledged'),
    ]);
    if (Number(changed.meta?.changes || 0) !== 1) return error('Record not eligible for this action.', 409);
    return json({ id, action });
  }
  const history = /^\/api\/premises-security\/records\/([0-9a-f-]{36})\/events$/.exec(path);
  if (history && request.method === 'GET') {
    const record = await db.prepare(`SELECT id, kind, title, location, notes, status, severity, checked_out_at, escalated_at, acknowledged_at, created_at
      FROM premises_security_records WHERE tenant_id = ? AND id = ?`)
      .bind(actor.tenantId, history[1]).first();
    if (!record) return error('Record not found.', 404);
    const events = await db.prepare(`SELECT id, actor_id, action, details, created_at
      FROM premises_security_events WHERE tenant_id = ? AND record_id = ? ORDER BY created_at DESC LIMIT 100`)
      .bind(actor.tenantId, history[1]).all();
    return json({ record, events: events.results || [] });
  }
  const checkout = /^\/api\/premises-security\/records\/([0-9a-f-]{36})\/checkout$/.exec(path);
  if (checkout && request.method === 'PATCH') {
    // Only visitor records can be checked out; the conditional update prevents double checkout.
    const [updated] = await db.batch([
      db.prepare(`UPDATE premises_security_records SET checked_out_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = ? AND id = ? AND kind = 'visitor' AND checked_out_at IS NULL`)
        .bind(actor.tenantId, checkout[1]),
      db.prepare(`INSERT INTO premises_security_events (id, tenant_id, record_id, actor_id, action, details)
        SELECT ?, ?, ?, ?, 'visitor_checked_out', '' WHERE changes() = 1 AND EXISTS (
          SELECT 1 FROM premises_security_records WHERE tenant_id = ? AND id = ?
          AND kind = 'visitor' AND checked_out_at IS NOT NULL
        )`)
        .bind(crypto.randomUUID(), actor.tenantId, checkout[1], actor.userId, actor.tenantId, checkout[1]),
    ]);
    if (Number(updated.meta?.changes || 0) !== 1) return error('Visitor not found or already checked out.', 409);
    return json({ id: checkout[1], checkedOut: true });
  }
  const match = /^\/api\/premises-security\/records\/([0-9a-f-]{36})\/status$/.exec(path);
  if (match && request.method === 'PATCH') {
    if (!isSupervisor) return error('Supervisor permission required.', 403);
    const raw = await request.text();
    if (raw.length > 1000) return error('Request too large.', 413);
    let input: any;
    try { input = JSON.parse(raw); } catch { return error('Invalid JSON.', 400); }
    const status = short(input?.status, 30);
    if (!allowedStatuses.has(status)) return error('Invalid status.', 400);
    const record = await db.prepare(`SELECT status FROM premises_security_records WHERE tenant_id = ? AND id = ?`)
      .bind(actor.tenantId, match[1]).first<{ status: string }>();
    if (!record) return error('Record not found.', 404);
    if (record.status === status) return json({ id: match[1], status });
    const [changed] = await db.batch([
      db.prepare(`UPDATE premises_security_records SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ? AND status = ?`)
        .bind(status, actor.tenantId, match[1], record.status),
      db.prepare(`INSERT INTO premises_security_events (id, tenant_id, record_id, actor_id, action, details)
        SELECT ?, ?, ?, ?, 'status_changed', ? WHERE changes() = 1 AND EXISTS
        (SELECT 1 FROM premises_security_records WHERE tenant_id = ? AND id = ? AND status = ?)`)
        .bind(crypto.randomUUID(), actor.tenantId, match[1], actor.userId, status, actor.tenantId, match[1], status),
    ]);
    if (Number(changed.meta?.changes || 0) !== 1) return error('Record changed; refresh and retry.', 409);
    return json({ id: match[1], status });
  }
  return error('Security endpoint not found.', 404);
}
