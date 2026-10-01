import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSync} from 'esbuild';
function load(source='entity-helpers'){const box={};box.window=box;vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),box);vm.runInContext(buildSync({entryPoints:[`src/cards/entity/${source}.ts`],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,box);return box;}
const box=load(),api=box.api,configApi=load('entity-config').api,plain=v=>JSON.parse(JSON.stringify(v));

test('Entity AQ missing readings remain unknown; thresholds and real zero are preserved',()=>{
 const bands=api.resolveMetricGuidelineBands('pm25');
 for(const value of [null,undefined,'',' ',false,{},Infinity]){assert.equal(api.resolveAirQualityLevelFromAqi(value),'unknown');assert.equal(api.resolveAirQualityLevelFromBands(value,bands),'unknown');}
 assert.equal(api.resolveAirQualityLevelFromBands(0,bands),'good');assert.equal(api.resolveAirQualityLevelFromBands('25',bands),'moderate');assert.equal(api.resolveAirQualityLevelFromBands(26,bands),'unhealthy_sensitive');assert.equal(api.resolveAirQualityLevelFromBands(100,[null,{max:'100',level:'custom'}]),'custom');assert.equal(api.resolveMetricGuidelineBands('__proto__'),null);assert.equal(api.worseAirQualityLevel('constructor','moderate'),'moderate');
});

test('Entity nested style guards keep action policies, aliases and independent config clones',()=>{
 for(const styles of [null,false,'invalid',{icon:null},{icon:false,card:[]}]){const config=configApi.normalizeConfig({styles});assert.equal(config.styles.icon.off_color,'var(--primary-text-color)');assert.equal(config.styles.card.padding,'14px');}
 const source={layout:' NETWORK ',network:{entities:['sensor.one',{entity:'sensor.two',role:'DOWNLOAD'}]},air_quality:{pm2_5:' sensor.pm25 ',graph_hours:'',graph_points:null},extension:{marker:1},tap_action:{action:'navigate',navigation_path:'/home'},icon_tap_action:'',hold_action:{action:'call-service',service:'light.turn_on',data:{brightness:128},target:{entity_id:'light.one'}},styles:{icon:{off_color:'var(--state-inactive-color)'},extension:'retired'}};
 const config=configApi.normalizeConfig(source);assert.equal(config.layout,'network');assert.equal(config.network.entities[0].role,'auto');assert.equal(config.network.entities[1].role,'download');assert.equal(config.air_quality.pm25,'sensor.pm25');assert.equal(config.air_quality.graph_hours,24);assert.equal(config.air_quality.graph_points,96);assert.equal(config.tap_action,'navigate');assert.equal(config.navigation_path,'/home');assert.equal(config.icon_tap_action,'');assert.equal(config.hold_action,'service');assert.equal(JSON.parse(config.hold_service_data).brightness,128);assert.equal(config.styles.extension,undefined);assert.equal(config.styles.icon.off_color,'var(--primary-text-color)');assert.deepEqual(plain(config.extension),{marker:1});config.extension.marker=2;assert.equal(source.extension.marker,1);
 assert.equal(configApi.normalizeConfig({air_quality:{graph_hours:0,graph_points:0}}).air_quality.graph_hours,1);assert.equal(configApi.normalizeConfig({air_quality:{graph_hours:0,graph_points:0}}).air_quality.graph_points,8);
});

test('Entity shared history keeps bucket averages, carrying and zero fallback with bounded allocation',()=>{
 const events=[{ts:0,value:2},{ts:5,value:4},{ts:50,value:6},{ts:100,value:0}];assert.deepEqual(plain(api.buildAirQualityInterpolatedSamples(events,0,100,3)),[{ts:0,value:3},{ts:50,value:6},{ts:100,value:0}]);assert.deepEqual(plain(api.buildAirQualityInterpolatedSamples([],0,100,2,0)),[{ts:0,value:0},{ts:100,value:0}]);assert.deepEqual(plain(api.buildAirQualityInterpolatedSamples([null,{ts:1,value:NaN}],0,100,3)),[]);assert.deepEqual(plain(api.buildAirQualityInterpolatedSamples([],0,100,Infinity,0)),[]);assert.equal(api.buildAirQualityInterpolatedSamples([],0,100,100000,0).length,10000);
});

test('Entity malformed SVG and series samples never produce nonfinite paths',()=>{
 for(const points of [null,[null],[{x:Infinity,y:0}],[{x:0,y:0},,{x:1,y:1}]])assert.equal(api.buildAirQualitySmoothPath(points),'');
 const geometry=api.buildAirQualityChartGeometry([null,{kind:'pm25',label:'PM2.5',samples:[null,{ts:1000,value:10},{ts:2000,value:NaN},{ts:3000,value:20}]}]);assert.equal(geometry.paths.length,1);assert.equal(geometry.paths[0].points.length,2);assert.doesNotMatch(geometry.paths[0].linePath,/NaN|Infinity/);const hover=api.getAirQualityHoverPayload(geometry,{kind:'pm25',position:.5});assert.equal(hover.value,15);assert.equal(hover.ts,2000);assert.equal(hover.xPercent,50);
 assert.equal(api.buildAirQualityChartGeometry([{samples:[{ts:0,value:-Number.MAX_VALUE},{ts:1,value:Number.MAX_VALUE}]}]).paths.length,0);
});

test('Entity HA state formatter retains its receiver, fallback text, icons and numeric formatting',()=>{
 const state={entity_id:'lock.front',state:'jammed',attributes:{state_translated:'Blocked'}};const hass={states:{},formatEntityState(){assert.equal(this,hass);return 'Translated';}};assert.equal(api.getHomeAssistantStateDisplayValue(state,hass),'Translated');assert.equal(api.getHomeAssistantStateDisplayValue(state,{states:{},formatEntityState(){throw Error('unavailable');}}),'Blocked');assert.equal(api.getDynamicEntityIcon(state),'mdi:lock-alert');assert.equal(api.formatNumericValue('12,500',Infinity),'12.5');assert.equal(api.formatNumericValueWithUnit('0','°C'),'0°C');assert.equal(api.parseNumericValue('12 watts'),null);assert.equal(api.getSelectEntityOptions({state:'one',attributes:{options:[' one ',null,'two']}}).join(','),'one,two');
});


test('Entity quick service actions retain YAML objects and false/zero values as usable JSON',()=>{
 const data={enabled:false,level:0,nested:{count:0}};const config=configApi.normalizeConfig({quick_actions:[null,false,{type:'service',entity:'light.one',service:'light.turn_on',service_data:data},{icon:42,type:7,entity:[],service:null,service_data:'{"brightness":0}'}]});
 assert.equal(config.quick_actions.length,2);assert.deepEqual(plain(JSON.parse(config.quick_actions[0].service_data)),data);assert.equal(config.quick_actions[1].icon,'mdi:flash');assert.equal(config.quick_actions[1].type,'toggle');assert.equal(config.quick_actions[1].entity,'');assert.equal(config.quick_actions[1].service,'');assert.equal(config.quick_actions[1].service_data,'{"brightness":0}');assert.deepEqual(data,{enabled:false,level:0,nested:{count:0}});
});
