// Search for the sidebar: finds any page the person can open — their sidebar items, each
// Settings section (Owner / Head of School), and everyday tasks by the words people use
// ("receipt", "unplaced students", "promote") — and links straight to it.

/** Words people use for each kind of page, matched against the sidebar item's name. */
const ITEM_WORDS = [
  [/fees|billing|finance/i, 'fees payment pay paid record payment receipt receipts invoice debt debts balance owing bill bills accounts school fees term fees money'],
  [/practice pass/i, 'buy pass passes waec neco jamb bece common entrance subscription pay'],
  [/people|children/i, 'students staff parents teachers add person import upload users accounts password reset family'],
  [/result/i, 'scores report card grades ca exam results broadsheet position'],
  [/attendance|punctuality/i, 'register absent present late roll call clock in'],
  [/timetable/i, 'periods schedule lessons time table'],
  [/classroom/i, 'class stream materials notes topics live class'],
  [/assignment/i, 'homework classwork task'],
  [/material|notes/i, 'notes materials documents handouts offline'],
  [/practice/i, 'quiz quizzes questions waec neco jamb bece exam prep'],
  [/club/i, 'extracurricular club clubs society press debate'],
  [/message|messaging/i, 'chat message inbox conversation'],
  [/payroll|payslip/i, 'salary salaries payslip pay staff'],
  [/notification|communication/i, 'sms whatsapp email parent alerts reminders'],
  [/submission|teacher review|compliance/i, 'lesson plan lesson plans lesson notes review approve scheme of work'],
  [/admission/i, 'applicants applications enrol new students'],
  [/library/i, 'books borrow'],
  [/newsroom/i, 'news blog announcements post'],
  [/curriculum/i, 'syllabus scheme of work topics'],
  [/exam/i, 'exams cbt test paper questions'],
  [/ai|vera/i, 'ndovera ai assistant tutor ask'],
  [/birthday/i, 'birthday birthdays celebrate'],
  [/calendar|event/i, 'calendar events holiday dates'],
  [/championship/i, 'competition contest championships'],
  [/audit/i, 'audit trail log history who did'],
]

/** Settings sections (Owner and Head of School), each opened directly with ?tab=. */
export const SETTINGS_SECTIONS = [
  ['Profile', 'School', 'school name contact profile motto'],
  ['School Location', 'School', 'address map gps location geofence'],
  ['School Branding', 'School', 'logo colours colors brand theme'],
  ['Website', 'School', 'public site homepage website pages'],
  ['Events', 'School', 'calendar event events holiday'],
  ['Classes', 'Academic', 'add class classes arms class teacher rename delete class'],
  ['Class Levels', 'Academic', 'class level levels sections section junior senior secondary jss sss grade reception preschool early explorers primary nursery curriculum match standard'],
  ['Class Register', 'Academic', 'unplaced students without class no class assign class place students move students session register'],
  ['Subjects', 'Academic', 'add subjects subject teacher'],
  ['Sessions & Terms', 'Academic', 'academic session sessions term terms open term new session calendar'],
  ['Promotion', 'Academic', 'promote promotion students next class graduate repeat'],
  ['Promotion Flow', 'Academic', 'promotion map progression flow'],
  ['Attendance Management', 'Staff', 'staff attendance clock in qr policy late'],
]

const tokens = text => String(text || '').toLowerCase().split(/[^a-z0-9&]+/).filter(Boolean)

export function buildSearchIndex(roleKey, items = []) {
  const entries = items
    .filter(item => item?.path && item.path !== '#submit-work')
    .map(item => ({
      name: item.name, path: item.path, section: 'Menu',
      words: `${item.name} ${ITEM_WORDS.filter(([pattern]) => pattern.test(item.name)).map(([, words]) => words).join(' ')}`,
    }))
  const settings = items.find(item => /\/settings$/.test(String(item.path || '')))
  if (settings && ['owner', 'hos'].includes(roleKey)) {
    for (const [name, group, words] of SETTINGS_SECTIONS) {
      entries.push({ name: `Settings › ${name}`, path: `${settings.path}?tab=${encodeURIComponent(name)}`, section: `Settings · ${group}`, words: `${name} settings ${words}` })
    }
  }
  return entries
}

/**
 * Entries matching every word typed (word starts count: "rec pay" finds "Record payment").
 * Names that match rank above keyword-only matches; at most `limit` results.
 */
export function searchIndex(index, query, limit = 12) {
  const wanted = tokens(query)
  if (!wanted.length) return []
  const scored = []
  for (const entry of index) {
    const nameWords = tokens(entry.name)
    const allWords = tokens(entry.words)
    let score = 0
    let ok = true
    for (const word of wanted) {
      if (nameWords.some(candidate => candidate.startsWith(word))) score += 3
      else if (allWords.some(candidate => candidate.startsWith(word))) score += 1
      else { ok = false; break }
    }
    if (ok) scored.push({ entry, score: score + (entry.section === 'Menu' ? 0.5 : 0) })
  }
  return scored.sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name)).slice(0, limit).map(item => item.entry)
}
