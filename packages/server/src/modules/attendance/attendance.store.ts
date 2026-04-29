import type { User } from '../../../rbac.js';
import { loadIdentityState } from '../../../../../identity-state.js';
import { ensureSqlSchema, executeSql, queryRowsSql } from '../../common/runtimeSqlStore.js';

type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Excused';

type StudentAttendanceRow = {
  student_id: string;
  class_id: string | null;
  date: string;
  morning_status: AttendanceStatus;
  afternoon_status: AttendanceStatus;
  updated_at: string;
};

type StaffAttendanceRow = {
  staff_id: string;
  date: string;
  status: AttendanceStatus;
  updated_at: string;
};

type ParentAttendanceRow = {
  parent_id: string;
  date: string;
  status: AttendanceStatus;
  updated_at: string;
};

type StudentRecordInput = {
  student_id: string;
  class_id?: string;
  date?: string;
  morningStatus?: AttendanceStatus;
  afternoonStatus?: AttendanceStatus;
};

const SCHEMA_KEY = 'attendance-v1';
const STATUSES = new Set<AttendanceStatus>(['Present', 'Absent', 'Late', 'Excused']);
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS attendance_student_records (
    school_id TEXT NOT NULL,
    date TEXT NOT NULL,
    student_id TEXT NOT NULL,
    class_id TEXT,
    morning_status TEXT NOT NULL,
    afternoon_status TEXT NOT NULL,
    marked_by TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (school_id, date, student_id)
  )`,
  `CREATE TABLE IF NOT EXISTS attendance_staff_records (
    school_id TEXT NOT NULL,
    date TEXT NOT NULL,
    staff_id TEXT NOT NULL,
    status TEXT NOT NULL,
    marked_by TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (school_id, date, staff_id)
  )`,
  `CREATE TABLE IF NOT EXISTS attendance_parent_records (
    school_id TEXT NOT NULL,
    date TEXT NOT NULL,
    parent_id TEXT NOT NULL,
    status TEXT NOT NULL,
    marked_by TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (school_id, date, parent_id)
  )`,
];

function nowIso() {
  return new Date().toISOString();
}

function normalizeDate(value?: string | null) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return nowIso().slice(0, 10);
}

function normalizeStatus(value: unknown): AttendanceStatus {
  const next = String(value || '').trim() as AttendanceStatus;
  return STATUSES.has(next) ? next : 'Present';
}

function schoolIdFor(user: User) {
  return String(user.school_id || 'school-1').trim() || 'school-1';
}

async function ensureSchema() {
  await ensureSqlSchema(SCHEMA_KEY, SCHEMA);
}

async function listSchoolStudents(user: User) {
  const state = await loadIdentityState();
  const schoolId = schoolIdFor(user);
  return state.students
    .filter((student) => student.schoolId === schoolId && student.status !== 'transferred')
    .map((student) => ({
      id: student.userId,
      student_id: student.id,
      name: student.name,
      class_id: null as string | null,
      class_name: null as string | null,
      role: 'Student',
    }));
}

async function listSchoolStaff(user: User) {
  const state = await loadIdentityState();
  const schoolId = schoolIdFor(user);
  return state.users
    .filter((entry) => entry.schoolId === schoolId && entry.status === 'active')
    .filter((entry) => entry.category === 'staff' || entry.category === 'admin')
    .map((entry) => ({
      id: entry.id,
      first_name: entry.name.split(/\s+/)[0] || entry.name,
      last_name: entry.name.split(/\s+/).slice(1).join(' '),
      name: entry.name,
      role: entry.activeRole || entry.roles[0] || 'Staff',
    }));
}

async function listSchoolParents(user: User) {
  const state = await loadIdentityState();
  const schoolId = schoolIdFor(user);
  return state.users
    .filter((entry) => entry.schoolId === schoolId && entry.status === 'active' && entry.category === 'parent')
    .map((entry) => ({
      id: entry.id,
      first_name: entry.name.split(/\s+/)[0] || entry.name,
      last_name: entry.name.split(/\s+/).slice(1).join(' '),
      name: entry.name,
      role: entry.activeRole || entry.roles[0] || 'Parent',
    }));
}

export async function getStudentAttendance(user: User, date?: string) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const selectedDate = normalizeDate(date);
  const students = await listSchoolStudents(user);
  const records = await queryRowsSql<StudentAttendanceRow>(
    `SELECT student_id, class_id, date, morning_status, afternoon_status, updated_at
       FROM attendance_student_records
      WHERE school_id = ? AND date = ?`,
    [schoolId, selectedDate],
  );
  return {
    date: selectedDate,
    students,
    records,
  };
}

export async function saveStudentAttendanceRecords(user: User, input: StudentRecordInput[]) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const markedBy = user.id;
  for (const item of input) {
    const studentId = String(item.student_id || '').trim();
    if (!studentId) continue;
    const date = normalizeDate(item.date);
    const morning = normalizeStatus(item.morningStatus);
    const afternoon = normalizeStatus(item.afternoonStatus);
    const classId = String(item.class_id || '').trim() || null;
    await executeSql(
      `INSERT INTO attendance_student_records (
          school_id, date, student_id, class_id, morning_status, afternoon_status, marked_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (school_id, date, student_id)
       DO UPDATE SET
         class_id = excluded.class_id,
         morning_status = excluded.morning_status,
         afternoon_status = excluded.afternoon_status,
         marked_by = excluded.marked_by,
         updated_at = excluded.updated_at`,
      [schoolId, date, studentId, classId, morning, afternoon, markedBy, nowIso()],
    );
  }
}

export async function markSingleStudentAttendance(user: User, payload: { student_id?: string; status?: AttendanceStatus; date?: string; class_id?: string }) {
  const studentId = String(payload.student_id || '').trim();
  if (!studentId) throw new Error('student_id is required.');
  const status = normalizeStatus(payload.status);
  await saveStudentAttendanceRecords(user, [{
    student_id: studentId,
    class_id: payload.class_id,
    date: payload.date,
    morningStatus: status,
    afternoonStatus: status,
  }]);
}

export async function getStaffAttendance(user: User, date?: string) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const selectedDate = normalizeDate(date);
  const staff = await listSchoolStaff(user);
  const records = await queryRowsSql<StaffAttendanceRow>(
    `SELECT staff_id, date, status, updated_at
       FROM attendance_staff_records
      WHERE school_id = ? AND date = ?`,
    [schoolId, selectedDate],
  );
  return { date: selectedDate, staff, records };
}

export async function markStaffAttendance(user: User, payload: { staff_id?: string; status?: AttendanceStatus; date?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const staffId = String(payload.staff_id || '').trim();
  if (!staffId) throw new Error('staff_id is required.');
  const date = normalizeDate(payload.date);
  const status = normalizeStatus(payload.status);
  await executeSql(
    `INSERT INTO attendance_staff_records (school_id, date, staff_id, status, marked_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (school_id, date, staff_id)
     DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, updated_at = excluded.updated_at`,
    [schoolId, date, staffId, status, user.id, nowIso()],
  );
}

export async function getParentAttendance(user: User, date?: string) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const selectedDate = normalizeDate(date);
  const parents = await listSchoolParents(user);
  const records = await queryRowsSql<ParentAttendanceRow>(
    `SELECT parent_id, date, status, updated_at
       FROM attendance_parent_records
      WHERE school_id = ? AND date = ?`,
    [schoolId, selectedDate],
  );
  return { date: selectedDate, parents, records };
}

export async function markParentAttendance(user: User, payload: { parent_id?: string; status?: AttendanceStatus; date?: string }) {
  await ensureSchema();
  const schoolId = schoolIdFor(user);
  const parentId = String(payload.parent_id || '').trim();
  if (!parentId) throw new Error('parent_id is required.');
  const date = normalizeDate(payload.date);
  const status = normalizeStatus(payload.status);
  await executeSql(
    `INSERT INTO attendance_parent_records (school_id, date, parent_id, status, marked_by, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (school_id, date, parent_id)
     DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, updated_at = excluded.updated_at`,
    [schoolId, date, parentId, status, user.id, nowIso()],
  );
}
