import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const useShell = process.platform === 'win32';
const npxCommand = 'npx';
const applyChanges = process.argv.includes('--apply');

function esc(value) {
  return String(value || '').replace(/'/g, "''");
}

function runWrangler(args, { capture = false } = {}) {
  const result = spawnSync(npxCommand, ['wrangler', ...args], {
    cwd: backendDir,
    shell: useShell,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `wrangler ${args.join(' ')} failed.`);
  }

  return result.stdout || '';
}

function parseJsonOutput(stdout) {
  const lines = String(stdout || '').trim().split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  throw new Error('Could not parse Wrangler JSON output.');
}

function normalizeRoleList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(entry => String(entry || '').trim().toLowerCase()).filter(Boolean)));
  }
  return Array.from(new Set(String(value || '').split(',').map(entry => entry.trim().toLowerCase()).filter(Boolean)));
}

function nextRolesWithoutOwner(payload = {}) {
  const roles = normalizeRoleList(payload.roles || payload.role);
  const filtered = roles.filter(role => role !== 'owner');
  return filtered.length > 0 ? filtered : ['admin'];
}

function nextPrimaryRole(payload = {}) {
  const currentPrimary = String(payload.primaryRole || payload.primary_role || payload.role || '').trim().toLowerCase();
  if (currentPrimary && currentPrimary !== 'owner') return currentPrimary;
  return nextRolesWithoutOwner(payload)[0] || 'admin';
}

function fetchQuery(command) {
  const stdout = runWrangler(['d1', 'execute', 'APP_DB', '--remote', '--json', '--command', command], { capture: true });
  return parseJsonOutput(stdout);
}

function buildAuditId(tenantId, userId) {
  return `audit-owner-dedupe-${tenantId}-${userId}-${Date.now()}`;
}

async function main() {
  const tenantResponse = fetchQuery(
    `SELECT id, owner_email FROM tenants ORDER BY id`
  );
  const ownerResponse = fetchQuery(
    `SELECT id, email, tenantId, role, primary_role
     FROM users
     WHERE tenantId IS NOT NULL
       AND (status IS NULL OR status != 'inactive')
       AND lower(COALESCE(primary_role, role, '')) = 'owner'
     ORDER BY tenantId, email`
  );

  const tenantRows = tenantResponse?.[0]?.results || tenantResponse?.results || [];
  const ownerRows = ownerResponse?.[0]?.results || ownerResponse?.results || [];
  const ownerEmailByTenant = new Map(tenantRows.map(row => [String(row.id || '').trim(), String(row.owner_email || '').trim().toLowerCase()]));
  const ownersByTenant = new Map();

  for (const row of ownerRows) {
    const tenantId = String(row.tenantId || '').trim();
    if (!tenantId) continue;
    const bucket = ownersByTenant.get(tenantId) || [];
    bucket.push(row);
    ownersByTenant.set(tenantId, bucket);
  }

  const statements = [];
  const findings = [];

  for (const [tenantId, owners] of ownersByTenant.entries()) {
    if ((owners || []).length <= 1) continue;

    const canonicalOwnerEmail = ownerEmailByTenant.get(tenantId) || '';
    const sortedOwners = [...owners].sort((left, right) => String(left.email || '').localeCompare(String(right.email || '')));
    const ownerToKeep = sortedOwners.find(owner => String(owner.email || '').trim().toLowerCase() === canonicalOwnerEmail) || sortedOwners[0];
    const duplicates = sortedOwners.filter(owner => owner.id !== ownerToKeep.id);

    findings.push({
      tenantId,
      keep: ownerToKeep.email,
      demote: duplicates.map(owner => owner.email),
    });

    for (const duplicate of duplicates) {
      const email = String(duplicate.email || '').trim().toLowerCase();
      const settingsResponse = fetchQuery(
        `SELECT studentId, payload FROM settings WHERE studentId = '${esc(email)}' LIMIT 1`
      );
      const settingsRow = (settingsResponse?.[0]?.results || settingsResponse?.results || [])[0] || null;
      let payload = {};
      try {
        payload = settingsRow?.payload ? JSON.parse(String(settingsRow.payload)) : {};
      } catch {}

      const roles = nextRolesWithoutOwner(payload);
      const primaryRole = nextPrimaryRole(payload);
      const nextPayload = {
        ...payload,
        role: primaryRole,
        primaryRole,
        roles,
        employmentCategory: payload.employmentCategory || 'administrative',
      };

      statements.push(
        `UPDATE users SET role = '${esc(primaryRole)}', primary_role = '${esc(primaryRole)}', employment_category = COALESCE(employment_category, 'administrative') WHERE id = '${esc(duplicate.id)}' AND tenantId = '${esc(tenantId)}';`
      );
      statements.push(
        `INSERT INTO settings(studentId, payload) VALUES('${esc(email)}', '${esc(JSON.stringify(nextPayload))}') ON CONFLICT(studentId) DO UPDATE SET payload = excluded.payload;`
      );
      statements.push(
        `DELETE FROM user_roles WHERE tenant_id = '${esc(tenantId)}' AND user_id = '${esc(duplicate.id)}';`
      );
      roles.forEach((role, index) => {
        statements.push(
          `INSERT OR REPLACE INTO user_roles (id, tenant_id, user_id, role, is_primary, created_at, updated_at) VALUES ('${esc(`userrole_${tenantId}_${duplicate.id}_${role}`)}', '${esc(tenantId)}', '${esc(duplicate.id)}', '${esc(role)}', ${index === 0 ? 1 : 0}, datetime('now'), datetime('now'));`
        );
      });
      statements.push(
        `INSERT INTO audit(id, studentId, ts, action, data) VALUES('${esc(buildAuditId(tenantId, duplicate.id))}', '${esc(tenantId)}', datetime('now'), 'duplicateOwnerResolved', '${esc(JSON.stringify({ demotedUserId: duplicate.id, demotedEmail: email, keptOwnerEmail: ownerToKeep.email }))}');`
      );
    }
  }

  if (findings.length === 0) {
    console.log('No duplicate owners detected.');
    return;
  }

  console.log(JSON.stringify({ findings }, null, 2));

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndovera-owner-dedupe-'));
  const sqlPath = path.join(tempDir, 'resolve_duplicate_owners.sql');
  fs.writeFileSync(sqlPath, `${statements.join('\n')}\n`, 'utf8');
  console.log(`Prepared SQL: ${sqlPath}`);

  if (!applyChanges) {
    console.log('Run again with --apply to execute the resolution against remote D1.');
    return;
  }

  try {
    runWrangler(['d1', 'execute', 'APP_DB', '--remote', '--yes', '--file', sqlPath]);
    console.log('Duplicate-owner resolution applied.');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
