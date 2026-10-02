import test from 'node:test';
import assert from 'node:assert/strict';
import {loadRuntimeI18n} from './helpers/runtime-i18n.mjs';
import {RUNTIME_ENTRIES} from '../scripts/build-src-cards.mjs';
test('Runtime lookup is compiled from checked source and dispatches readiness after its API is available',()=>{
  const events=[];
  const api=loadRuntimeI18n({CustomEvent:class{constructor(type,options){this.type=type;this.options=options;}},dispatchEvent(event){assert.equal(typeof this.NodaliaI18n.strings,'function');events.push(event);}});
  assert.equal(RUNTIME_ENTRIES.find(item=>item.outfile==='nodalia-i18n.js')?.entry,'src/shared/runtime-i18n-runtime.ts');
  assert.equal(events.length,1);assert.equal(events[0].type,'nodalia-i18n-ready');assert.equal(events[0].options.bubbles,false);
  assert.equal(typeof api.translateEntityState,'function');
});
test('Partial public locale overrides inherit English without mutating it and retain the lazy cache',()=>{
  const api=loadRuntimeI18n(),english=api.strings('en');
  api.PACK.fr=()=>({calendarCard:{allDay:'Custom day'}});
  const french=api.strings('fr');
  assert.equal(french.calendarCard.allDay,'Custom day');
  assert.equal(french.calendarCard.fields.title,english.calendarCard.fields.title);
  assert.equal(api.strings('fr'),french);assert.notEqual(english.calendarCard.allDay,'Custom day');
});
test('Malformed locale trees and non-string extra dictionary labels fall back to checked English',()=>{
  for(const value of [[],42,'bad',{calendarCard:[]},{calendarCard:{allDay:42}},{entityCard:{states:{unexpected:42}}}]){
    const api=loadRuntimeI18n();api.PACK.fr=value;
    assert.equal(api.strings('fr'),api.strings('en'));
  }
});
test('Locale overrides cannot change object prototypes through JSON property names',()=>{
  const api=loadRuntimeI18n();api.PACK.fr=JSON.parse('{"__proto__":{"polluted":"yes"},"calendarCard":{"allDay":"Custom"}}');
  const locale=api.strings('fr');
  assert.equal(locale.calendarCard.allDay,'Custom');assert.equal(Object.getPrototypeOf(locale).polluted,undefined);
  assert.equal(Object.prototype.hasOwnProperty.call(locale,'__proto__'),true);
  assert.equal({}.polluted,undefined);
});
test('Malformed or unavailable profile storage preserves Home Assistant language fallback',()=>{
  for(const raw of ['false','0','{}','[]','null','"unsupported"']){
    const api=loadRuntimeI18n({localStorage:{getItem:()=>raw}});
    assert.equal(api.resolveLanguage({locale:{language:'es'}},'auto'),'es');
  }
  const api=loadRuntimeI18n({localStorage:{getItem(){throw new Error('denied');}}});
  assert.equal(api.resolveLanguage({locale:{language:'de'}},'auto'),'de');
  assert.equal(api.resolveLanguage({locale:{language:'de'}},'fr'),'fr');
});
test('UI substitutions preserve zero and false and numeric entity states retain their unit',()=>{
  const api=loadRuntimeI18n();
  assert.equal(api.translateCalendarUi(null,'en','missing.path','{zero}/{flag}/{nil}/{missing}',{zero:0,flag:false,nil:null}),'0/false//');
  const calls=[];const value=api.translateEntityState('es',{entity_id:'sensor.zero',state:'0',attributes:{unit_of_measurement:'°C'}},2,(...args)=>{calls.push(args);return '0,00 °C';},()=>{throw new Error('unit lost');},value=>Number.isFinite(Number(value))?Number(value):null);
  assert.equal(value,'0,00 °C');assert.deepEqual(calls,[['0','°C',2]]);
});
