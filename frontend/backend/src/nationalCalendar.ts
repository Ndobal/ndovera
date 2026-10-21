// Nigeria's calendar for every school: public holidays (school closed, nobody marked absent)
// and special days (observed in school: Day of the Girl Child, Men's Day, Teachers' Day …).
// Fixed dates repeat every year; Easter is calculated; the Islamic holidays follow the moon and
// are only confirmed by the Federal Government days before, so their dates here are the
// expected ones, labelled as such. A school can still add or change its own days.

export type NationalDay = { date: string, title: string, kind: 'holiday' | 'observance', note?: string }

const FIXED_HOLIDAYS: Array<[string, string]> = [
  ['01-01', "New Year's Day"],
  ['05-01', "Workers' Day"],
  ['05-27', "Children's Day (schools)"],
  ['06-12', 'Democracy Day'],
  ['10-01', 'Independence Day'],
  ['12-25', 'Christmas Day'],
  ['12-26', 'Boxing Day'],
]

// Expected dates (Nigeria usually observes the day and the next for both Eids).
const ISLAMIC_HOLIDAYS: Record<number, Array<[string, string, number]>> = {
  2025: [['03-30', 'Eid-el-Fitr', 2], ['06-06', 'Eid-el-Kabir', 2], ['09-05', 'Eid-el-Maulud', 1]],
  2026: [['03-20', 'Eid-el-Fitr', 2], ['05-27', 'Eid-el-Kabir', 2], ['08-26', 'Eid-el-Maulud', 1]],
  2027: [['03-10', 'Eid-el-Fitr', 2], ['05-16', 'Eid-el-Kabir', 2], ['08-15', 'Eid-el-Maulud', 1]],
  2028: [['02-27', 'Eid-el-Fitr', 2], ['05-05', 'Eid-el-Kabir', 2], ['08-04', 'Eid-el-Maulud', 1]],
  2029: [['02-15', 'Eid-el-Fitr', 2], ['04-24', 'Eid-el-Kabir', 2], ['07-24', 'Eid-el-Maulud', 1]],
  2030: [['02-05', 'Eid-el-Fitr', 2], ['04-14', 'Eid-el-Kabir', 2], ['07-14', 'Eid-el-Maulud', 1]],
}

const OBSERVANCES: Array<[string, string]> = [
  ['01-24', 'International Day of Education'],
  ['02-21', 'International Mother Language Day'],
  ['03-03', 'World Wildlife Day'],
  ['03-08', "International Women's Day"],
  ['03-22', 'World Water Day'],
  ['04-07', 'World Health Day'],
  ['04-22', 'Earth Day'],
  ['04-23', 'World Book Day'],
  ['05-25', 'Africa Day'],
  ['06-05', 'World Environment Day'],
  ['06-16', 'Day of the African Child'],
  ['08-12', 'International Youth Day'],
  ['09-08', 'International Literacy Day'],
  ['09-21', 'International Day of Peace'],
  ['10-05', "World Teachers' Day"],
  ['10-10', 'World Mental Health Day'],
  ['10-11', 'International Day of the Girl Child'],
  ['10-16', 'World Food Day'],
  ['11-19', "International Men's Day"],
  ['11-20', "World Children's Day"],
  ['12-01', 'World AIDS Day'],
  ['12-03', 'International Day of Persons with Disabilities'],
  ['12-10', 'Human Rights Day'],
]

const iso = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)

/** Easter Sunday (Gregorian, anonymous algorithm). */
export function easterSunday(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(year, month, day)
}

/** The nth weekday (0 = Sunday) of a month. */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return iso(year, month, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7)
}

/** Every national day of a year: public holidays and special days, sorted by date. */
export function nationalDays(year: number): NationalDay[] {
  const days: NationalDay[] = FIXED_HOLIDAYS.map(([monthDay, title]) => ({ date: `${year}-${monthDay}`, title, kind: 'holiday' as const }))
  const easter = easterSunday(year)
  days.push({ date: addDays(easter, -2), title: 'Good Friday', kind: 'holiday' }, { date: addDays(easter, 1), title: 'Easter Monday', kind: 'holiday' })
  for (const [monthDay, title, length] of ISLAMIC_HOLIDAYS[year] || []) {
    for (let day = 0; day < length; day += 1) {
      days.push({ date: addDays(`${year}-${monthDay}`, day), title: length > 1 ? `${title}${day ? ' (holiday)' : ''}` : title, kind: 'holiday', note: 'Expected date: the Federal Government confirms it shortly before.' })
    }
  }
  for (const [monthDay, title] of OBSERVANCES) days.push({ date: `${year}-${monthDay}`, title, kind: 'observance' })
  days.push({ date: addDays(easter, -21), title: "Mothering Sunday (Mother's Day)", kind: 'observance' })
  days.push({ date: nthWeekday(year, 6, 0, 3), title: "Father's Day", kind: 'observance' })
  return days.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))
}

/** National days between two dates (inclusive). */
export function nationalDaysBetween(from: string, to: string) {
  const startYear = Number(from.slice(0, 4))
  const endYear = Number(to.slice(0, 4))
  const out: NationalDay[] = []
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return out
  for (let year = startYear; year <= Math.min(endYear, startYear + 5); year += 1) {
    for (const day of nationalDays(year)) if (day.date >= from && day.date <= to) out.push(day)
  }
  return out
}
