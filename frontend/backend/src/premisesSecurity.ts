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
  if (!path.startsWith('/api/premises-security')) return null;
  if (!actor?.tenantId || !actor.userId) return error('Authentication required.', 401);
  if (!permitted.has(actor.role)) return error('Security role required.', 403);
  const isSupervisor = supervisors.has(actor.role);
  if (path === '/api/premises-security/overview' && request.method === 'GET') {
    const [summary, latest] = await db.batch([
      db.prepare(`SELECT kind, status, COUNT(*) AS total FROM premises_security_records WHERE tenant_id = ? GROUP BY kind, status`).bind(actor.tenantId),
      db.prepare(`SELECT id, kind, title, location, severity, status, created_at, created_by FROM premises_security_records WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 60`).bind(actor.tenantId),
    ]);
    return json({ summary: summary.results, records: latest.results, supervisor: isSupervisor });
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
        SELECT ?, ?, ?, ?, 'status_changed', ? WHERE EXISTS
        (SELECT 1 FROM premises_security_records WHERE tenant_id = ? AND id = ? AND status = ?)`)
        .bind(crypto.randomUUID(), actor.tenantId, match[1], actor.userId, status, actor.tenantId, match[1], status),
    ]);
    if (Number(changed.meta?.changes || 0) !== 1) return error('Record changed; refresh and retry.', 409);
    return json({ id: match[1], status });
  }
  return error('Security endpoint not found.', 404);
}
