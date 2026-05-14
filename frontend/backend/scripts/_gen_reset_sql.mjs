import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PASSWORD = process.env.RESET_PASSWORD || process.argv[2]
if (!PASSWORD) { console.error('Set RESET_PASSWORD env var or pass as first arg'); process.exit(1) }

const ITERATIONS = 100000
const SALT_BYTES = 16
const HASH_BYTES = 32
const NOW = new Date().toISOString()

function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES)
  const hash = pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, 'sha256')
  return { version: 1, algorithm: 'pbkdf2-sha256', iterations: ITERATIONS, salt: salt.toString('base64'), hash: hash.toString('base64') }
}

const accounts = [
  { email: 'ndobalamwilliams@ndovera.com', name: 'Ndobalam Williams' },
  { email: 'ndobal.will@gmail.com', name: 'Ndobal Will' },
  { email: 'support@ndovera.com', name: 'NDOVERA Support' },
]

const esc = v => String(v).replace(/'/g, "''")

const statements = accounts.flatMap(acc => {
  const ph = hashPassword(PASSWORD)
  const payload = JSON.stringify({ email: acc.email, name: acc.name, role: 'ami', accountType: 'superadmin', status: 'active', passwordHash: ph, passwordUpdatedAt: NOW })
  const auditId = `audit-reset-${Date.now()}-${Math.random().toString(36).slice(2,6)}-${acc.email}`
  return [
    `INSERT INTO settings(studentId,payload) VALUES('${esc(acc.email)}','${esc(payload)}') ON CONFLICT(studentId) DO UPDATE SET payload=excluded.payload;`,
    `INSERT INTO audit(id,studentId,ts,action,data) VALUES('${esc(auditId)}','${esc(acc.email)}','${esc(NOW)}','superadminPasswordReset','${esc(JSON.stringify({by:'cli-reset'}))}');`,
  ]
})

const outPath = join(__dirname, '_reset.sql')
writeFileSync(outPath, statements.join('\n') + '\n', 'utf8')
console.log(`Wrote ${outPath}`)
