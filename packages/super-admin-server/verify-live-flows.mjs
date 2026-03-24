import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = (process.env.NDOVERA_SUPER_ADMIN_BASE_URL || 'http://127.0.0.1:3101').replace(/\/$/, '');
const outputPath = path.join(__dirname, 'live-super-admin-check.json');
const loginEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin.local@ndovera.test';
const loginPassword = process.env.SUPER_ADMIN_PASSWORD || 'Pass123456!';
const suffix = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

let cookieHeader = '';

function mergeCookies(response) {
  const values = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  if (!values.length) return;

  const jar = new Map(
    cookieHeader
      .split('; ')
      .filter(Boolean)
      .map((entry) => {
        const index = entry.indexOf('=');
        return index === -1 ? [entry, ''] : [entry.slice(0, index), entry.slice(index + 1)];
      }),
  );

  for (const value of values) {
    const firstPart = String(value).split(';')[0];
    const index = firstPart.indexOf('=');
    if (index === -1) continue;
    jar.set(firstPart.slice(0, index), firstPart.slice(index + 1));
  }

  cookieHeader = Array.from(jar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
}

async function request(pathname, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(`${baseUrl}${pathname}`, { ...options, headers });
  mergeCookies(response);
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload ? payload.error : text || `HTTP ${response.status}`;
    throw new Error(String(message));
  }

  return payload;
}

async function main() {
  const schoolName = `Live Check ${suffix}`;
  const subdomain = `livecheck${suffix}`;

  const health = await request('/health');
  const login = await request('/api/super/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: loginEmail, password: loginPassword }),
  });
  const { csrfToken } = await request('/csrf-token');
  const authHeaders = { 'x-csrf-token': csrfToken };

  const school = await request('/api/super/schools', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      schoolName,
      subdomain,
      ownerName: 'Live Owner',
      ownerEmail: `owner.${suffix}@ndovera.test`,
      ownerPhone: '+250700111000',
      ownerPassword: loginPassword,
    }),
  });

  const initialDirectory = await request(`/api/super/users/directory?schoolId=${encodeURIComponent(school.school.id)}`);

  const staff = await request('/api/super/users/provision', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'staff',
      schoolId: school.school.id,
      schoolName: school.school.name,
      name: 'Live Staff User',
      email: `staff.${suffix}@ndovera.test`,
      phone: '+250700111001',
      password: loginPassword,
      roles: ['Teacher'],
    }),
  });

  const student = await request('/api/super/users/provision', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'student',
      schoolId: school.school.id,
      schoolName: school.school.name,
      name: 'Live Student User',
      email: `student.${suffix}@ndovera.test`,
      phone: '+250700111002',
      password: loginPassword,
      roles: ['Student'],
    }),
  });

  const updatedStaff = await request(`/api/super/users/${encodeURIComponent(staff.user.id)}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      schoolId: school.school.id,
      name: 'Live Staff Updated',
      email: `staff.updated.${suffix}@ndovera.test`,
      phone: '+250700111099',
      password: loginPassword,
      roles: ['Teacher', 'Department Lead'],
      activeRole: 'Department Lead',
      category: 'staff',
    }),
  });

  const directoryAfterUpdate = await request(`/api/super/users/directory?schoolId=${encodeURIComponent(school.school.id)}`);

  const deactivatedStaff = await request(`/api/super/users/${encodeURIComponent(staff.user.id)}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      schoolId: school.school.id,
      status: 'inactive',
    }),
  });

  const directoryAfterDeactivate = await request(`/api/super/users/directory?schoolId=${encodeURIComponent(school.school.id)}`);
  const directoryWithInactive = await request(`/api/super/users/directory?schoolId=${encodeURIComponent(school.school.id)}&includeInactive=1`);

  const reactivatedStaff = await request(`/api/super/users/${encodeURIComponent(staff.user.id)}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      schoolId: school.school.id,
      status: 'active',
    }),
  });

  const directoryAfterReactivate = await request(`/api/super/users/directory?schoolId=${encodeURIComponent(school.school.id)}`);

  const transfer = await request(`/api/super/students/${encodeURIComponent(student.user.id)}/transfer`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      targetSchoolId: 'school-1',
      reason: 'Live API verification transfer',
    }),
  });

  const directoryAfterTransfer = await request(`/api/super/users/directory?schoolId=${encodeURIComponent(school.school.id)}`);
  const targetDirectory = await request('/api/super/users/directory?schoolId=school-1');

  const result = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    health,
    loginUser: login.user,
    createdSchool: {
      id: school.school.id,
      name: school.school.name,
      subdomain: school.school.subdomain,
      ownerId: school.owner.id,
      ownerEmail: school.owner.email,
    },
    initialCounts: {
      users: initialDirectory.users.length,
      students: initialDirectory.students.length,
    },
    provisionedStaff: {
      id: staff.user.id,
      email: staff.user.email,
      phone: staff.user.phone,
      roles: staff.user.roles,
    },
    updatedStaff: {
      id: updatedStaff.user.id,
      name: updatedStaff.user.name,
      email: updatedStaff.user.email,
      phone: updatedStaff.user.phone,
      roles: updatedStaff.user.roles,
      activeRole: updatedStaff.user.activeRole,
    },
    createdSchoolAfterUpdate: {
      users: directoryAfterUpdate.users.length,
      students: directoryAfterUpdate.students.length,
    },
    deactivation: {
      deactivatedUserId: deactivatedStaff.user.id,
      deactivatedStatus: deactivatedStaff.user.status,
      hiddenFromDefaultDirectory: !directoryAfterDeactivate.users.some((entry) => entry.id === deactivatedStaff.user.id),
      visibleWhenIncludingInactive: directoryWithInactive.users.some((entry) => entry.id === deactivatedStaff.user.id && entry.status === 'inactive'),
      reactivatedStatus: reactivatedStaff.user.status,
      visibleAfterReactivate: directoryAfterReactivate.users.some((entry) => entry.id === reactivatedStaff.user.id && entry.status === 'active'),
    },
    provisionedStudent: {
      id: student.user.id,
      email: student.user.email,
      phone: student.user.phone,
    },
    transfer: {
      fromUserId: transfer.transfer.fromUserId,
      toUserId: transfer.transfer.toUserId,
      fromSchoolId: transfer.transfer.fromSchoolId,
      toSchoolId: transfer.transfer.toSchoolId,
      studentStatus: transfer.student.status,
    },
    createdSchoolAfterTransfer: {
      users: directoryAfterTransfer.users.length,
      students: directoryAfterTransfer.students.length,
    },
    targetSchoolAfterTransfer: {
      users: targetDirectory.users.length,
      students: targetDirectory.students.length,
      transferredStudentFound: targetDirectory.students.some((entry) => entry.userId === transfer.transfer.toUserId),
    },
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote live verification result to ${outputPath}`);
}

main().catch((error) => {
  const result = {
    ok: false,
    baseUrl,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
  };
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.error(error);
  process.exitCode = 1;
});