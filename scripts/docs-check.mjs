import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ignored = new Set(['node_modules', '.git', '.next', '.vercel', 'dist', 'coverage']);
const methods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
export const requiredDocs = ['README.md','AGENTS.md','CONTRIBUTING.md','CHANGELOG.md','docs/README.md','docs/DEVELOPMENT.md','docs/ARCHITECTURE.md','docs/API.md','docs/DATABASE.md','docs/CONFIGURATION.md','docs/OPERATIONS.md','docs/TESTING.md','docs/DESIGN.md','docs/PROJECT.md','docs/PLAN.md','docs/RELEASE.md','docs/decisions/README.md'];
const normalized = value => value.replaceAll('\\', '/');
const exists = file => fs.existsSync(file) && fs.statSync(file).isFile();
const read = (root, relative) => fs.readFileSync(path.join(root, relative), 'utf8');

export function walk(root, directory = '') {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name) || entry.isSymbolicLink()) return [];
    const relative = normalized(path.join(directory, entry.name));
    return entry.isDirectory() ? walk(root, relative) : [relative];
  });
}

export function checkLinks(root, files = walk(root).filter(f => f.endsWith('.md'))) {
  const errors = [];
  for (const file of files) {
    // Code examples are not navigable links. Reference links/fragments need review.
    const text = read(root, file).replace(/(^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\2[^\n]*(?=\n|$)/g, '$1').replace(/`[^`\n]*`/g, '');
    for (const match of text.matchAll(/!?\[[^\]\n]*\]\((<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\)/g)) {
      let target = match[1].replace(/^<|>$/g, '');
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('//') || target.startsWith('#')) continue;
      target = target.split(/[?#]/)[0];
      if (!target) continue;
      try { target = decodeURIComponent(target); } catch { errors.push(`${file}: malformed link ${match[1]}`); continue; }
      const resolved = path.resolve(path.dirname(path.join(root, file)), target);
      const relative = path.relative(root, resolved);
      if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
        errors.push(`${file}: local link leaves repository: ${target}`);
      } else if (!fs.existsSync(resolved)) errors.push(`${file}: missing local link target: ${target}`);
    }
  }
  return errors;
}

function markerInventory(text, type) {
  return [...text.matchAll(new RegExp(`<!--\\s*${type}:\\s*([^\\n]*?)\\s*-->`, 'g'))].map(m => m[1].trim());
}
function compareInventory(expected, documented, label) {
  const expectedSet = new Set(expected), actualSet = new Set(documented), errors = [];
  for (const value of expectedSet) if (!actualSet.has(value)) errors.push(`${label}: undocumented entry ${value}`);
  for (const value of actualSet) if (!expectedSet.has(value)) errors.push(`${label}: stale documented entry ${value}`);
  if (documented.length !== actualSet.size) errors.push(`${label}: duplicate inventory marker`);
  return errors;
}

export function endpointInventory(root) {
  const endpoints = new Set(), errors = [];
  for (const file of walk(root, 'src/app').filter(f => /\/route\.[cm]?[jt]s$/.test(f))) {
    const source = ts.createSourceFile(file, read(root, file), ts.ScriptTarget.Latest, true);
    const segments = file.slice('src/app/'.length).replace(/\/route\.[cm]?[jt]s$/, '').split('/').filter(s => !/^\(.*\)$/.test(s));
    const catchAll = segments.some(s => s.startsWith('[...') || s.startsWith('[[...'));
    const route = '/' + segments.map(s => s.replace(/^\[([^\]]+)\]$/, '{$1}')).join('/');
    let exportsFound = 0;
    for (const statement of source.statements) {
      const exported = statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) continue;
      if (ts.isFunctionDeclaration(statement) && statement.name && methods.has(statement.name.text)) {
        exportsFound++;
        const method = statement.name.text;
        if (!catchAll) { endpoints.add(`${method} ${route}`); continue; }
        const names = new Set();
        const visit = node => {
          if (ts.isBinaryExpression(node) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(node.operatorToken.kind)) {
            for (const [identifier, literal] of [[node.left,node.right],[node.right,node.left]]) {
              if (ts.isIdentifier(identifier) && identifier.text === 'route' && ts.isStringLiteral(literal)) names.add(literal.text);
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(statement);
        if (!names.size) errors.push(`${file}: unsupported catch-all dispatcher; extend endpointInventory and its tests`);
        for (const name of names) endpoints.add(`${method} /${segments.slice(0,-1).join('/')}/${name}`);
      } else if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => ts.isIdentifier(d.name) && methods.has(d.name.text))) {
        errors.push(`${file}: exported handler aliases/arrows need explicit inventory support`);
      } else if (ts.isExportDeclaration(statement) && statement.exportClause?.elements?.some(e => methods.has(e.name.text))) {
        errors.push(`${file}: re-exported handlers need explicit inventory support`);
      }
    }
    if (!exportsFound) errors.push(`${file}: no supported exported HTTP handler found`);
  }
  return { endpoints: [...endpoints].sort(), errors };
}

export function checkInventories(root) {
  const example = exists(path.join(root,'.env.example')) ? read(root,'.env.example') : '';
  const env = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]);
  const configuration = exists(path.join(root,'docs/CONFIGURATION.md')) ? read(root,'docs/CONFIGURATION.md') : '';
  const api = exists(path.join(root,'docs/API.md')) ? read(root,'docs/API.md') : '';
  const routes = endpointInventory(root);
  const errors = [...routes.errors,...compareInventory(env,markerInventory(configuration,'env'),'docs/CONFIGURATION.md'),...compareInventory(routes.endpoints,markerInventory(api,'endpoint'),'docs/API.md')];
  const runtimeFiles = walk(root,'src').filter(f => /\.[cm]?[jt]sx?$/.test(f));
  if (exists(path.join(root,'next.config.ts'))) runtimeFiles.push('next.config.ts');
  for (const file of runtimeFiles) {
    const source = ts.createSourceFile(file, read(root,file), ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isPropertyAccessExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(source)==='process' && node.expression.name.text==='env') {
        const key=node.name.text;
        if (key!=='NODE_ENV'&&!env.includes(key)) errors.push(`${file}: runtime variable ${key} needs .env.example and CONFIGURATION documentation`);
      }
      if (ts.isElementAccessExpression(node) && node.expression.getText(source)==='process.env') {
        if (node.argumentExpression && ts.isStringLiteral(node.argumentExpression)) {
          const key=node.argumentExpression.text;
          if(key!=='NODE_ENV'&&!env.includes(key)) errors.push(`${file}: runtime variable ${key} needs .env.example and CONFIGURATION documentation`);
        } else errors.push(`${file}: computed environment access requires explicit inventory support`);
      }
      ts.forEachChild(node,visit);
    };
    visit(source);
  }
  return errors;
}

// Each relevant group must be satisfied; a scheduled endpoint matches API+operations.
export function changeRequirements(paths) {
  const groups = new Map(); let changelog = false;
  const add=(name,docs)=>groups.set(name,docs);
  for(const raw of paths){
    const file=normalized(raw);
    if(/\.md$/i.test(file)||/^(public|assets)\//.test(file)||file==='next-env.d.ts') continue;
    if(file.startsWith('tests/')) { add('tests',['docs/TESTING.md']); continue; }
    changelog=true;
    if(file.startsWith('supabase/')) {add('database',['docs/DATABASE.md']);continue;}
    if(file.startsWith('src/')) {
      if(file.startsWith('src/app/api/')||file.startsWith('src/app/auth/')||['src/lib/validation.ts','src/lib/types.ts'].includes(file)) add('API/contracts',['docs/API.md','docs/DATABASE.md']);
      else if(file.startsWith('src/components/')||file.startsWith('src/app/')) add('UI',['docs/DESIGN.md','docs/PROJECT.md','docs/DEVELOPMENT.md']);
      else add('application libraries',['docs/ARCHITECTURE.md','docs/DEVELOPMENT.md']);
      if(file.startsWith('src/app/api/jobs/')) add('scheduled operations',['docs/OPERATIONS.md']);
    } else if(/^(package(-lock)?\.json|\.env\.example|next\.config\.[cm]?[jt]s|tsconfig\.json|vercel\.json|\.nvmrc|\.node-version)$/.test(file)) add('configuration',['docs/CONFIGURATION.md','docs/OPERATIONS.md','README.md']);
    else add('tooling',['docs/OPERATIONS.md','docs/DEVELOPMENT.md','CONTRIBUTING.md']);
  }
  return {groups,changelog};
}

export function documentationImpact(root, paths) {
  const changed=new Set(paths.map(normalized));
  const updated=file=>changed.has(file)&&exists(path.join(root,file))&&read(root,file).trim().length>0;
  const {groups,changelog}=changeRequirements(paths),errors=[];
  for(const [name,docs]of groups)if(!docs.some(updated))errors.push(`${name} changes require a reference update: ${docs.join(' OR ')}`);
  if(changelog&&!updated('CHANGELOG.md'))errors.push('Application/configuration/database/tooling changes require an entry in CHANGELOG.md');
  return errors;
}

const git=(root,args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
export function changedPaths(root, base='origin/main', head, threeDot=false) {
  // Refs are separate argv values, never shell interpolation. Verify before diffing.
  const resolve=ref=>git(root,['rev-parse','--verify',`${ref}^{commit}`]).trim();
  const baseSha=resolve(base), headSha=head?resolve(head):undefined;
  const args=['diff','--name-only','--no-renames','-z'];
  if(threeDot){if(!headSha)throw new Error('--three-dot requires --head');args.push(`${baseSha}...${headSha}`);}
  else args.push(baseSha,...(headSha?[headSha]:[]));
  args.push('--');
  const paths=git(root,args).split('\0').filter(Boolean);
  if(!headSha)paths.push(...git(root,['ls-files','--others','--exclude-standard','-z']).split('\0').filter(Boolean));
  return [...new Set(paths)];
}

export function runChecks(root, {base='origin/main',head,threeDot=false}={}) {
  const errors=[];
  for(const file of requiredDocs)if(!exists(path.join(root,file))||!read(root,file).trim())errors.push(`Missing/empty required handbook file: ${file}`);
  errors.push(...checkLinks(root),...checkInventories(root));
  const paths=changedPaths(root,base,head,threeDot);
  errors.push(...documentationImpact(root,paths));
  return {errors,paths};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i++){
      if(args[i]==='--three-dot')options.threeDot=true;
      else if(['--base','--head'].includes(args[i])&&args[i+1])options[args[i++].slice(2)]=args[i];
      else throw new Error(`Unknown or incomplete argument: ${args[i]}`);
    }
    const {errors,paths}=runChecks(process.cwd(),options);
    if(errors.length){console.error('Documentation check failed:\n'+errors.map(e=>' - '+e).join('\n'));process.exitCode=1;}
    else console.log(`Documentation check passed: links, endpoint/environment inventories, and ${paths.length} changed paths reviewed.`);
  }catch(error){console.error(`Documentation check could not complete: ${error.message}`);process.exitCode=1;}
}
