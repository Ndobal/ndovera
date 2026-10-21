import test from 'node:test'
import assert from 'node:assert/strict'
import { easterSunday, nationalDays, nationalDaysBetween } from './build/nationalCalendar.mjs'
import { activityType, calendarEventsFrom, parseDateRange, parseJsonArray, timetableEntriesFrom } from './build/schoolImports.mjs'

test('public holidays include Easter and the Eids; special days are observances', () => {
  assert.equal(easterSunday(2026), '2026-04-05')
  assert.equal(easterSunday(2027), '2027-03-28')
  const days = nationalDays(2026)
  const on = date => days.filter(day => day.date === date).map(day => `${day.kind}:${day.title}`)
  assert.deepEqual(on('2026-04-03'), ['holiday:Good Friday'])
  assert.deepEqual(on('2026-04-06'), ['holiday:Easter Monday'])
  assert.ok(on('2026-03-20').includes('holiday:Eid-el-Fitr'))
  assert.ok(days.find(day => day.title === 'Eid-el-Fitr').note.includes('Federal Government'))
  assert.deepEqual(on('2026-10-11'), ['observance:International Day of the Girl Child'])
  assert.deepEqual(on('2026-11-19'), ["observance:International Men's Day"])
  assert.ok(on('2026-05-27').includes("holiday:Children's Day (schools)"))
  assert.deepEqual(on('2026-06-21'), ["observance:Father's Day"])
  assert.deepEqual(nationalDaysBetween('2026-10-01', '2026-10-11').map(day => day.title), ['Independence Day', "World Teachers' Day", 'World Mental Health Day', 'International Day of the Girl Child'])
})

test('calendar dates are read as schools write them', () => {
  assert.deepEqual(parseDateRange('Sat. 3rd Jan 2026'), { start: '2026-01-03', end: '2026-01-03' })
  assert.deepEqual(parseDateRange('12th – 16th Jan 2026'), { start: '2026-01-12', end: '2026-01-16' })
  assert.deepEqual(parseDateRange('30th Mar – 2nd Apr 2026'), { start: '2026-03-30', end: '2026-04-02' })
  assert.deepEqual(parseDateRange('3rd April to 6th September, 2026'), { start: '2026-04-03', end: '2026-09-06' })
  assert.deepEqual(parseDateRange('7th Feb', 2026), { start: '2026-02-07', end: '2026-02-07' })
  assert.equal(parseDateRange('Normal Academic Activities'), null)
  assert.deepEqual(['Mid-Term Break', 'Holiday', "Students' Resumption", 'Staff Resume', 'School Closes', '1st Continuous Assessment (C.A) Test'].map(activityType), ['break', 'holiday', 'term_start', 'event', 'term_end', 'event'])
})

test('an uploaded term calendar becomes calendar events, with weeks kept', () => {
  const rows = parseJsonArray('Here you go: [{"week":"","date":"Sat. 3rd Jan 2026","activity":"Fumigation"},{"week":"6th Week","date":"19th – 20th Feb 2026","activity":"Mid-Term Break"},{"week":"","date":"","activity":"Nothing"}]')
  const { events, skipped } = calendarEventsFrom(rows, 2026)
  assert.deepEqual(events.map(event => [event.title, event.type, event.startDate, event.endDate]), [['Fumigation', 'event', '2026-01-03', '2026-01-03'], ['Mid-Term Break', 'break', '2026-02-19', '2026-02-20']])
  assert.match(events[1].description, /6th Week/)
  assert.deepEqual(skipped, ['Nothing'])
})

test('an uploaded timetable becomes the class timetable, matched to its subjects and teachers', () => {
  const subjects = [{ id: 'm1', name: 'Mathematics', teacherId: 't1', teacherName: 'Mr Okafor' }, { id: 'e1', name: 'English Language', teacherId: 't2', teacherName: 'Mrs Bello' }]
  const { entries, unmatched } = timetableEntriesFrom([
    { day: 'Monday', start: '8:40', end: '9:20', subject: 'english' },
    { day: 'Monday', start: '08:00', end: '08:40', subject: 'Mathematics' },
    { day: 'Monday', start: '10:00', end: '10:30', subject: 'Short Break', break: true },
    { day: 'Tuesday', start: '1:00 pm', end: '1:40 pm', subject: 'Yoruba' },
    { day: 'Funday', start: '08:00', subject: 'Mathematics' },
  ], subjects)
  assert.deepEqual(entries.map(entry => [entry.dayOfWeek, entry.periodIndex, entry.startTime, entry.subjectId, entry.teacherId, entry.isBreak, entry.label || entry.subjectName]),
    [[1, 0, '08:00', 'm1', 't1', false, 'Mathematics'], [1, 1, '08:40', 'e1', 't2', false, 'English Language'], [1, 2, '10:00', '', '', true, 'Short Break'], [2, 0, '13:00', '', '', false, 'Yoruba']])
  assert.deepEqual(unmatched, ['Yoruba'])
})
