import { readFileSync } from 'fs';
import path from 'path';

// Ndovera Lite, the plain page old phones use. Runs the real file against a fake network:
// assignments, offline hand-in, and payments.

const SOURCE = readFileSync(path.resolve(__dirname, '../../../public/compat/app.js'), 'utf8');
const SESSION = 'ndovera:lite:session';
const USER_OUTBOX = 'ndovera:lite:s1:outbox';
const WORK = {
  id: 'a1', title: 'Fractions', description: 'Do these', studentStatus: 'Pending',
  questions: [
    { id: 'q1', type: 'mcq', prompt: 'What is 1 + 1?', options: ['1', '2'] },
    { id: 'q2', type: 'essay', prompt: 'Explain a half.' },
    { id: 'q3', type: 'crossmatching', prompt: 'Match', pairs: [{ id: 'p1', left: 'Half', right: '0.5' }, { id: 'p2', left: 'Quarter', right: '0.25' }] },
  ],
};

let net;
class FakeXhr {
  constructor() { this.headers = {}; this.status = 0; this.responseText = ''; }
  open(method, url) { this.method = method; this.path = url.replace(/[?&]ndoveraClient=lite$/, ''); }
  setRequestHeader(name, value) { this.headers[name] = value; }
  getResponseHeader() { return null; }
  send(body) {
    const call = { method: this.method, path: this.path, body: body ? JSON.parse(body) : null };
    net.calls.push(call);
    const answer = net.offline ? null : net.reply(call);
    if (answer === null || answer === undefined) { this.onerror(); return; }
    this.status = answer.status || 200;
    this.responseText = answer.html || JSON.stringify(answer.body || { success: true });
    this.onload();
  }
}

function start(role = 'student', { search = '', hash = '' } = {}) {
  document.body.innerHTML = '<main id="app"></main>';
  window.XMLHttpRequest = FakeXhr;
  window.history.replaceState({}, '', `/compat/index.html${search}${hash}`);
  if (role) localStorage.setItem(SESSION, JSON.stringify({ auth: { token: 't', user: { id: 's1', name: 'Ada', role } }, role }));
  // eslint-disable-next-line no-new-func
  new Function(SOURCE)();
}
const app = () => document.getElementById('app');
const text = () => app().textContent;
const press = name => {
  const found = Array.from(app().querySelectorAll('button,a')).find(item => item.textContent === name);
  if (!found) throw new Error(`no button "${name}" in: ${text()}`);
  found.click();
};
const posts = path => net.calls.filter(call => call.method === 'POST' && call.path === path);
const CLASS = { id: 'c1', name: 'SS 2' };
const SUBMIT = '/api/assignments/a1/submit';

function classroom(extra = {}) {
  return call => {
    if (extra[call.path]) return extra[call.path](call);
    if (call.path === '/api/classrooms/assigned') return { body: { classes: [CLASS] } };
    if (call.path === '/api/classrooms/c1/materials') return { body: { materials: [] } };
    if (call.path === '/api/classrooms/c1/assignments') return { body: { assignments: [WORK] } };
    if (call.path === SUBMIT) return { status: 201, body: { success: true, submission: { id: 's' }, score: 1, maxScore: 1 } };
    return { status: 404, body: { success: false, message: `not found ${call.path}` } };
  };
}
const openWork = () => { press('SS 2'); press('Assignments'); press('Open and answer'); };
function answer() {
  const [one, two] = Array.from(app().querySelectorAll('input[type=radio]'));
  expect(one && two).toBeTruthy();
  two.checked = true; two.onchange();
  const area = app().querySelector('textarea');
  area.value = 'One of two equal parts'; area.oninput();
  const [first] = app().querySelectorAll('select');
  first.value = 'p1'; first.onchange();
}
const handIn = () => app().querySelector('form').onsubmit({ preventDefault() {} });

