import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) files.push(file);
  }
}
walk(path.join(root, 'src'));
const baseline = new Set(JSON.parse(fs.readFileSync(path.join(root, 'scripts/type-debt.json'), 'utf8')));
const graph = new Map();
const unchecked = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if (/\/\/\s*@ts-nocheck/.test(source)) {
    unchecked.push(relative);
    if (!baseline.has(relative)) throw new Error(`New unchecked TypeScript module: ${relative}`);
  }
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const dependencies = [];
  for (const node of ast.statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    if (node.isTypeOnly || node.importClause?.isTypeOnly) continue;
    if (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
      && !node.importClause.name && node.importClause.namedBindings.elements.every(entry => entry.isTypeOnly)) continue;
    if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier) || !node.moduleSpecifier.text.startsWith('.')) continue;
    const base = path.resolve(path.dirname(file), node.moduleSpecifier.text);
    const target = [base, `${base}.ts`, path.join(base, 'index.ts')].find(candidate => files.includes(candidate));
    if (target) dependencies.push(target);
  }
  graph.set(file, dependencies);
}
const cycleDebt = new Set(JSON.parse(fs.readFileSync(path.join(root, 'scripts/import-cycle-debt.json'), 'utf8')).map(cycle => [...cycle].sort().join('|')));
const foundCycles = new Set();
const done = new Set(), active = new Set();
function visit(file, chain = []) {
  if (active.has(file)) {
    const cycle = chain.slice(chain.indexOf(file)).map(item => path.relative(root, item)).sort().join('|');
    if (!cycleDebt.has(cycle)) throw new Error(`New runtime import cycle: ${cycle}`);
    foundCycles.add(cycle); return;
  }
  if (done.has(file)) return;
  active.add(file);
  for (const child of graph.get(file) || []) visit(child, [...chain, file]);
  active.delete(file); done.add(file);
}
for (const file of graph.keys()) visit(file);
console.log(`${files.length} source modules; ${unchecked.length} explicitly tracked unchecked modules; ${foundCycles.size} tracked legacy runtime cycles; no new cycles.`);
