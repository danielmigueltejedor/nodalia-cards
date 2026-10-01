import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {buildSync} from 'esbuild';
function load(){const box={URL};box.window=box;box.location={origin:'https://ha.example'};vm.createContext(box);vm.runInContext(fs.readFileSync('nodalia-utils.js','utf8'),box);vm.runInContext(buildSync({entryPoints:['src/cards/news/news-helpers.ts'],bundle:true,write:false,format:'iife',globalName:'api'}).outputFiles[0].text,box);return box;}
const box=load(),api=box.api,plain=v=>JSON.parse(JSON.stringify(v));const item=extra=>api.normalizeNewsItem({title:'Headline',summary:'Before',published:'2026-10-01T00:00:00Z',url:'https://example.com/article',image:'https://example.com/one.png',...extra},{entity:'sensor.news'});

test('News timestamp boundaries reject out-of-range dates and retain epoch zero identity',()=>{
 for(const value of [null,undefined,'',NaN,Infinity,Number.MAX_VALUE,'999999999999999999999999999'])assert.equal(api.parsePublishedMs(value),null);const zero=api.normalizeNewsItem({title:'Epoch',published:0});assert.equal(zero.publishedMs,0);assert.equal(zero.publishedISO,'1970-01-01T00:00:00.000Z');assert.match(zero.id,/::0$/);assert.equal(api.restoreNewsHistoryItem({title:'Bad date',publishedMs:Number.MAX_VALUE}).publishedMs,null);assert.equal(api.normalizeNewsItem({title:'Bad date',published:Number.MAX_VALUE}).publishedISO,'');assert.equal(api.parsePublishedMs(1750000000),1750000000000);assert.equal(api.formatRelativePublished(NaN,()=>{throw Error('must stay absent');},'en'),'');
});

test('News source records, encoded/numeric-key feeds and per-source filters keep valid items',()=>{
 const rows={0:{title:'Alpha',published:'2026-10-01T02:00:00Z'},2:{title:'Alpha newer',published:'2026-10-01T03:00:00Z'},1:null};assert.equal(api.coerceNewsAttributeList(JSON.stringify(rows)).length,2);assert.deepEqual(plain(api.resolveSourceEntries({entity:'sensor.legacy',sources:[null,{entity:'sensor.news',name:'Feed'}]})),[{entity:'sensor.legacy',name:'',icon:'',category:''},{entity:'sensor.news',name:'Feed',icon:'',category:''}]);const hass={states:{'sensor.news':{entity_id:'sensor.news',state:'ready',attributes:{items:rows}}}};const selected=api.getNewsItemsForConfig(hass,{sources:[{entity:'sensor.news'}],filters:{include_keywords:['alpha'],max_per_source:1}});assert.equal(selected.length,1);assert.equal(selected[0].title,'Alpha newer');assert.equal(api.isSafeHttpUrl('javascript:alert(1)'),false);assert.equal(api.sanitizeImageUrl('/local/image.jpg'),'/local/image.jpg');
});

test('News render/history stamps invalidate summaries, images, links and articles after the first twelve',()=>{
 const rows=Array.from({length:20},(_,index)=>item({title:'Article '+index}));const stamp=api.buildNewsRenderStamp(rows);for(const field of ['summary','image','url','sourceCategory']){const changed=rows.map(row=>({...row}));changed[15][field]='Changed '+field;assert.notEqual(api.buildNewsRenderStamp(changed),stamp);}
 const old=item({summary:'Before'}),updated=item({summary:'After',image:'https://example.com/two.png'});const merged=api.mergeNewsItemHistory([old],[updated],5);assert.equal(merged.length,1);assert.equal(merged[0].summary,'After');assert.equal(merged[0].image,'https://example.com/two.png');assert.notEqual(api.buildNewsRenderStamp(merged),api.buildNewsRenderStamp([old]));
});

test('News malformed identified history rows are restored safely without trusting their id',()=>{
 const rows=api.mergeNewsItemHistory([null,{id:'bad',title:12,publishedMs:Infinity,url:'javascript:alert(1)'},{id:'missing-title'},{title:'Valid',publishedMs:'0'}],[],5);assert.equal(rows.length,2);for(const row of rows){assert.equal(typeof row.title,'string');assert.equal(row.url,'');assert.notEqual(row.id,'bad');}assert.equal(rows.find(row=>row.title==='Valid').publishedISO,'1970-01-01T00:00:00.000Z');
 const compact=api.encodeCompactNewsHistoryEntry(item());const restored=api.parseNewsHistoryFromHelperState(JSON.stringify([compact,null]));assert.equal(restored.length,1);assert.equal(restored[0].title,'Headline');assert.equal(api.fitNewsHistoryPayloadToLimit([compact,compact],255).length<=255,true);const cyclic=[];cyclic.push(cyclic);assert.equal(api.fitNewsHistoryPayloadToLimit(cyclic),'[]');
});

test('News helper writes keep synchronous acceptance, handle async failure and avoid unsafe targets',async()=>{
 const calls=[],hass={states:{},callService:(...args)=>{calls.push(args);return Promise.reject(Error('backend unavailable'));}};assert.equal(api.writeNewsHistoryToHelper(hass,'input_text.news',[item()]),true);assert.equal(calls[0][0],'input_text');assert.equal(calls[0][1],'set_value');assert.equal(calls[0][2].value.length<=255,true);assert.equal(api.writeNewsHistoryToHelper(hass,'light.one',[item()]),false);assert.equal(calls.length,1);await new Promise(resolve=>setImmediate(resolve));assert.equal(api.writeNewsHistoryToHelper({states:{},callService(){throw Error('sync');}},'text.news',[]),false);
});

test('News object editor paths preserve numeric keys and reject inherited or unsafe mutation',()=>{
 const base={};api.setByPath(base,'sources.0.entity','sensor.news');assert.deepEqual(plain(base),{sources:{0:{entity:'sensor.news'}}});api.deleteByPath(base,'sources.0.entity');assert.deepEqual(plain(base),{sources:{0:{}}});const inherited={nested:{}};const target=Object.create(inherited);api.setByPath(target,'nested.value',1);assert.equal(inherited.nested.value,undefined);assert.equal(target.nested.value,1);api.setByPath(target,'__proto__.polluted',1);assert.equal({}.polluted,undefined);
});