let intervals;
beforeEach(() => {
  localStorage.clear();
  net = { calls: [], offline: false, reply: classroom() };
  intervals = jest.spyOn(window, 'setInterval').mockImplementation(() => 1);
  jest.spyOn(window, 'clearInterval').mockImplementation(() => {});
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => jest.restoreAllMocks());

test('the file stays plain ES5 with no modern browser features', () => {
  const acorn = require('acorn');
  expect(() => acorn.parse(SOURCE, { ecmaVersion: 5 })).not.toThrow();
  expect(SOURCE).not.toMatch(/\bfetch\(|new Promise|=>/);
});

test('a student answers every kind of question and hands in online', () => {
  start();
  openWork();
  answer();
  handIn();
  const [sent] = posts(SUBMIT);
  expect(sent.body.answers).toEqual({ q1: '2', q2: 'One of two equal parts', q3: { p1: 'p1' } });
  expect(sent.body.clientSubmissionId).toBeTruthy();
  expect(text()).toContain('Submitted. Score: 1 of 1.');
  expect(localStorage.getItem(USER_OUTBOX)).toBeNull();
});

test('answers survive the phone being closed halfway', () => {
  start();
  openWork();
  answer();
  start();
  openWork();
  expect(app().querySelector('textarea').value).toBe('One of two equal parts');
  expect(Array.from(app().querySelectorAll('input[type=radio]')).map(item => item.checked)).toEqual([false, true]);
});

test('with no network the class still opens, and work waits and sends itself once', () => {
  start();
  press('SS 2'); press('Assignments');
  net.offline = true;
  press('My classes');
  expect(text()).toContain('saved on this phone');
  press('SS 2'); press('Assignments');
  press('Open and answer');
  answer();
  handIn();
  expect(text()).toContain('Your work is saved on this phone');
  const queued = JSON.parse(localStorage.getItem(USER_OUTBOX));
  expect(queued).toHaveLength(1);
  const { clientSubmissionId, capturedAt } = queued[0].body;
  expect(capturedAt).toBeTruthy();

  net.offline = false;
  window.dispatchEvent(new Event('online'));
  const sent = posts(SUBMIT).filter(call => call.body);
  expect(sent[sent.length - 1].body.clientSubmissionId).toBe(clientSubmissionId);
  expect(JSON.parse(localStorage.getItem(USER_OUTBOX))).toEqual([]);
  const after = net.calls.length;
  window.dispatchEvent(new Event('online'));
  expect(net.calls.length).toBe(after);
});

test('a server that is down counts as "wait", but a refusal is shown and kept with its reason', () => {
  start();
  openWork();
  answer();
  net.reply = classroom({ [SUBMIT]: () => ({ status: 503, html: '<h1>Service unavailable</h1>' }) });
  handIn();
  expect(text()).toContain('Ndovera is very busy');
  expect(JSON.parse(localStorage.getItem(USER_OUTBOX))).toHaveLength(1);

  net.reply = classroom({ [SUBMIT]: () => ({ status: 403, body: { success: false, message: 'This assessment has closed.' } }) });
  window.dispatchEvent(new Event('online'));
  const [kept] = JSON.parse(localStorage.getItem(USER_OUTBOX));
  expect(kept.reason).toBe('This assessment has closed.');
  const count = posts(SUBMIT).length;
  window.dispatchEvent(new Event('online'));
  expect(posts(SUBMIT).length).toBe(count);
});

test('timed work started offline carries its start, so the limit still holds', () => {
  net.reply = classroom({ '/api/classrooms/c1/assignments': () => ({ body: { assignments: [{ ...WORK, metadata: { durationMinutes: 30 } }] } }) });
  start();
  press('SS 2'); press('Assignments');
  net.offline = true;
  press('Open and answer');
  expect(app().querySelector('form')).toBeNull();
  press('Start');
  expect(app().querySelector('.timer').textContent).toMatch(/^Time left: (30:00|29:5\d)$/);
  handIn();
  const [queued] = JSON.parse(localStorage.getItem(USER_OUTBOX));
  expect(queued.body.startedOfflineAt).toBeTruthy();
});

test('an expired session keeps saved work for the same person', () => {
  start();
  openWork();
  answer();
  net.offline = true;
  handIn();
  net.offline = false;
  net.reply = () => ({ status: 401, body: { success: false } });
  press('My classes');
  expect(text()).toContain('Any saved work stays on this phone');
  expect(JSON.parse(localStorage.getItem(USER_OUTBOX))).toHaveLength(1);
});

test('signing out on purpose clears this person\'s copies, after a warning if work is waiting', () => {
  start();
  openWork();
  answer();
  net.offline = true;
  handIn();
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  press('Sign out');
  expect(confirm).toHaveBeenCalled();
  expect(localStorage.getItem(USER_OUTBOX)).not.toBeNull();
  confirm.mockReturnValue(true);
  press('Sign out');
  expect(localStorage.getItem(USER_OUTBOX)).toBeNull();
  expect(localStorage.getItem(SESSION)).toBeNull();
});

const PASSES = {
  '/api/practice-arena/home': () => ({ body: { bundles: [{ key: 'all', label: 'All Subjects', priceNaira: 1500, ready: true }, { key: 'subject', label: 'Subject Pass', priceNaira: 300, ready: true }], subjects: [{ key: 'maths', name: 'Mathematics' }], passes: { list: [] }, pricing: { foreign: true, currency: 'GHS', nairaPerUnit: 100, surcharge: 0.2, decimals: 2 } } }),
  '/api/practice-arena/passes/checkout': () => ({ body: { checkoutUrl: 'https://checkout.flutterwave.com/x' } }),
};

test('a student buys a pass: their country\'s price, then a link that also works on another phone', () => {
  net.reply = classroom(PASSES);
  start();
  press('Practice passes');
  expect(text()).toContain('All Subjects — GHS 18');
  const select = app().querySelector('select');
  select.value = 'all'; select.onchange();
  press('Continue to payment');
  expect(posts('/api/practice-arena/passes/checkout')[0].body).toEqual({ bundle: 'all' });
  expect(app().querySelector('a.button').getAttribute('href')).toBe('https://checkout.flutterwave.com/x');
  expect(app().querySelector('input').value).toBe('https://checkout.flutterwave.com/x');
});

test('a pass code that needs a subject asks for it', () => {
  net.reply = classroom({ ...PASSES, '/api/practice-arena/passes/redeem': call => (call.body.subjectKey
    ? { body: { success: true, message: 'Subject Pass is ready to use.' } }
    : { status: 400, body: { success: false, message: 'Choose the subject for this pass.', needs: 'subject' } }) });
  start();
  press('Practice passes');
  const code = Array.from(app().querySelectorAll('form'))[0];
  code.querySelector('input').value = 'ABC';
  code.onsubmit({ preventDefault() {} });
  expect(text()).toContain('Choose the subject');
  const choose = code.querySelector('select');
  choose.value = 'maths'; choose.onchange();
  code.onsubmit({ preventDefault() {} });
  expect(text()).toContain('Subject Pass is ready to use.');
});

test('coming back from Flutterwave confirms the pass', () => {
  net.reply = classroom({ '/api/practice-arena/passes/verify': call => ({ body: { success: true, message: `Confirmed ${call.body.txRef}` } }) });
  start('student', { search: '?practice_tx=prac_1' });
  expect(text()).toContain('Confirmed prac_1');
});

test('a parent sees fees and bank details, and a payment notice waits offline', () => {
  net.reply = classroom({
    '/api/school/finance/my-accounts': () => ({ body: { accounts: [{ studentId: 'k1', studentName: 'Kid', totals: { totalOutstanding: 5000 }, previousOutstanding: [], current: [{ id: 'f1', feeItem: 'Tuition', balance: 5000 }] }] } }),
    '/api/school/fees/payment-details': () => ({ body: { paymentDetails: { bankName: 'First Bank', accountName: 'School', accountNumber: '0123456789' } } }),
  });
  start('parent');
  press('School fees');
  expect(text()).toContain('0123456789');
  expect(text()).toContain('Tuition');
  const form = app().querySelector('form');
  form.querySelector('input[type=number]').value = '5000';
  net.offline = true;
  form.onsubmit({ preventDefault() {} });
  const [queued] = JSON.parse(localStorage.getItem(USER_OUTBOX));
  expect(queued.body).toMatchObject({ studentId: 'k1', amount: 5000, obligationIds: ['f1'] });
});

test('an invoice link opens without signing in', () => {
  net.reply = () => ({ body: { success: true, invoice: { schoolName: 'Genesis', invoiceNo: 'INV1', amountCents: 1000000, status: 'sent' } } });
  start(null, { hash: '#invoice=tok1' });
  expect(text()).toContain('Genesis');
  expect(text()).toContain('₦10,000');
});

test('nothing is sent on the timer when nothing is waiting', () => {
  start();
  const flush = intervals.mock.calls.find(([, ms]) => ms === 60000)[0];
  const before = net.calls.length;
  flush();
  expect(net.calls.length).toBe(before);
});
