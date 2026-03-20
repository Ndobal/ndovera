const { execSync } = require('child_process');

function run(command, options = {}) {
  return execSync(command, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options,
  }).trim();
}

if (process.env.GIT_AUTO_PUSH_DISABLED === '1') {
  console.log('[auto-push] Skipped because GIT_AUTO_PUSH_DISABLED=1.');
  process.exit(0);
}

try {
  const branch = run('git rev-parse --abbrev-ref HEAD');

  if (!branch || branch === 'HEAD') {
    console.log('[auto-push] Skipped because no branch is currently checked out.');
    process.exit(0);
  }

  let hasOrigin = true;
  try {
    run('git remote get-url origin');
  } catch {
    hasOrigin = false;
  }

  if (!hasOrigin) {
    console.log('[auto-push] Skipped because no origin remote is configured.');
    process.exit(0);
  }

  let hasUpstream = true;
  try {
    run(`git rev-parse --abbrev-ref ${branch}@{upstream}`);
  } catch {
    hasUpstream = false;
  }

  const pushCommand = hasUpstream
    ? `git push origin ${branch}`
    : `git push -u origin ${branch}`;

  console.log(`[auto-push] Pushing ${branch} to origin...`);
  execSync(pushCommand, { stdio: 'inherit' });
  console.log('[auto-push] Push complete.');
} catch (error) {
  const message = error && error.message ? error.message : String(error);
  console.error('[auto-push] Push failed. Your commit is still saved locally.');
  console.error(message);
  process.exit(0);
}