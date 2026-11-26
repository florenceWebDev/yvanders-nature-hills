import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { checks, checkRelease, parseOrigin } from '../scripts/release-check.mjs';
import { documentationOnly, buildDecision } from '../scripts/netlify-ignore.mjs';

async function serve(t, override = () => false) {
  const methods = [];
  const server = http.createServer((req, res) => {
    methods.push({ method: req.method, cookie: req.headers.cookie, authorization: req.headers.authorization });
    if (override(req, res)) return;
    const check = checks.find(item => item.route === req.url);
    res.writeHead(check?.status || 404, { 'content-type': check?.kind === 'page' ? 'text/html' : 'application/json' });
    res.end(check?.kind === 'page' ? '<title>Yvander’s Nature Hills</title>' :
      check?.kind === 'session' ? '{"configured":true,"user":null}' : '{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { origin: `http://127.0.0.1:${server.address().port}`, methods };
}

function cli(file, args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { env, windowsHide: true });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
}

test('healthy configured site passes with anonymous GETs and CLI exit zero', async t => {
  const fixture = await serve(t);
  const report = await checkRelease(fixture.origin);
  assert.equal(report.ok, true);
  assert.equal(report.results.length, checks.length);
  assert.ok(fixture.methods.every(req => req.method === 'GET' && !req.cookie && !req.authorization));
  const result = await cli('scripts/release-check.mjs', [fixture.origin]);
  assert.equal(result.code, 0);
  assert.match(result.output, /PASS 17\/17 checks/);
});

test('failures include protected endpoints exposing 200 and no sensitive response text', async t => {
  const fixture = await serve(t, (req, res) => {
    if (req.url !== '/api/bookings') return false;
    res.end('private-fixture-do-not-print'); return true;
  });
  const report = await checkRelease(fixture.origin);
  assert.equal(report.ok, false);
  assert.match(report.results.find(result => result.route === '/api/bookings').error, /expected HTTP 401/);
  const result = await cli('scripts/release-check.mjs', [fixture.origin]);
  assert.equal(result.code, 1);
  assert.doesNotMatch(result.output, /private-fixture-do-not-print/);
});

test('unconfigured, malformed session, wrong HTML and redirects fail', async t => {
  for (const mode of ['unconfigured', 'malformed', 'html', 'preview', 'redirect', 'missing-page']) {
    const fixture = await serve(t, (req, res) => {
      if (['unconfigured', 'malformed'].includes(mode) && req.url === '/api/session') {
        res.end(mode === 'unconfigured' ? '{"configured":false}' : 'not-json'); return true;
      }
      if (['html', 'preview', 'redirect'].includes(mode) && req.url === '/') {
        res.writeHead(mode === 'redirect' ? 302 : 200, { 'content-type': 'text/html', location: '/account' });
        res.end(mode === 'preview' ? '<title>Yvander</title>Design preview ·' : 'unavailable'); return true;
      }
      if (mode === 'missing-page' && req.url === '/not-a-real-release-check-page') { res.end('soft 404'); return true; }
      return false;
    });
    assert.equal((await checkRelease(fixture.origin)).ok, false, mode);
  }
});

test('connection failures, response-header timeouts and stalled bodies fail within bounds', async t => {
  for (const mode of ['disconnect', 'headers', 'body']) {
    const fixture = await serve(t, (req, res) => {
      if (req.url !== '/') return false;
      if (mode === 'disconnect') req.socket.destroy();
      if (mode === 'body') { res.writeHead(200, { 'content-type': 'text/html' }); res.write('<title>'); }
      return true;
    });
    const report = await checkRelease(fixture.origin, { timeoutMs: 100 });
    assert.equal(report.ok, false, mode);
    assert.match(report.results[0].error, mode === 'disconnect' ? /network/ : /timed out/);
    assert.ok(report.ms < 5000);
  }
});

test('origins reject credentials, paths, queries and remote HTTP without echoing input', async () => {
  assert.equal(parseOrigin('https://example.test/'), 'https://example.test');
  for (const origin of ['https://user:secret@example.test', 'https://example.test/path', 'https://example.test/?token=secret', 'http://example.test', 'not-a-url']) {
    assert.throws(() => parseOrigin(origin));
    const result = await cli('scripts/release-check.mjs', [origin]);
    assert.equal(result.code, 1);
    assert.doesNotMatch(result.output, /secret|not-a-url/);
  }
});

test('only allowlisted documentation paths skip; assets, SQL, scripts and unknown Markdown build', () => {
  assert.equal(documentationOnly(['README.md', 'docs/OPERATIONS.md', 'docs/decisions/001-example.md']), true);
  for (const file of ['src/app/page.tsx', 'src/content.md', 'public/readme.md', 'docs/screenshots/home.jpg', 'docs/helper.js',
    'supabase/migrations/007.sql', 'netlify.toml', 'package.json', '.github/workflows/application.yml', 'tests/x.mjs', 'OTHER.md', 'docs/../src/x.md']) {
    assert.equal(documentationOnly(['docs/PLAN.md', file]), false, file);
  }
  assert.equal(documentationOnly([]), false);
});

test('real Git comparisons cover docs, mixed changes, rename, deletion and uncertain history', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ynh-deployment-'));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (file, content) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), content); };
  const commit = () => { git(['add', '.']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture']); return git(['rev-parse', 'HEAD']); };
  git(['init', '-q', '--initial-branch=main']);
  write('README.md', 'baseline'); write('src/code.js', 'baseline');
  const base = commit();
  write('README.md', 'updated'); const docs = commit();
  assert.equal(buildDecision({ cwd: root, base, head: docs }).skip, true);
  const skipped = execFileSync(process.execPath, [path.resolve('scripts/netlify-ignore.mjs')], {
    cwd: root, encoding: 'utf8', env: { ...process.env, CACHED_COMMIT_REF: base, COMMIT_REF: docs },
  });
  assert.match(skipped, /^SKIP:/); // execFileSync also requires actual exit zero.
  write('src/code.js', 'changed'); const mixed = commit();
  assert.equal(buildDecision({ cwd: root, base, head: mixed }).skip, false);
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.renameSync(path.join(root, 'src/code.js'), path.join(root, 'docs/code.md')); const renamed = commit();
  assert.equal(buildDecision({ cwd: root, base: mixed, head: renamed }).skip, false);
  fs.unlinkSync(path.join(root, 'docs/code.md')); const deletedDoc = commit();
  assert.equal(buildDecision({ cwd: root, base: renamed, head: deletedDoc }).skip, true);
  write('src/delete-me.js', 'fixture'); const beforeDeletion = commit();
  fs.unlinkSync(path.join(root, 'src/delete-me.js')); const afterDeletion = commit();
  assert.equal(buildDecision({ cwd: root, base: beforeDeletion, head: afterDeletion }).skip, false);
  git(['checkout', '-q', '--orphan', 'unrelated']); write('README.md', 'unrelated'); const unrelated = commit();
  git(['checkout', '-q', 'main']);
  assert.equal(buildDecision({ cwd: root, base: unrelated, head: afterDeletion }).skip, false);
  for (const options of [{}, { base: docs, head: docs }, { base: 'f'.repeat(40), head: deletedDoc },
    { base, head: docs }, { base: deletedDoc, head: base }, { base: '--help', head: deletedDoc }]) {
    assert.equal(buildDecision({ cwd: root, ...options }).skip, false, JSON.stringify(options));
  }
});

test('Netlify ignore CLI conservatively builds without metadata (exit one)', async () => {
  const result = await cli('scripts/netlify-ignore.mjs', [], { ...process.env, CACHED_COMMIT_REF: '', COMMIT_REF: '' });
  assert.equal(result.code, 1);
  assert.match(result.output, /^BUILD:/);
});
