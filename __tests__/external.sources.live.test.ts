/**
 * Live external availability checks.
 *
 * These tests intentionally call real external APIs:
 * - Overpass
 * - Nominatim
 *
 * They are disabled by default and run only when:
 *   RUN_LIVE_EXTERNAL_TESTS=1
 */

import 'dotenv/config';
import { spawnSync } from 'child_process';

const RUN_LIVE = process.env.RUN_LIVE_EXTERNAL_TESTS === '1';

const describeLive = RUN_LIVE ? describe : describe.skip;

function curlJsonWithRetry(
  url: string,
  opts: { headers?: Record<string, string>; method?: 'GET' | 'POST'; body?: string },
  retries = 2,
  delayMs = 800,
): { status: number; body: string } {
  let lastErr: unknown = null;
  for (let i = 0; i <= retries; i++) {
    try {
      const args = ['-sS', '-m', '12', '-w', '\n__CURL_HTTP__:%{http_code}'];
      if (opts.method === 'POST') args.push('-X', 'POST');
      for (const [k, v] of Object.entries(opts.headers ?? {})) {
        args.push('-H', `${k}: ${v}`);
      }
      if (opts.body) args.push('--data', opts.body);
      args.push(url);
      const out = spawnSync('curl', args, { encoding: 'utf-8' });
      const combined = `${out.stdout ?? ''}${out.stderr ?? ''}`;
      const marker = '\n__CURL_HTTP__:';
      const idx = combined.lastIndexOf(marker);
      if (idx < 0) throw new Error(combined.trim() || 'curl failed');
      const body = combined.slice(0, idx);
      const codeText = combined.slice(idx + marker.length).trim();
      const status = Number(codeText);
      if (!Number.isFinite(status)) throw new Error(`Invalid curl status: ${codeText}`);
      if (status >= 200 && status < 300) return { status, body };
      lastErr = new Error(`HTTP ${status}: ${body.slice(0, 300)}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < retries) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

describeLive('External water sources availability (live)', () => {
  jest.setTimeout(45_000);

  it('Overpass is reachable and returns water-like elements', async () => {
    const query = [
      '[out:json][timeout:8];',
      'node(around:3000,55.7558,37.6176)["waterway"];',
      'out 5;',
    ].join('\n');

    const overpassEndpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
    ];

    let data: { elements?: unknown[] } | null = null;
    let success = false;
    for (const endpoint of overpassEndpoints) {
      try {
        const res = curlJsonWithRetry(
          endpoint,
          {
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: query,
            method: 'POST',
          },
          1,
          500,
        );
        data = JSON.parse(res.body) as { elements?: unknown[] };
        success = true;
        break;
      } catch {
        // try next endpoint
      }
    }

    expect(success).toBe(true);
    expect(Array.isArray(data?.elements)).toBe(true);
    expect((data?.elements ?? []).length).toBeGreaterThan(0);
  });

  it('Nominatim reverse geocoding is reachable and returns a label', async () => {
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=55.7558&lon=37.6176&zoom=12&accept-language=en';

    const res = curlJsonWithRetry(
      url,
      {
        method: 'GET',
        headers: { 'User-Agent': 'rybalka-live-test/1.0' },
      },
      2,
      800,
    );
    const json = JSON.parse(res.body) as { display_name?: string };

    expect(typeof json.display_name).toBe('string');
    expect((json.display_name ?? '').length).toBeGreaterThan(3);
  });
});
