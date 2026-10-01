import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const warnings=[];const sandbox={console:{warn:(...parts)=>warnings.push(parts)}};sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(buildSync({entryPoints:['src/shared/home-assistant-services.ts'],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,sandbox);const {parseServiceData,callHassService,invokeHassService,requestHassService}=sandbox.api;const plain=value=>JSON.parse(JSON.stringify(value));
test('HA service JSON accepts object payloads retaining false/zero and rejects scalar, array and malformed JSON',()=>{
 assert.deepEqual(plain(parseServiceData('{"brightness":0,"enabled":false,"entity_id":["light.one"]}')),{brightness:0,enabled:false,entity_id:['light.one']});
 for(const value of [undefined,null,{},'','{bad','null','false','0','"text"','[1,2]'])assert.deepEqual(plain(parseServiceData(value)),{});
 const input='{"__proto__":{"polluted":true}}';const data=parseServiceData(input);assert.equal(Object.prototype.polluted,undefined);assert.equal(Object.hasOwn(data,'__proto__'),true);
});
test('HA service UI boundary handles missing methods, synchronous throws and rejected promises without retrying',async()=>{
 warnings.length=0;const calls=[];callHassService(null,'light','turn_on');callHassService({states:{}},'light','turn_on');
 const hass={callService:(domain,service,data)=>{calls.push({domain,service,data});if(calls.length===1)throw new Error('offline');if(calls.length===2)return Promise.reject(new Error('rejected'));return Promise.resolve(true);}};
 for(let index=0;index<3;index++)callHassService(hass,'light','turn_on',{brightness:0});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,3);assert.deepEqual(calls.map(call=>call.data),[{brightness:0},{brightness:0},{brightness:0}]);assert.equal(warnings.length,2);assert.equal(warnings[0][1],'light.turn_on');assert.equal(warnings[1][1],'light.turn_on');
});

test('card service invocation preserves compatibility host/context and explicit targets',async()=>{
 warnings.length=0;const host={name:'card'},hass={states:{}},data={brightness:0,enabled:false},target={area_id:'living'};const calls=[];
 sandbox.NodaliaUtils={invokeHomeAssistantService:function(...args){assert.equal(this,sandbox.NodaliaUtils);calls.push(args);return Promise.resolve(true);}};
 invokeHassService(host,hass,'light','turn_on',data,target);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);assert.deepEqual(calls[0],[host,hass,'light','turn_on',data,target]);assert.equal(warnings.length,0);delete sandbox.NodaliaUtils;
});
test('card service invocation handles sync/rejected failures and keeps direct fallback arity',async()=>{
 warnings.length=0;let count=0;sandbox.NodaliaUtils={invokeHomeAssistantService:()=>{if(++count===1)throw new Error('sync');return Promise.reject(new Error('async'));}};
 invokeHassService({},null,'light','turn_on');invokeHassService({},null,'light','turn_on');await new Promise(resolve=>setImmediate(resolve));assert.equal(warnings.length,2);
 delete sandbox.NodaliaUtils;const calls=[];const hass={states:{},callService:(...args)=>{calls.push(args);return Promise.resolve();}};
 invokeHassService({},hass,'light','turn_on',{brightness:0});invokeHassService({},hass,'light','turn_on',{brightness:0},{area_id:'living'});await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,[['light','turn_on',{brightness:0}],['light','turn_on',{brightness:0},{area_id:'living'}]]);
});

test('awaitable card service boundary exposes sync and rejected failures and retains direct arity and compatibility fallback',async()=>{
 const host={},calls=[];const hass={states:{},callService:(...args)=>{calls.push(args);if(calls.length===1)throw new Error('sync');if(calls.length===2)return Promise.reject(new Error('async'));return true;}};
 await assert.rejects(requestHassService(host,hass,'alarm_control_panel','alarm_disarm',{code:'1234'}),/sync/);
 await assert.rejects(requestHassService(host,hass,'alarm_control_panel','alarm_disarm',{code:'1234'}),/async/);
 assert.equal(await requestHassService(host,hass,'alarm_control_panel','alarm_disarm',{code:'1234'},{area_id:'living'}),true);
 assert.equal(calls[0].length,3);assert.equal(calls[1].length,3);assert.deepEqual(calls[2],['alarm_control_panel','alarm_disarm',{code:'1234'},{area_id:'living'}]);
 sandbox.NodaliaUtils={invokeHomeAssistantService:function(...args){assert.equal(this,sandbox.NodaliaUtils);calls.push(args);return true;}};
 const missing={states:{}};assert.equal(await requestHassService(host,missing,'alarm_control_panel','alarm_disarm',{code:'1234'}),true);assert.deepEqual(calls.at(-1),[host,missing,'alarm_control_panel','alarm_disarm',{code:'1234'},null]);delete sandbox.NodaliaUtils;
});
