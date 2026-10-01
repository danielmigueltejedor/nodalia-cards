import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSync} from 'esbuild';
const box={};box.window=box;vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),box);vm.runInContext(buildSync({entryPoints:['src/cards/climate/climate-model.ts'],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,box);const api=box.api;

test('Climate numeric absence and unit/range formatting preserve actual zero and precision',()=>{
 for(const value of [null,undefined,'',' ',false,true,[],{},NaN,Infinity]){assert.equal(Number.isNaN(api.parseFiniteClimateNumber(value)),true);assert.equal(api.formatTemperature(value,.5,true,{states:{},locale:{language:'en'}}),'-- °C');}
 const hass={states:{},locale:{language:'en-US'},config:{unit_system:{temperature:'F'}}};assert.equal(api.formatTemperature(0,.5,true,hass),'0.0 °F');assert.equal(api.formatTemperatureRangeSummary(20,22,1,hass),'20 – 22 °F');assert.equal(api.formatTemperature('21.25',.01,false,hass),'21.25');assert.equal(api.parseFiniteClimateNumber('1e2'),100);
});

test('Climate rejects malformed locales while preserving locale priority and override times',()=>{
 assert.equal(api.getHassLocale({states:{},locale:{language:'es-ES'},language:'en'}),'es-ES');assert.equal(api.getHassLocale({states:{},locale:{language:'not_a_locale'}}),'en');assert.doesNotThrow(()=>api.formatTemperature(21,.5,true,{states:{},language:'not_a_locale'}));assert.equal(api.parseEngineOverrideUntil('invalid'),null);assert.equal(api.formatEngineOverrideTime('invalid',null),'');assert.equal(api.parseEngineOverrideUntil('2026-10-01T08:30:00+02:00').toISOString(),'2026-10-01T06:30:00.000Z');
});

test('Climate color parsing understands modern translucent colors with finite luminance',()=>{
 const color=api.parseRgbColor('rgb(100% 0% 50% / 80%)');assert.equal(color.red,255);assert.equal(color.green,0);assert.equal(color.blue,127.5);assert.equal(api.getRelativeLuminance(api.parseRgbColor('color(srgb 1 1 1 / .2)')),1);assert.equal(api.getRelativeLuminance(api.parseRgbColor('#000')),0);assert.equal(api.getRelativeLuminance({red:Infinity,green:0,blue:0}),null);assert.equal(api.parseRgbColor('invalid'),null);
});

test('Climate context color probes are removed both on success and resolution failure',()=>{
 let removed=0,appended=0;box.document={createElement:()=>({style:{},remove(){removed++;}}),body:{appendChild(){appended++;}}};box.getComputedStyle=()=>({color:'rgb(1, 2, 3)'});assert.equal(api.resolveColorInContext(null,'red'),'rgb(1, 2, 3)');assert.equal(removed,1);assert.equal(appended,1);box.getComputedStyle=()=>{throw Error('resolution failed');};assert.throws(()=>api.resolveColorInContext(null,'blue'),/resolution failed/);assert.equal(removed,2);
});

test('Climate dial status prefers off mode and otherwise actual HVAC action',()=>{
 assert.equal(api.climateDialActionMeta('idle','off').icon,'mdi:power');assert.equal(api.climateDialActionMeta('heating','auto').accent,'heat');assert.equal(api.climateDialActionMeta('','cool').icon,'mdi:snowflake');assert.equal(api.getModeMeta('custom').label,'custom');
});
