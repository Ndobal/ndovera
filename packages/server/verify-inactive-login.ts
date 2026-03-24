import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { loadIdentityState, provisionUser, updateIdentityUser } from '../../identity-state.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, 'verify-inactive-login-output.json');
const baseUrl = (process.env.NDOVERA_SERVER_BASE_URL || 'http://127.0.0.1:3200').replace(/\/$/, '');
const identifier = 'inactive-login-check@ndovera.test';
const password = 'Pass123456!';

async function request(pathname: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers });
  const text = await response.text();
  let payload: Record<string, any> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }
  return { status: response.status, ok: response.ok, payload };
}

async function ensureTestUser() {
  const state = await loadIdentityState();
  let user = state.users.find((entry) => (entry.email || '').toLowerCase() === identifier);
  if (!user) {
    user = (await provisionUser(state, {
      category: 'staff',
      schoolId: 'school-1',
      schoolName: 'Ndovera Academy',
      name: 'Inactive Login Check',
      email: identifier,
      password,
      roles: ['Teacher'],
    })).user;
  } else {
    user = (await updateIdentityUser(state, {
      userId: user.id,
      schoolId: user.schoolId,
      password,
      status: 'active',
      roles: user.roles,
      activeRole: user.activeRole,
    })).user;
  }
  return user;
}

async function setStatus(userId: string, schoolId: string, status: 'active' | 'inactive') {
  const state = await loadIdentityState();
  return (await updateIdentityUser(state, { userId, schoolId, status })).user;
}

async function main() {
  const user = await ensureTestUser();
  const activeLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: identifier, password }),
  });

  const deactivated = await setStatus(user.id, user.schoolId, 'inactive');
  const blockedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: identifier, password }),
  });

  const reactivated = await setStatus(user.id, user.schoolId, 'active');
  const restoredLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: identifier, password }),
  });

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    user: {
      id: user.id,
      email: identifier,
      schoolId: user.schoolId,
    },
    activeLogin: {
      status: activeLogin.status,
      ok: activeLogin.ok,
      userId: activeLogin.payload?.user?.id || null,
    },
    deactivatedUser: {
      id: deactivated.id,
      status: deactivated.status,
    },
    blockedLogin: {
      status: blockedLogin.status,
      ok: blockedLogin.ok,
      error: blockedLogin.payload?.error || null,
    },
    reactivatedUser: {
      id: reactivated.id,
      status: reactivated.status,
    },
    restoredLogin: {
      status: restoredLogin.status,
      ok: restoredLogin.ok,
      userId: restoredLogin.payload?.user?.id || null,
    },
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote inactive login verification result to ${outputPath}`);
}

main().catch((error) => {
  fs.writeFileSync(outputPath, `${JSON.stringify({ ok: false, baseUrl, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error) }, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});