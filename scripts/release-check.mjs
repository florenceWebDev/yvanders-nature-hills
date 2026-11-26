// Anonymous, read-only deployment smoke check. Never print response bodies or sessions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const productionOrigin = 'https://yvanders-nature-hills.netlify.app';
export const checks = [
  ...['/', '/stays', '/camping', '/gatherings', '/about', '/gallery', '/faq', '/contact', '/privacy', '/account', '/admin']
    .map(route => ({ route, status: 200, kind: 'page' })),
  { route: '/api/session', status: 200, kind: 'session' },
  ...['/api/bookings', '/api/admin', '/api/admin/bookings?order=newest', '/api/jobs']
    .map(route => ({ route, status: 401 })),
  { route: '/not-a-real-release-check-page', status: 404 },
];

export function parseOrigin(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
    throw new Error('Use a bare HTTPS origin (HTTP is allowed only for localhost).');
  }
  return url.origin;
}

export async function checkRelease(value = productionOrigin, { timeoutMs = 15000 } = {}) {
  const origin = parseOrigin(value);
  const started = performance.now();
  const results = new Array(checks.length);
  let next = 0;
  // Bound both requests and wall time. No cookies, authentication, redirects, or writes.
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < checks.length) {
      const index = next++;
      const check = checks[index];
      const start = performance.now();
      let status, error;
      try {
        const response = await fetch(new URL(check.route, origin), {
          method: 'GET', redirect: 'manual', credentials: 'omit',
          cache: 'no-store', signal: AbortSignal.timeout(timeoutMs),
        });
        status = response.status;
        // Consume bodies inside the same timeout; do not log them, including on failure.
        const body = await response.text();
        if (status !== check.status) error = `expected HTTP ${check.status}, received ${status}`;
        else if (check.kind === 'page' && (!/text\/html/i.test(response.headers.get('content-type') || '') ||
          !/<title>[^<]+<\/title>/i.test(body) || !body.includes('Yvander') || body.includes('Design preview ·'))) {
          error = 'expected a branded live HTML page';
        } else if (check.kind === 'session') {
          try {
            if (JSON.parse(body)?.configured !== true) error = 'booking services are not configured';
          } catch { error = 'session response is not valid JSON'; }
        }
      } catch (cause) {
        error = ['TimeoutError', 'AbortError'].includes(cause.name) ? 'request timed out' : 'network request failed';
      }
      results[index] = { route: check.route, status, ok: !error, error, ms: Math.round(performance.now() - start) };
    }
  }));
  return { origin, ok: results.every(result => result.ok), ms: Math.round(performance.now() - started), results };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 3) throw new Error('Expected at most one origin argument.');
    const report = await checkRelease(process.argv[2]);
    console.log(`Release check: ${report.origin}`);
    for (const result of report.results) {
      console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.route} (${result.ms}ms)${result.error ? ': ' + result.error : ''}`);
    }
    console.log(`${report.ok ? 'PASS' : 'FAIL'} ${report.results.filter(result => result.ok).length}/${report.results.length} checks in ${report.ms}ms. Confirm the published commit separately; this does not test authenticated workflows or inbox delivery.`);
    process.exitCode = report.ok ? 0 : 1;
  } catch {
    // Do not echo an invalid argument: it could contain credentials or a signed URL.
    console.error('Release check could not start. Use: npm run release:check -- https://your-site.example (bare origin only).');
    process.exitCode = 1;
  }
}
