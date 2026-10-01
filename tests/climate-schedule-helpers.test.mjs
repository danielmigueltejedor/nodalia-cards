import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSync} from 'esbuild';
function load(source='climate-schedule'){const box={Date,btoa,atob};box.window=box;vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),box);vm.runInContext(buildSync({entryPoints:[`src/cards/climate/${source}.ts`],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,box);return box.api;}
const api=load(),configApi=load('climate-config'),plain=v=>JSON.parse(JSON.stringify(v));
const slot=(extra={})=>({id:'one',day:'mon',start:'08:00',end:'12:00',temperature:21,enabled:true,...extra});

test('Climate schedule keeps blank setpoints and dual bounds absent while retaining real zero',()=>{
 const missing=api.normalizeSetpointScheduleSlot(slot({temperature:'',target_temp_low:null,target_temp_high:''}));assert.equal(missing.temperature,21);assert.equal(missing.target_temp_low,undefined);assert.equal(missing.target_temp_high,undefined);
 const zero=api.normalizeSetpointScheduleSlot(slot({temperature:0,target_temp_low:0,target_temp_high:5,fan_mode:' Quiet ',preset_mode:' Eco ',hvac_mode:'COOL'}));assert.equal(zero.temperature,0);assert.equal(zero.target_temp_low,0);assert.equal(zero.target_temp_high,5);assert.equal(zero.fan_mode,'Quiet');assert.equal(zero.preset_mode,'Eco');assert.equal(zero.hvac_mode,'cool');assert.equal(api.normalizeSetpointScheduleSlot(null).temperature,21);assert.equal(api.parseScheduleClockMinutes('24:00'),null);assert.equal(api.parseScheduleClockMinutes('08:60'),null);
});

test('Climate corrupt packed and base64 storage never invents a schedule slot',()=>{
 for(const value of [null,'',NaN,Infinity,-1,1.5,2**32,7<<18,511])assert.equal(api.unpackSetpointSchedulePacked(value),null);
 assert.deepEqual(plain(api.decodeSetpointScheduleBinaryBase64('%%%')),[]);assert.deepEqual(plain(api.decodeSetpointScheduleStorageState('{"v":2,"s":[null,-1,"bad"]}').slots),[]);assert.deepEqual(plain(api.decodeSetpointScheduleStorageState('{"v":1,"s":[[0,null,60,21],[null,0,60,21]]}').slots),[]);assert.deepEqual(plain(api.decodeSetpointScheduleStorageState('{"v":3,"b":"%%%"}').slots),[]);
});

test('Climate all weekdays, quarter-degree values and disabled slots survive binary storage',()=>{
 const slots=['mon','tue','wed','thu','fri','sat','sun'].map((day,index)=>slot({id:day,day,temperature:20+index/4,enabled:index%2===0}));const encoded=api.encodeSetpointScheduleBinaryBase64(slots),decoded=api.decodeSetpointScheduleBinaryBase64(encoded,100000);
 assert.equal(decoded.length,7);for(let index=0;index<7;index++){assert.equal(decoded[index].day,slots[index].day);assert.equal(decoded[index].temperature,slots[index].temperature);assert.equal(decoded[index].enabled,slots[index].enabled);assert.equal(decoded[index].start,'08:00');assert.equal(decoded[index].end,'12:00');}
 assert.equal(api.decodeSetpointScheduleBinaryBase64(encoded,2).length,2);assert.equal(api.encodeSetpointScheduleStorageState({enabled:false,slots:[]}),'{"v":1,"s":[],"e":0}');
});

test('Climate agenda gaps, active-slot precedence and track bounds preserve valid timing',()=>{
 const rows=[null,slot(),slot({id:'two',start:'09:00',end:'10:00'})],date=new Date(2026,9,5,9,30);assert.equal(api.getActiveSetpointScheduleSlot(rows,date).id,'two');assert.equal(api.getActiveSetpointScheduleSlot([slot({day:'invalid'})],date),null);assert.equal(api.getActiveSetpointScheduleSlot([slot({enabled:false})],date),null);assert.deepEqual(plain(api.findScheduleGapForDay([null,slot()],'mon')),{start:720,end:1439});assert.deepEqual(plain(api.getSetpointScheduleBlockLayout(null)),{start:0,end:60,left:0,width:60/1440*100});
 const track={getBoundingClientRect:()=>({left:10,width:100})};assert.equal(api.scheduleMinutesFromTrackClientX(track,60),720);assert.equal(api.scheduleMinutesFromTrackClientX(track,Infinity),0);assert.equal(api.scheduleMinutesFromTrackClientX({getBoundingClientRect:()=>({left:0,width:0})},0),0);
});

test('Climate webhook builders guard records and retain service, storage and automation payloads',()=>{
 const body=api.buildClimateSetpointScheduleWebhookBody({entityId:'climate.one',storageEntityId:'input_text.schedule',friendlyName:'One',schedule:{enabled:true,slots:[slot()]}});assert.equal(body.entity_id,'climate.one');assert.equal(body.ha_action.action,'input_text.set_value');assert.equal(body.ha_action.data.value,body.storage_state);assert.equal(body.automation_specs[0].action[0].action,'climate.set_temperature');assert.equal(body.automation_specs[0].action[0].data.temperature,21);assert.match(body.automation_yaml_bundle,/at: '08:00:00'/);assert.deepEqual(plain(body.automation_specs[0].condition[0].weekday),['mon']);assert.equal(api.buildClimateSetpointScheduleWebhookBody(false).ha_action,null);assert.deepEqual(plain(api.buildClimateSetpointScheduleAutomationSpecs('climate.one',{slots:[null,false]})),[]);assert.equal(api.yamlQuote("One's room"),"'One''s room'");
});

test('Climate config projects malformed nested YAML instead of asserting security and style shapes',()=>{
 const config=configApi.normalizeConfig({security:false,styles:{icon:false,dial:null},haptics:null,animations:false,display:false});assert.equal(config.styles.icon.size,'58px');assert.equal(config.security.strict_service_actions,true);assert.deepEqual(plain(config.security.allowed_service_domains),['climate']);assert.equal(config.haptics.enabled,false);assert.equal(config.animations.enabled,true);assert.equal(config.display.main_temperature,'target');
 const source={entity:'climate.one',security:{allowed_services:[' LIGHT.TURN_ON '],allow_webhooks_for_non_admin:true},styles:{dial:{track_color:'var(--divider-color)'},extension:'discard'},haptics:{scrolls:{temperature_dial:false}},display:{main_temperature:'current'},extension:{marker:1}};const normalized=configApi.normalizeConfig(source);assert.equal(normalized.security.allow_webhooks_for_non_admin,true);assert.deepEqual(plain(normalized.security.allowed_services),['light.turn_on']);assert.equal(normalized.haptics.scrolls.temperature_dial,false);assert.equal(normalized.display.main_temperature,'current');assert.equal(normalized.styles.extension,undefined);normalized.extension.marker=2;assert.equal(source.extension.marker,1);
});
