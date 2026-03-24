import fs from 'fs';

const output = { stage: 'init' };
const outputPath = new URL('./verify-hosted-exam-flow.node-output.json', import.meta.url);

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  addFromResponse(response) {
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    for (const header of setCookies) {
      if (!header) continue;
      const [pair] = header.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      this.cookies.set(name, value);
    }
  }

  header() {
    return Array.from(this.cookies.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

async function request(baseUrl, jar, path, options = {}) {
  const headers = new Headers(options.headers || {});
  const cookieHeader = jar.header();
  if (cookieHeader) headers.set('cookie', cookieHeader);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: 'manual' });
  jar.addFromResponse(response);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const superJar = new CookieJar();
  const schoolAdminJar = new CookieJar();
  const studentJar = new CookieJar();
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  output.stage = 'super-login';
  await request('http://127.0.0.1:3001', superJar, '/api/super/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'super@ndovera.test', password: 'Super123!' }),
  });

  output.stage = 'super-csrf';
  const superCsrf = await request('http://127.0.0.1:3001', superJar, '/csrf-token');

  output.stage = 'create-exam';
  const exam = await request('http://127.0.0.1:3001', superJar, '/api/super/championships', {
    method: 'POST',
    headers: { 'x-csrf-token': superCsrf.csrfToken },
    body: JSON.stringify({
      title: `Ndovera Hosted Exam ${timestamp}`,
      description: 'Hosted by Ndovera for every school in the system.',
      type: 'exam',
      scope: 'hosted',
      mode: 'single',
      status: 'active',
      hostOrganization: 'African Schools Consortium',
      hostedByNdovera: true,
      entryFee: 0,
      questions: [
        {
          type: 'multiple-choice',
          prompt: 'What is 12 multiplied by 8?',
          options: ['84', '96', '108', '112'],
          correctAnswer: '96',
          explanation: '12 x 8 = 96',
          points: 5,
        },
        {
          type: 'multiple-choice',
          prompt: 'Which planet is known as the Red Planet?',
          options: ['Venus', 'Mars', 'Jupiter', 'Mercury'],
          correctAnswer: 'Mars',
          explanation: 'Mars is commonly called the Red Planet.',
          points: 5,
        },
      ],
    }),
  });

  output.stage = 'school-admin-login';
  await request('http://127.0.0.1:3000', schoolAdminJar, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'admin@ndovera.test', password: 'Admin123!' }),
  });

  output.stage = 'school-admin-csrf';
  const schoolCsrf = await request('http://127.0.0.1:3000', schoolAdminJar, '/csrf-token');

  output.stage = 'provision-student';
  const studentPassword = 'Student123!';
  const studentProvision = await request('http://127.0.0.1:3000', schoolAdminJar, '/api/users/provision', {
    method: 'POST',
    headers: { 'x-csrf-token': schoolCsrf.csrfToken },
    body: JSON.stringify({
      category: 'student',
      schoolId: 'school-1',
      schoolName: 'Ndovera Academy',
      name: `Hosted Exam Student ${timestamp}`,
      email: `student.${timestamp}@ndovera.test`,
      password: studentPassword,
      roles: ['Student'],
    }),
  });

  output.stage = 'student-login';
  await request('http://127.0.0.1:3000', studentJar, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: studentProvision.user.id, password: studentPassword }),
  });

  output.stage = 'student-csrf';
  const studentCsrf = await request('http://127.0.0.1:3000', studentJar, '/csrf-token');

  output.stage = 'portal';
  const portal = await request('http://127.0.0.1:3000', studentJar, '/api/championships/portal');

  output.stage = 'join';
  const joined = await request('http://127.0.0.1:3000', studentJar, `/api/championships/${exam.competition.id}/join`, {
    method: 'POST',
    headers: { 'x-csrf-token': studentCsrf.csrfToken },
    body: JSON.stringify({}),
  });

  output.stage = 'detail';
  const detail = await request('http://127.0.0.1:3000', studentJar, `/api/championships/${exam.competition.id}`);

  output.stage = 'answer';
  const answer = await request('http://127.0.0.1:3000', studentJar, `/api/championships/${exam.competition.id}/answers`, {
    method: 'POST',
    headers: { 'x-csrf-token': studentCsrf.csrfToken },
    body: JSON.stringify({
      questionId: detail.questions[0].id,
      answer: '96',
      timeTaken: 12000,
    }),
  });

  output.stage = 'done';
  output.result = {
    examId: exam.competition.id,
    examTitle: exam.competition.title,
    studentId: studentProvision.user.id,
    portalCount: portal.competitions.length,
    joinedStatus: joined.participant?.status ?? null,
    scoreAfterFirstAnswer: answer.participant?.score ?? null,
    leaderboardTopUser: answer.leaderboard?.[0]?.userId ?? null,
  };

  const serialized = JSON.stringify(output);
  fs.writeFileSync(outputPath, serialized);
  console.log(serialized);
}

main().catch((error) => {
  output.error = error instanceof Error ? error.message : String(error);
  const serialized = JSON.stringify(output);
  fs.writeFileSync(outputPath, serialized);
  console.log(serialized);
  process.exitCode = 1;
});
