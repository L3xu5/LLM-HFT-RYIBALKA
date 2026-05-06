const { spawnSync } = require('child_process');
const path = require('path');
const dotenv = require('dotenv');

const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });

if (!process.env.YANDEX_MAPS_API_KEY && process.env.EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY) {
  process.env.YANDEX_MAPS_API_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_JS_API_KEY;
}

process.env.RUN_LIVE_EXTERNAL_TESTS = '1';

const jestBin = path.join(root, 'node_modules', 'jest', 'bin', 'jest.js');
const result = spawnSync(
  process.execPath,
  [jestBin, '__tests__/external.sources.live.test.ts', '--runInBand'],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  },
);

process.exit(result.status === null ? 1 : result.status);
