import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {build,transform} from 'esbuild';
import {embeddedStylesPlugin} from '../scripts/embedded-styles.mjs';

test('embedded CSS retains prefixes, custom values, selectors and rule order while producing a self-contained string',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'nodalia-css-'));
  try {
    const css=await readFile(new URL('../src/cards/calendar/calendar-composer.css',import.meta.url),'utf8');
    await writeFile(path.join(directory,'composer.css'),css);
    const input=path.join(directory,'styles.mjs'); await writeFile(input,'export {default} from "./composer.css";');
    const output=await build({entryPoints:[input],plugins:[embeddedStylesPlugin()],bundle:true,write:false,format:'iife',globalName:'styles'});
    const context=vm.createContext({}); vm.runInContext(output.outputFiles[0].text,context);
    const actual=context.styles.default;
    const expected=await transform(css,{loader:'css',minifyWhitespace:true,minifySyntax:false,minifyIdentifiers:false});
    assert.equal(actual,expected.code.trim());
    assert.ok(actual.length<css.length);
    assert.match(actual,/-webkit-backdrop-filter:blur\(8px\)/);
    assert.match(actual,/backdrop-filter:blur\(8px\)/);
    assert.match(actual,/font-size:var\(--calendar-title-size\)/);
    assert.match(actual,/\.calendar-composer__row\[hidden\]\{display:none!important\}/);
    assert.match(actual,/\.calendar-composer__field input,\.calendar-composer__field textarea,\.calendar-composer__field select/);
    assert.ok(actual.indexOf('.calendar-composer__check input{')<actual.indexOf('.calendar-composer__check input:checked{'));
    assert.equal(output.outputFiles.length,1);
    assert.doesNotMatch(output.outputFiles[0].text,/fetch\(|import\(/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
