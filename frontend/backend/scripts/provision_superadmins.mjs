import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const SUPERADMINS = [
  { email: 'ndobalamwilliams@ndovera.com', name: 'Ndobalam Williams' },
  { email: 'ndobal.will@gmail.com', name: 'Ndobal Will' },
];

const PASSWORD_HASH_VERSION = 1;
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_HASH_BYTES = 32;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const schemaPath = path.join(backendDir, 'd1', 'schema.sql');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function maskInput(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error('Run this command in an interactive terminal to enter passwords securely.'));
      return;
    }

    const stdin = process.stdin;
    let value = '';

    process.stdout.write(promptText);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.setRawMode?.(true);

    const onData = (chunk) => {
      const input = String(chunk);
      if (input === '\u0003') {
        process.stdout.write('^C\n');
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        reject(new Error('Provisioning cancelled.'));
        return;
      }

      if (input === '\r' || input === '\n') {
        process.stdout.write('\n');
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        resolve(value);
        return;
      }

      if (input === '\u0008' || input === '\u007f') {
        value = value.slice(0, -1);
        return;
      }

      value += input;
    };

    stdin.on('data', onData);
  });
}

function hashPassword(password) {
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = pbkdf2Sync(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_BYTES, 'sha256');
  return {
    version: PASSWORD_HASH_VERSION,
    algorithm: 'pbkdf2-sha256',
    iterations: PASSWORD_HASH_ITERATIONS,
    salt: salt.toString('base64'),
    hash: hash.toString('base64'),
  };
}

function runWrangler(args) {
  const result = spawnSync(npxCommand, ['wrangler', ...args], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    throw new Error(`wrangler ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }
}

async function promptForPassword(account) {
  const password = await maskInput(`Enter password for ${account.email}: `);
  if (!password) {
    throw new Error(`Password is required for ${account.email}.`);
  }

  const confirmation = await maskInput(`Confirm password for ${account.email}: `);
  if (password !== confirmation) {
    throw new Error(`Passwords did not match for ${account.email}.`);
  }

  return password;
}

async function main() {
  runWrangler(['d1', 'execute', 'APP_DB', '--remote', '--file', schemaPath]);

  const now = new Date().toISOString();
  const statements = [];

  for (const account of SUPERADMINS) {
    const password = await promptForPassword(account);
    const payload = {
      email: account.email,
      name: account.name,
      role: 'ami',
      accountType: 'superadmin',
      status: 'active',
      passwordHash: hashPassword(password),
      passwordUpdatedAt: now,
    };

    statements.push(
      `INSERT INTO settings(studentId, payload) VALUES('${escapeSql(account.email)}', '${escapeSql(JSON.stringify(payload))}') ` +
      `ON CONFLICT(studentId) DO UPDATE SET payload = excluded.payload;`
    );
    statements.push(
      `INSERT INTO audit(id, studentId, ts, action, data) VALUES(` +
      `'audit-bootstrap-${Date.now()}-${escapeSql(account.email)}', ` +
      `'${escapeSql(account.email)}', ` +
      `'${escapeSql(now)}', ` +
      `'bootstrapSuperadmin', ` +
      `'${escapeSql(JSON.stringify({ provisionedBy: 'secure-terminal-flow' }))}'` +
      `);`
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ndovera-superadmins-'));
  const sqlFile = path.join(tempDir, 'provision.sql');
  fs.writeFileSync(sqlFile, `${statements.join('\n')}\n`, 'utf8');

  try {
    runWrangler(['d1', 'execute', 'APP_DB', '--remote', '--file', sqlFile]);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  console.log('Provisioned the two superadmin accounts in remote D1.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});