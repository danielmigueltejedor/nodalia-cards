import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
import {RUNTIME_ENTRIES} from '../scripts/build-src-cards.mjs';
const source=fs.readFileSync(new URL('../nodalia-utils.js',import.meta.url),'utf8');
function runtime(extra={}) {const box={window:null,URL,...extra};box.window=box;vm.createContext(box);vm.runInContext(source,box);return box;}
const plain=value=>JSON.parse(JSON.stringify(value));
test('Utils compatibility artifact is generated from checked canonical source',()=>{assert.equal(RUNTIME_ENTRIES.find(item=>item.outfile==='nodalia-utils.js')?.entry,'src/shared/utils-runtime.ts');assert.match(source,/Generated from src\/shared\/utils-runtime.ts/);});
test('Shared JSON copies keep Date and toJSON semantics while configuration copies guard reconstructed roots',()=>{
 const box=runtime();const u=box.NodaliaUtils;
 assert.equal(u.deepClone(new Date('2026-10-02T12:00:00Z')),'2026-10-02T12:00:00.000Z');
 assert.equal(u.deepClone({toJSON:()=>false}),false);assert.equal(u.deepClone(undefined),undefined);
 const compiled=buildSync({entryPoints:['src/shared/config-values.ts'],bundle:true,write:false,format:'iife',globalName:'configValues',target:'es2020'}).outputFiles[0].text;vm.runInContext(compiled,box);
 assert.deepEqual(plain(box.configValues.cloneConfigValue({toJSON:()=>false})),{});
 const array=[1];array.toJSON=()=>({different:true});assert.deepEqual(plain(box.configValues.cloneConfigValue(array)),[]);
 const original={zero:0,off:false,rows:[{name:'A'}]};const copy=box.configValues.cloneConfigValue(original);copy.rows[0].name='B';assert.equal(original.rows[0].name,'A');assert.deepEqual(plain(copy),{zero:0,off:false,rows:[{name:'B'}]});
});
test('Style defaults reconstruct safe own properties and preserve numeric and boolean leaves',()=>{
 const {NodaliaUtils:u}=runtime();const defaults=JSON.parse('{"__proto__":{"color":"red"},"opacity":0.4,"enabled":false}');const candidate=JSON.parse('{"__proto__":{"color":"blue"},"opacity":"0.8","enabled":true}');const result=u.sanitizeStyleTree(candidate,defaults);
 assert.equal(Object.getPrototypeOf(result).color,undefined);assert.equal(Object.prototype.color,undefined);assert.equal(Object.hasOwn(result,'__proto__'),true);assert.equal(result.opacity,.8);assert.equal(result.enabled,true);
 assert.equal(result.__proto__.color,'blue');
});
test('Config stripping and path mutation reject prototype keys while preserving valid zeros and arrays',()=>{
 const {NodaliaUtils:u}=runtime();const bad=JSON.parse('{"__proto__":{"polluted":true},"constructor":{"polluted":true},"prototype":1,"zero":0,"off":false,"rows":[]}');
 assert.deepEqual(plain(u.stripEqualToDefaults(bad,{})),{zero:0,off:false,rows:[]});assert.deepEqual(plain(u.compactConfig({...bad,blank:'',empty:{}})),{zero:0,off:false,rows:[]});const target={rows:[{value:1}]};u.setByPath(target,'rows.0.value',0);assert.equal(u.getByPath(target,'rows.0.value'),0);u.setByPath(target,'__proto__.polluted',true);u.deleteByPath(target,'constructor.name');assert.equal(Object.prototype.polluted,undefined);assert.equal(u.getByPath(target,'__proto__.polluted'),undefined);
});
test('Cleared deferred callbacks cannot run after retirement even if the timer callback was already queued',()=>{
 const callbacks=new Map();let id=0;const box=runtime({setTimeout:fn=>{callbacks.set(++id,fn);return id;},clearTimeout:()=>{}});const host={};let calls=0;const timer=box.NodaliaUtils.scheduleDeferTimer(host,()=>calls++,10);box.NodaliaUtils.clearDeferTimers(host);callbacks.get(timer)();assert.equal(calls,0);const second=box.NodaliaUtils.scheduleDeferTimer(host,()=>calls++,10);callbacks.get(second)();assert.equal(calls,1);assert.equal(host._nodaliaDeferTimers.size,0);
});
test('Shadow listener release uses the original bound root and ignores malformed entries',()=>{
 const box=runtime();const old=new EventTarget(),replacement=new EventTarget();const host={shadowRoot:old};let calls=0;const listener=()=>calls++;
 assert.equal(box.NodaliaUtils.bindShadowListeners(host,[null,3,['change',listener],{type:'input',listener}]),true);assert.equal(box.NodaliaUtils.bindShadowListeners(host,[['change',listener]]),false);old.dispatchEvent(new Event('change'));assert.equal(calls,1);host.shadowRoot=replacement;assert.equal(box.NodaliaUtils.releaseShadowListeners(host),true);old.dispatchEvent(new Event('change'));assert.equal(calls,1);assert.equal(box.NodaliaUtils.bindShadowListeners(host,[['change',listener]]),true);replacement.dispatchEvent(new Event('change'));assert.equal(calls,2);
});
