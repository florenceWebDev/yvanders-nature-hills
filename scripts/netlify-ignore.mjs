// Netlify semantics: 0 skips the build, 1 continues. Any uncertainty builds.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDocs = new Set(['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'CHANGELOG.md']);
export function documentationOnly(paths) {
  return paths.length > 0 && paths.every(file => rootDocs.has(file) ||
    (/^docs\/.+\.md$/.test(file) && !file.split('/').some(part => part === '..')));
}

export function buildDecision({ cwd = process.cwd(), base, head } = {}) {
  if (![base, head].every(ref => typeof ref === 'string' && /^[a-f0-9]{40,64}$/i.test(ref)) || base === head) {
    return { skip: false, reason: 'missing comparison or same-commit rebuild' };
  }
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
  try {
    for (const ref of [base, head]) git(['cat-file', '-e', `${ref}^{commit}`]);
    if (git(['rev-parse', 'HEAD']).trim() !== head) return { skip: false, reason: 'checkout does not match target' };
    git(['merge-base', '--is-ancestor', base, head]);
    // Disable rename detection so both the old and new paths are classified.
    const paths = git(['diff', '--name-only', '--no-renames', '-z', base, head, '--']).split('\0').filter(Boolean);
    return documentationOnly(paths)
      ? { skip: true, reason: 'only recognized documentation changed' }
      : { skip: false, reason: 'runtime, tooling, assets, SQL, unknown, or empty changes' };
  } catch {
    return { skip: false, reason: 'comparison history unavailable or not an ancestor' };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const decision = buildDecision({ base: process.env.CACHED_COMMIT_REF, head: process.env.COMMIT_REF });
  console.log(`${decision.skip ? 'SKIP' : 'BUILD'}: ${decision.reason}`);
  process.exitCode = decision.skip ? 0 : 1;
}
