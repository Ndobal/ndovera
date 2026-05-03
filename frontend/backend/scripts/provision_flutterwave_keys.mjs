import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FLUTTERWAVE_SECRETS = [
  {
    name: 'FLUTTERWAVE_PUBLIC_KEY',
    label: 'Flutterwave public key',
  },
  {
    name: 'FLUTTERWAVE_SECRET_KEY',
    label: 'Flutterwave secret key',
  },
  {
    name: 'FLUTTERWAVE_ENCRYPTION_KEY',
    label: 'Flutterwave encryption key',
  },
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');
const useShell = process.platform === 'win32';
const npxCommand = 'npx';
const overwriteExisting = process.argv.includes('--overwrite-existing');

function maskInput(promptText) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      reject(new Error('Run this command in an interactive terminal to enter Flutterwave keys securely.'));
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
        reject(new Error('Flutterwave key provisioning cancelled.'));
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

async function promptForSecret(secret) {
  while (true) {
    const value = await maskInput(`Enter ${secret.label}: `);
    if (!value) {
      throw new Error(`${secret.label} is required.`);
    }

    const confirmation = await maskInput(`Confirm ${secret.label}: `);
    if (value === confirmation) {
      return value;
    }

    process.stdout.write(`${secret.label} confirmation did not match. Please try again.\n`);
  }
}

function runWranglerCapture(args) {
  const result = spawnSync(npxCommand, ['wrangler', ...args], {
    cwd: backendDir,
    shell: useShell,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim();
    throw new Error(message || `wrangler ${args.join(' ')} failed with exit code ${result.status ?? 1}`);
  }

  return result.stdout || '[]';
}

function listExistingSecrets() {
  const raw = runWranglerCapture(['secret', 'list', '--config', 'wrangler.toml']);

  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.map(secret => secret?.name).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function putWranglerSecret(name, value) {
  const result = spawnSync(npxCommand, ['wrangler', 'secret', 'put', name, '--config', 'wrangler.toml'], {
    cwd: backendDir,
    shell: useShell,
    stdio: ['pipe', 'inherit', 'inherit'],
    encoding: 'utf8',
    input: `${value}\n`,
  });

  if (result.status !== 0) {
    throw new Error(`wrangler secret put ${name} failed with exit code ${result.status ?? 1}`);
  }
}

async function main() {
  const existingSecrets = overwriteExisting ? new Set() : listExistingSecrets();
  const pendingSecrets = FLUTTERWAVE_SECRETS.filter(secret => !existingSecrets.has(secret.name));

  if (!pendingSecrets.length) {
    console.log('All Flutterwave secrets are already present. Re-run with --overwrite-existing to replace them.');
    return;
  }

  for (const secret of pendingSecrets) {
    const value = await promptForSecret(secret);
    putWranglerSecret(secret.name, value);
  }

  console.log('Provisioned the pending Flutterwave Worker secrets.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});