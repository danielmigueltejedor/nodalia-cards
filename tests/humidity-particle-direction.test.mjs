import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { buildSync } from 'esbuild';
const source=buildSync({entryPoints:['src/cards/humidifier/humidifier-helpers.ts'],bundle:true,write:false,format:'iife',globalName:'helpers'}).outputFiles[0].text;
const box={URL};box.window=box;const context=vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),context);vm.runInContext(source,context);
const direction=(attributes={},state='on',mode)=>context.helpers.getHumidityParticleDirection({state,attributes},mode);
test('Humidity animation uses action, device class and explicit mode, with a safe unknown-device fallback',()=>{
  assert.equal(direction({device_class:'dehumidifier'}),'inward');assert.equal(direction({device_class:'humidifier'}),'outward');
  assert.equal(direction({friendly_name:'Dehumidifier',icon:'mdi:air-humidifier'}),'outward');
  assert.equal(direction({device_class:'humidifier',action:'dehumidifying'}),'inward');
  assert.equal(direction({device_class:'dehumidifier',action:'humidifying'}),'outward');
  assert.equal(direction({},'dehumidifying'),'inward');assert.equal(direction({},'humidifying'),'outward');
  assert.equal(direction({mode:'dry'}),'inward');assert.equal(direction({},'on','dehumidify'),'inward');
  assert.equal(direction({supported_features:1,available_modes:['dry','auto'],mode:'auto'}),'outward');
  assert.equal(context.helpers.getHumidityParticleDirection(null),'outward');
});
