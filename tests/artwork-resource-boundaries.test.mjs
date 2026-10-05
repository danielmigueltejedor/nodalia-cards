import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {buildSync} from 'esbuild';
const source=buildSync({entryPoints:['src/cards/media-player/media-player-artwork.ts'],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text;
test('Shared artwork preload deduplicates, settles stalled image/decode work and allows a later retry',async()=>{
 let sequence=0;const timers=new Map(),images=[];
 const sandbox={Image:class {constructor(){images.push(this);}set src(value){this.url=value;}decode(){return new Promise(()=>{});}},setTimeout:callback=>{const id=++sequence;timers.set(id,callback);return id;},clearTimeout:id=>timers.delete(id)};
 sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const first=sandbox.api.preloadArtworkUrl('/stalled');assert.equal(first,sandbox.api.preloadArtworkUrl('/stalled'));assert.equal(images.length,1);
 assert.equal(timers.size,1,'a stalled preload must have an owned deadline');
 images[0].onload();for(const callback of [...timers.values()])callback();
 assert.equal(await first,false);assert.equal(images[0].onload,null);assert.equal(images[0].onerror,null);assert.equal(timers.size,0);
 const retry=sandbox.api.preloadArtworkUrl('/stalled');assert.notEqual(retry,first);assert.equal(images.length,2);
 images[1].decode=()=>Promise.resolve();images[1].onload();assert.equal(await retry,true);assert.equal(timers.size,0);
});
