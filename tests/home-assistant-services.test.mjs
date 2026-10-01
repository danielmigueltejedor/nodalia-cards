import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const warnings=[];const sandbox={console:{warn:(...parts)=>warnings.push(parts)}};vm.createContext(sandbox);vm.runInContext(buildSync({entryPoints:['src/shared/home-assistant-services.ts'],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,sandbox);const {parseServiceData,callHassService}=sandbox.api;const plain=value=>JSON.parse(JSON.stringify(value));
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
