import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildSync } from 'esbuild';
const source = buildSync({ entryPoints: ['src/cards/lock/lock-config.ts'], bundle: true, write: false, format: 'iife', globalName: 'lock' }).outputFiles[0].text;
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../nodalia-utils.js', import.meta.url), 'utf8'), sandbox);
vm.runInContext(source, sandbox);

test('Lock normalizes style overrides without changing slider safety or accepting injected CSS', () => {
  const input = { entity: 'lock.front', styles: { card: { padding: '20px', background: '</style><script>alert(1)</script>' }, icon: { size: '48px' } } };
  const config = sandbox.lock.normalizeConfig(input);
  const defaults = sandbox.lock.normalizeConfig({ entity: 'lock.front' });
  assert.equal(config.styles.card.padding, '20px');
  assert.equal(config.styles.card.background, defaults.styles.card.background);
  assert.equal(config.styles.icon.size, '48px');
  assert.equal(config.unlock_action, 'slider');
  assert.equal(Object.hasOwn(input.styles, 'control'), false);
  assert.throws(() => sandbox.lock.normalizeConfig({ entity: 'lock.front', unlock_action: 'toggle' }), /requires the slider/);
});
