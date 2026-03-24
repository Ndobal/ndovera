import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(scriptDir, 'verify-payroll-e2e-launcher-output.json');

try {
  await import('./verify-payroll-e2e.mts');
  fs.writeFileSync(outputPath, JSON.stringify({ ok: true }, null, 2));
} catch (error) {
  fs.writeFileSync(outputPath, JSON.stringify({
    ok: false,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : String(error),
  }, null, 2));
  process.exitCode = 1;
}
