/**
 * Подгружает корневой `.env` в process.env и только затем вызывает `expo export`.
 * Иначе app.config.ts и Metro не видят EXPO_PUBLIC_* при сборке dist/ (белый экран на хостинге).
 * В CI переменные уже в окружении — файл .env не обязателен.
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
    console.warn('[export-web] dotenv не загружен:', e?.message ?? e);
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
