import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSync} from 'esbuild';
function load(source='power-flow-helpers') {const box={};box.window=box;vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),box);vm.runInContext(buildSync({entryPoints:[`src/cards/power-flow/${source}.ts`],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,box);return box;}
const box=load(), api=box.api, plain=v=>JSON.parse(JSON.stringify(v));

test('Power Flow SVG conversion retains all command geometry and packed arc flags',()=>{
 const cases=[['M 10 20 L 30 40','M 0 0 L 20 20'],['m 10 20 l 5 7','M 0 0 l 5 7'],['M 10 20 H 35 V 50','M 0 0 H 25 V 30'],['M10 20C10 20 20 30 30 40','M 0 0 C 0 0 10 10 20 20'],['M10 20S20 30 30 40Q40 50 50 60T60 70','M 0 0 S 10 10 20 20 Q 30 30 40 40 T 50 50'],['M 10 20 A 5 5 0 0115 25 Z','M 0 0 A 5 5 0 0 1 5 5 Z']];
 for(const [source,path] of cases) {const actual=api.getSvgRelativeMotionPath(source);assert.deepEqual(plain(actual.start),{x:10,y:20});assert.equal(actual.path,path);}
});

test('Power Flow malformed SVG paths terminate within a bounded VM call and never emit NaN',()=>{
 for(const source of ['M 0 0 Z 1','M 0 0 z 1 2','M 0 0 L 1','M 0 0 A 1 1 0 3 0 1 1','M 0 0 C 1 2','M 0 0 L 1e999 2']) {
  const output=vm.runInContext(`api.getSvgRelativeMotionPath(${JSON.stringify(source)})`,box,{timeout:500});assert.equal(output.path,'M 0 0');
 }
 const reader=api.createSvgTokenReader(['M','1']);reader.index=-5;assert.equal(reader.index,0);reader.index=Infinity;assert.equal(reader.hasMore(),false);
});

test('Power Flow formatting keeps absence distinct from zero and does not drop whole kilowatt trailing digits',()=>{
 for(const value of [null,undefined,'',' ',false,{},Infinity]) {assert.equal(api.parseNumber(value),null);assert.equal(api.formatRawValue(value),'--');assert.equal(api.formatDisplayValue(value,'W').value,'--');}
 assert.equal(api.parseNumber('2,5'),2.5);assert.equal(api.formatDisplayValue(0,'W').value,'0');
 assert.deepEqual(plain(api.formatDisplayValue(10000,'W','en')),{value:'10',unit:'kW'});
 assert.deepEqual(plain(api.formatDisplayValue(100000,'W','es')),{value:'100',unit:'kW'});
 assert.equal(api.formatDisplayValue(10500,'W','es').value,'10,5');assert.equal(api.formatDisplayValue(-10000,'W','en').value,'-10');
});

test('Power Flow config guards nested entity/chip blocks and preserves individual editor rows',()=>{
 const configApi=load('power-flow-config').api;
 const source={entities:{grid:{entity:{consumption:'sensor.in',production:'sensor.out'}},individual:[null,{entity:'',name:'Draft'},{entity:'sensor.one',secondary_info:{entity:'sensor.temp'}}]},consumption_chips:{day_entity:' sensor.day '},extension:{marker:1}};
 const config=configApi.normalizeConfig(source);assert.equal(config.entities.individual.length,2);assert.equal(config.entities.individual[0].name,'Draft');assert.equal(config.consumption_chips.day_entity,'sensor.day');assert.equal(config.entities.grid.entity.consumption,'sensor.in');assert.deepEqual(plain(config.extension),{marker:1});assert.equal(source.consumption_chips.day_entity,' sensor.day ');
 const invalid=configApi.normalizeConfig({entities:true,consumption_chips:false,styles:false});assert.equal(invalid.entities.grid.entity,'');assert.equal(invalid.consumption_chips.day_entity,'');assert.equal(invalid.styles.card.padding,'12px');invalid.entities.grid.entity='changed';assert.equal(configApi.DEFAULT_CONFIG.entities.grid.entity,'');
 assert.equal(api.getEditorColorFallbackValue('display_zero_lines.grey_color'),'rgb(189, 189, 189)');
});

test('Power Flow layout retains branch positions and invalid coordinates do not create SVG paths',()=>{
 assert.deepEqual(plain(api.getNodePositionForLayout('solar',0,0,false,'full',{hasSolar:true,hasGrid:true,hasBattery:false})),{x:50,y:20.5});
 assert.deepEqual(plain(api.getNodePositionForLayout('home')),{x:82,y:52});
 assert.equal(api.buildFlowPath({x:0,y:0},{x:100,y:50}),'M 0.00 0.00 L 85.50 0.00 A 14.50 14.50 0 0 1 100.00 14.50 L 100.00 50.00');
 for(const value of [null,{x:NaN,y:0},{x:1,y:Infinity}]) {assert.equal(api.buildFlowPath(value,{x:0,y:0}),'');assert.equal(api.buildStraightFlowPath({x:0,y:0},value),'');}
 assert.equal(Number.isFinite(api.getNodePositionForLayout('individual',Infinity,Infinity).x),true);
 const rows=[1,2,3];assert.equal(api.moveItem(rows,0.5,2),undefined);assert.deepEqual(rows,[1,2,3]);assert.equal(api.moveItem(rows,0,2),undefined);assert.deepEqual(rows,[2,3,1]);
});

test('Power Flow source topology preserves split entity semantics and separate popup/diagram counts',()=>{
 const config={entities:{home:{entity:'sensor.home'},solar:{entity:{production:'sensor.solar'}},individual:[{entity:'sensor.one'},{entity:''}]}};
 const flags=api.getFlowLayoutFlagsFromConfig(config);assert.equal(flags.hasGrid,true);assert.equal(flags.hasSolar,true);assert.equal(flags.hasBattery,false);assert.equal(flags.individualCount,0);
 assert.equal(api.getDiagramIndividualCount({...config,show_home_device_popup:false}),1);assert.equal(api.getLayoutPreset({top:3,bottom:0,individual:1}),'compact');assert.equal(api.getLayoutPreset({top:3,bottom:2,individual:1}),'full');
});
