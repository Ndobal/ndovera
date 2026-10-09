// Drives the local probe (see probe.ts) through every scenario and writes one JSON report.
//   node scripts/ai-quality-probe/run.mjs [outFile] [baseUrl]
import { writeFileSync } from 'node:fs'

const out = process.argv[2] || 'ai-quality-report.json'
const base = process.argv[3] || 'http://127.0.0.1:8799'
const names = await (await fetch(`${base}/scenarios`)).json()
const report = []
for (let index = 0; index < names.length; index += 1) {
  const started = Date.now()
  const response = await fetch(`${base}/run?scenario=${index}`)
  const result = await response.json()
  report.push(result)
  console.log(`${names[index]}: ${result.error ? `ERROR ${result.error}` : `${result.written}/${result.planned} written, ${result.rejected.length} rejected, ${result.moderator.length} moderator note(s)`} (${Math.round((Date.now() - started) / 1000)} s)`)
  writeFileSync(out, JSON.stringify(report, null, 2))
}
console.log(`Report: ${out}`)
