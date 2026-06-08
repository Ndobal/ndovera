// Timetable engine — pure helpers shared by the management board and the student view.
// Handles section period templates, a clash-free auto-generator across every class, and
// turning saved entries into a days-as-rows / time-as-columns grid for display.

export const TIMETABLE_DAYS = [
  { n: 1, label: 'Monday', short: 'Mon' },
  { n: 2, label: 'Tuesday', short: 'Tue' },
  { n: 3, label: 'Wednesday', short: 'Wed' },
  { n: 4, label: 'Thursday', short: 'Thu' },
  { n: 5, label: 'Friday', short: 'Fri' },
];

// Subjects that should appear every school day by default.
export const DAILY_SUBJECT_HINTS = ['math', 'english'];

// Section templates. Nursery ends 1pm, Grade/Primary 2pm, Secondary 3pm — all adjustable.
export const SECTION_DEFAULTS = {
  nursery: { key: 'nursery', label: 'Nursery / Pre-school', startTime: '08:00', endTime: '13:00', periodMinutes: 40, breaks: [{ afterPeriod: 3, minutes: 20, label: 'Break' }, { afterPeriod: 5, minutes: 40, label: 'Lunch' }] },
  primary: { key: 'primary', label: 'Primary / Grade', startTime: '08:00', endTime: '14:00', periodMinutes: 40, breaks: [{ afterPeriod: 3, minutes: 20, label: 'Break' }, { afterPeriod: 6, minutes: 40, label: 'Lunch' }] },
  secondary: { key: 'secondary', label: 'Secondary (JSS–SS)', startTime: '08:00', endTime: '15:00', periodMinutes: 40, breaks: [{ afterPeriod: 3, minutes: 20, label: 'Break' }, { afterPeriod: 6, minutes: 40, label: 'Lunch' }] },
};

export const SECTION_ORDER = ['nursery', 'primary', 'secondary'];

export function timeToMinutes(value) {
  const [hours = 0, minutes = 0] = String(value || '').split(':').map(part => Number(part) || 0);
  return hours * 60 + minutes;
}

