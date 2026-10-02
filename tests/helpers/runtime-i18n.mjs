import fs from 'node:fs';
import vm from 'node:vm';
export function loadRuntimeI18n(overrides={}) {
  const context={...overrides};context.window=context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(new URL('../../nodalia-i18n.js',import.meta.url),'utf8'),context);
  return context.NodaliaI18n;
}
