import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSync} from 'esbuild';
function load(source='room-summary-config'){const box={};box.window=box;vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),box);vm.runInContext(fs.readFileSync('nodalia-room-summary-model.js','utf8'),box);vm.runInContext(buildSync({entryPoints:[`src/cards/room-summary/${source}.ts`],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,box);return box.api;}
const api=load(),model=load('room-summary-model'),plain=v=>JSON.parse(JSON.stringify(v));

test('Summary config retains legacy metric/list aliases, hub layout and hidden YAML extensions',()=>{
 const source={name:' Room ',layout:'compact',density:'old',temperature_entity:'sensor.temp',occupancy_entity:'binary_sensor.presence',light_entities:['light.one','light.one'],vacuum:'vacuum.one',extension:{marker:1}};
 const config=api.normalizeConfig(source);assert.equal(config.name,'Room');assert.equal(config.layout,'hub');assert.equal(config.density,undefined);assert.equal(config.temperature,'sensor.temp');assert.equal(config.presence,'binary_sensor.presence');assert.equal(config.occupancy,'binary_sensor.presence');assert.deepEqual(plain(config.lights),['light.one']);assert.deepEqual(plain(config.vacuums),['vacuum.one']);assert.deepEqual(plain(config.extension),{marker:1});assert.equal(source.layout,'compact');
});

test('Summary camera/media records are independently cloned and duplicate player IDs are removed',()=>{
 const source={camera_config:{cameras:['camera.one','camera.two'],extra:{value:1}},media_config:{players:[null,{entity:'media_player.one',extra:{value:1}},{entity:'media_player.two'}]},media_players:['media_player.one','media_player.three']};
 const config=api.normalizeConfig(source);assert.equal(config.camera,'camera.one');assert.equal(config.camera_config.entity,'camera.one');assert.equal(config.media_player,'media_player.one');assert.deepEqual(plain(config.media_players),['media_player.three']);assert.deepEqual(plain(api.hubMediaPlayerIds(config)),['media_player.one','media_player.three','media_player.two']);
 config.camera_config.extra.value=2;config.media_config.players[0].extra.value=2;assert.equal(source.camera_config.extra.value,1);assert.equal(source.media_config.players[1].extra.value,1);
 const invalid=api.normalizeConfig({camera_config:false,media_config:{players:'bad'},embed_options:false});assert.deepEqual(plain(invalid.camera_config),{});assert.deepEqual(plain(invalid.media_config.players),[]);assert.deepEqual(plain(invalid.embed_options.lights),[]);
});

test('Summary embed options match entity IDs before positional fallbacks and keep native lock IDs',()=>{
 const config=api.normalizeConfig({lights:['light.one','light.two'],locks:['lock.front'],embed_options:{lights:[{entity:'light.two',name:'Two',extra:1},{entity:'light.one',icon:'mdi:lamp'}]}});
 assert.equal(config.embed_options.lights[0].icon,'mdi:lamp');assert.equal(config.embed_options.lights[1].name,'Two');assert.equal(config.embed_options.lights[1].extra,1);assert.deepEqual(plain(config.locks),['lock.front']);assert.equal(config.show_media,true);
});

test('Summary reuses its actual normalized object and does not trust a forged marker as a typed config',()=>{
 const config=api.normalizeConfig({name:'Room',lights:['light.one']});assert.equal(api.normalizeConfig(config),config);
 const symbol=Object.getOwnPropertySymbols(config)[0];assert.equal(Object.getOwnPropertyDescriptor(config,symbol).enumerable,false);
 const forged={name:' Another ',lights:'light.two',[symbol]:true};const normalized=api.normalizeConfig(forged);assert.notEqual(normalized,forged);assert.equal(normalized.name,'Another');assert.deepEqual(plain(normalized.lights),['light.two']);
 assert.equal(api.hasRoomContent(),false);assert.deepEqual(plain(api.hubMediaPlayerIds()),[]);
});

test('Summary metrics keep blank values absent and real zero visible while preserving nonnumeric state text',()=>{
 const state=value=>({entity_id:'sensor.temp',state:value,attributes:{unit_of_measurement:'°C'}});
 for(const value of [null,undefined,'',' ',false,{},Infinity])assert.equal(model.finiteNumber(value),null);
 assert.equal(model.formatMetric(state('')),'—');assert.equal(model.formatMetric(state(' ')),'—');assert.equal(model.formatMetric(state('0')),'0°C');assert.equal(model.formatMetric(state('status')),'status');assert.equal(model.formatMetric(state(' status ')),' status ');
 const summary=api.buildRoomSummary({states:{'sensor.temp':state('')}},{temperature:'sensor.temp'});assert.equal(summary.temperature,'—');
});
