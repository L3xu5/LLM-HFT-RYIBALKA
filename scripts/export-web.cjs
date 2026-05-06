/**
 * Loads root `.env` into process.env and only then runs `expo export`.
 * Otherwise app.config.ts and Metro do not see EXPO_PUBLIC_* while building dist/ (blank screen on hosting).
 * In CI variables are already in environment, so .env is optional.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (e) {
    console.warn('[export-web] dotenv not loaded:', e?.message ?? e);
  }
}

const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');
const useNode = fs.existsSync(expoCli);

const result = useNode
  ? spawnSync(process.execPath, [expoCli, 'export', '--platform', 'web'], {
      stdio: 'inherit',
      env: process.env,
      cwd: root,
    })
  : spawnSync('npx', ['expo', 'export', '--platform', 'web'], {
      stdio: 'inherit',
      env: process.env,
      cwd: root,
      shell: process.platform === 'win32',
    });

process.exit(result.status === null ? 1 : result.status);