export function minutesToTime(value) {
  const safe = Math.max(0, Math.round(Number(value) || 0));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Classify a class into a section template from its name/arm.
export function inferSectionType(className = '') {
  const normalized = String(className || '').toLowerCase();
  if (/(nursery|pre-?school|pre-?k|kg|kindergarten|creche|reception|playgroup)/.test(normalized)) return 'nursery';
  if (/(jss|jhs|sss|shs|\bss\b|\bsh\b|junior|senior|secondary|form\s*\d)/.test(normalized)) return 'secondary';
  if (/(grade|primary|basic|class\s*\d|year\s*\d|prim)/.test(normalized)) return 'primary';
  return 'secondary';
}

// Build the ordered list of period slots (teaching periods + breaks) for a section config.
export function buildSectionPeriods(config = SECTION_DEFAULTS.secondary) {
  const startTime = config.startTime || '08:00';
  const endTime = config.endTime || '15:00';
  const periodMinutes = Math.max(15, Number(config.periodMinutes) || 40);
  const breaksByAfter = new Map((config.breaks || []).map(item => [Number(item.afterPeriod), item]));

  const periods = [];
  const end = timeToMinutes(endTime);
  let cursor = timeToMinutes(startTime);
  let teachingCount = 0;
  let guard = 0;

  while (cursor + 20 <= end && guard < 40) {
    guard += 1;
    const start = cursor;
    const finish = Math.min(start + periodMinutes, end);
    periods.push({ startTime: minutesToTime(start), endTime: minutesToTime(finish), isBreak: false, label: '' });
    teachingCount += 1;
    cursor = finish;

    const breakDef = breaksByAfter.get(teachingCount);
    if (breakDef && cursor + Number(breakDef.minutes || 0) <= end) {
      const breakEnd = cursor + Number(breakDef.minutes || 0);
      periods.push({ startTime: minutesToTime(cursor), endTime: minutesToTime(breakEnd), isBreak: true, label: breakDef.label || 'Break' });
      cursor = breakEnd;
    }
  }

  return periods;
}

export function countTeachingPeriods(periods = []) {
  return periods.filter(period => !period.isBreak).length;
}

// Total weekly teaching capacity for a class given its section's period template.
export function weeklyCapacity(periods = []) {
  return countTeachingPeriods(periods) * TIMETABLE_DAYS.length;
}

export function shouldDefaultDaily(subjectName = '') {
  const normalized = String(subjectName || '').toLowerCase();
  return DAILY_SUBJECT_HINTS.some(hint => normalized.includes(hint));
}

// Auto-generate clash-free timetables for many classes at once.
// A teacher is never booked into two classes whose periods overlap in time (even across sections).
export function generateSchoolTimetables({ classes = [], plans = {}, periodsByType = {}, sectionTypeByClassId = {} }) {
  const teacherBusy = new Map(); // teacherId -> Map(day -> [{ start, end }])

  const intervalsOverlap = (intervals, start, end) => intervals.some(iv => start < iv.end && end > iv.start);
  const teacherFree = (teacherId, day, start, end) => {
    if (!teacherId) return true;
    const dayMap = teacherBusy.get(teacherId);
    const intervals = dayMap?.get(day);
    return !intervals || !intervalsOverlap(intervals, start, end);
  };
  const bookTeacher = (teacherId, day, start, end) => {
    if (!teacherId) return;
    if (!teacherBusy.has(teacherId)) teacherBusy.set(teacherId, new Map());
    const dayMap = teacherBusy.get(teacherId);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day).push({ start, end });
  };

  const demandOf = (cls) => (plans[cls.id]?.subjects || []).reduce((sum, subject) => sum + Math.max(0, Number(subject.periodsPerWeek) || 0), 0);
  const orderedClasses = [...classes].sort((left, right) => demandOf(right) - demandOf(left));

  const byClass = {};
  const conflicts = [];

  for (const cls of orderedClasses) {
    const type = sectionTypeByClassId[cls.id] || inferSectionType(cls.label || cls.name);
    const periods = periodsByType[type] || buildSectionPeriods(SECTION_DEFAULTS[type] || SECTION_DEFAULTS.secondary);
    const teachingSlots = periods
      .map((period, periodIndex) => ({ ...period, periodIndex }))
      .filter(period => !period.isBreak);
    const plan = plans[cls.id] || { subjects: [] };

    const entries = [];
    const occupied = new Set();          // `${day}:${periodIndex}`
    const daySubjects = new Map();       // day -> Set(subjectId)

    // Persist break rows on every day so the saved grid shows them.
    periods.forEach((period, periodIndex) => {
      if (!period.isBreak) return;
      TIMETABLE_DAYS.forEach(day => entries.push({
        dayOfWeek: day.n, periodIndex, startTime: period.startTime, endTime: period.endTime, isBreak: true, label: period.label || 'Break',
      }));
    });

    // Expand each subject into individual period "units".
    const units = [];
    (plan.subjects || []).forEach(subject => {
      const perWeek = Math.max(0, Number(subject.periodsPerWeek) || 0);
      if (subject.daily) {
        TIMETABLE_DAYS.forEach(day => units.push({ ...subject, fixedDay: day.n }));
        for (let i = 0; i < perWeek - TIMETABLE_DAYS.length; i += 1) units.push({ ...subject, fixedDay: null });
      } else {
        for (let i = 0; i < perWeek; i += 1) units.push({ ...subject, fixedDay: null });
      }
    });
    // Fixed-day units (daily subjects) are placed first.
    units.sort((left, right) => (left.fixedDay ? 0 : 1) - (right.fixedDay ? 0 : 1));

    const daysByLoad = () => TIMETABLE_DAYS
      .map(day => ({ day: day.n, load: teachingSlots.reduce((count, slot) => count + (occupied.has(`${day.n}:${slot.periodIndex}`) ? 1 : 0), 0) }))
      .sort((left, right) => left.load - right.load)
      .map(item => item.day);

    const tryPlace = (unit, allowDuplicateSubject) => {
      const dayOrder = unit.fixedDay ? [unit.fixedDay] : daysByLoad();
      for (const day of dayOrder) {
        const subjectsToday = daySubjects.get(day) || new Set();
        if (!allowDuplicateSubject && subjectsToday.has(unit.subjectId)) continue;
        for (const slot of teachingSlots) {
          const cellKey = `${day}:${slot.periodIndex}`;
          if (occupied.has(cellKey)) continue;
          const start = timeToMinutes(slot.startTime);
          const end = timeToMinutes(slot.endTime);
          if (!teacherFree(unit.teacherId, day, start, end)) continue;

          occupied.add(cellKey);
          subjectsToday.add(unit.subjectId);
          daySubjects.set(day, subjectsToday);
          bookTeacher(unit.teacherId, day, start, end);
          entries.push({
            dayOfWeek: day,
            periodIndex: slot.periodIndex,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subjectId: unit.subjectId,
            subjectName: unit.subjectName,
            teacherId: unit.teacherId,
            teacherName: unit.teacherName,
          });
          return true;
        }
      }
      return false;
    };

    units.forEach(unit => {
      // First pass keeps subjects spread across the week; second pass allows a repeat in a day.
      if (tryPlace(unit, false)) return;
      if (tryPlace(unit, true)) return;
      conflicts.push({
        classId: cls.id,
        className: cls.label || cls.name || cls.id,
        subjectName: unit.subjectName,
        teacherName: unit.teacherName,
        reason: unit.teacherId ? 'No free slot without a teacher clash' : 'No free slot left in the week',
      });
    });

    byClass[cls.id] = entries;
  }

  return { byClass, conflicts };
}

// Turn flat entries into a grid: distinct period columns (time across the top) and one row per day.
export function entriesToDayGrid(entries = []) {
  const columnMap = new Map();
  (entries || []).forEach(entry => {
    const periodIndex = Number(entry.periodIndex || 0);
    if (!columnMap.has(periodIndex)) {
      columnMap.set(periodIndex, {
        periodIndex,
        startTime: entry.startTime || '',
        endTime: entry.endTime || '',
        isBreak: Boolean(entry.isBreak),
        label: entry.isBreak ? (entry.label || 'Break') : '',
      });
    }
  });

  const columns = Array.from(columnMap.values()).sort((left, right) => left.periodIndex - right.periodIndex);

  const rows = TIMETABLE_DAYS.map(day => {
    const cells = {};
    (entries || []).forEach(entry => {
      if (Number(entry.dayOfWeek) !== day.n) return;
      if (entry.isBreak) return;
      cells[Number(entry.periodIndex || 0)] = entry;
    });
    return { day: day.n, label: day.label, short: day.short, cells };
  });

  return { columns, rows };
}
