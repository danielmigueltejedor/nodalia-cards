import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, referencePolicy, percentile, statistics, sampleOrder, hasSkips, summarize, csvEscape, csv, markdown, verifyAsset, loadAsset, sha256, validateResult } from '../bench/core.mjs';

test('explicit Firefox reference exception is confined to official macOS RC evidence',()=>{
 const args=['--skip-firefox-on-mac','2.2.10','3.0.0-beta.1','3.0.0-rc.1'];
 assert.deepEqual(referencePolicy(parseArgs(args),'darwin'),{browsers:['chromium','webkit','webkit-iphone'],referenceException:'macos-firefox-rc'});
 for(const [input,platform] of [[args,'linux'],[[...args,'--quick'],'darwin'],[[...args,'--browsers','chromium'],'darwin'],[[...args,'3.0.0'],'darwin'],[['--skip-firefox-on-mac','2.2.10','3.0.0-beta.1'],'darwin']])assert.throws(()=>referencePolicy(parseArgs(input),platform),/exception requires/);
 assert.throws(()=>referencePolicy(parseArgs(['2.2.10','3.0.0','--browsers','chromium']),'darwin'),/all four/);
 assert.equal(referencePolicy(parseArgs(['2.2.10','3.0.0']),'darwin').browsers.length,4);
});

test('benchmark CLI ignores pnpm -- separator, accepts N releases and normalizes v tags',()=>{
 assert.deepEqual(parseArgs(['--','v2.2.10','3.0.0-beta.1','3.0.0-rc.1']).versions,['2.2.10','3.0.0-beta.1','3.0.0-rc.1']);
 assert.equal(parseArgs(['2.2.10','3.0.0','--'],{NODALIA_BENCH_QUICK:'1'}).quick,true);
 for(const args of [[],['2.2.10'],['2.2.10','2.2.10'],['2.2.10','main'],['2.2.10','--bad'],['2.2.10','3.0.0','--out'],['2.2.10','3.0.0','--browsers','chromium,chromium']])assert.throws(()=>parseArgs(args));
});
test('benchmark statistics preserve raw ordering, median handles even counts and p95 uses nearest rank',()=>{
 const input=[8,1,4,3];assert.deepEqual(statistics(input),{samples:4,min:1,max:8,mean:4,median:3.5,p95:8});assert.deepEqual(input,[8,1,4,3]);
 assert.equal(percentile(Array.from({length:100},(_,i)=>i+1),.95),95);assert.equal(statistics([]).median,null);assert.throws(()=>statistics([NaN]));
});
test('benchmark ABBA sampling does not mutate the N-version list',()=>{
 const versions=['a','b','c'];assert.deepEqual(sampleOrder(versions,0),versions);assert.deepEqual(sampleOrder(versions,1),['c','b','a']);assert.deepEqual(versions,['a','b','c']);
});
test('benchmark empty skipped arrays are successful; actual skips and runtime errors are excluded',()=>{
 const sample={browser:'chromium',version:'3.0.0',scenario:'mount',scope:'common',metrics:{workMs:10},skipped:[]};assert.equal(hasSkips(sample),false);
 const summary=summarize([sample,{...sample,skipped:['unavailable']},{...sample,error:'runtime'},{...sample,errors:['runtime']}]);assert.equal(summary[0].metrics.workMs.samples,1);
});
test('unavailable browser launch is explicit error evidence rather than a successful skip',async()=>{
 const {launchBrowser}=await import('../bench/run.mjs');
 assert.deepEqual(await launchBrowser({launch:async()=>{throw new Error('missing browser');}},{}),{browser:null,error:{stage:'launch',error:'missing browser'}});
 const browser={};assert.equal((await launchBrowser({launch:async()=>browser},{})).browser,browser);
});
test('CSV protects commas, quotes, CR and newline without changing plain values',()=>{
 assert.equal(csvEscape('a,b'),'"a,b"');assert.equal(csvEscape('a"b'),'"a""b"');assert.equal(csvEscape('a\nb'),'"a\nb"');assert.equal(csvEscape(0),'0');
});
const bytes=Buffer.from('window.fixture = true;');
const release=version=>({id:1,tag_name:`v${version}`,draft:false,published_at:'2026-10-05T00:00:00Z',assets:[{id:1,name:'nodalia-cards.js',size:bytes.length,digest:`sha256:${sha256(bytes)}`,browser_download_url:`https://github.com/danielmigueltejedor/nodalia-cards/releases/download/v${version}/nodalia-cards.js`}]});
test('exact release asset verification rejects missing assets, tag confusion, size drift and checksum drift',()=>{
 assert.equal(verifyAsset(release('3.0.0'),bytes,'3.0.0').provenance,'github-release-asset');
 assert.throws(()=>verifyAsset({...release('3.0.0'),assets:[]},bytes,'3.0.0'),/no nodalia/);
 assert.throws(()=>verifyAsset(release('3.0.0'),bytes,'2.2.10'),/exact tag/);
 assert.throws(()=>verifyAsset(release('3.0.0'),Buffer.from('bad'),'3.0.0'),/size mismatch/);
 const bad=release('3.0.0');bad.assets[0].digest='sha256:'+'0'.repeat(64);assert.throws(()=>verifyAsset(bad,bytes,'3.0.0'),/digest mismatch/);
});
test('automatic downloads record release provenance, cache success and fail clearly for nonexistent versions',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nodalia-benchmark-test-'));
 try{
  let calls=0;const fetcher=async url=>{calls++;return new URL(url).hostname==='api.github.com'?{ok:true,json:async()=>release('3.0.0')}:{ok:true,arrayBuffer:async()=>bytes};};
  const asset=await loadAsset('3.0.0',directory,fetcher);assert.equal(asset.sha256,sha256(bytes));assert.equal(calls,2);
  await loadAsset('3.0.0',directory,()=>{throw new Error('Unexpected cache network');});
  await assert.rejects(loadAsset('9.9.9',directory,async()=>({ok:false,status:404})),/HTTP 404/);
  assert.equal(await fs.stat(path.join(directory,'9.9.9')).then(()=>true,()=>false),false);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
test('download paths and destinations reject traversal and untrusted manifest URLs before asset I/O',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nodalia-benchmark-boundary-'));
 try{
  for(const version of ['../escape','3.0.0/../escape','https://example.com',null])await assert.rejects(loadAsset(version,directory,()=>{throw new Error('Network must not run');}),/Invalid release version/);
  for(const url of ['https://evil.example/nodalia-cards.js','https://github.com.evil.example/nodalia-cards.js','https://github.com/danielmigueltejedor/nodalia-cards/releases/download/v3.0.0/other.js','https://github.com/danielmigueltejedor/nodalia-cards/releases/download/v3.0.0/../../other']){
   const bad=release('3.0.0');bad.assets[0].browser_download_url=url;
   assert.throws(()=>verifyAsset(bad,bytes,'3.0.0'),/Untrusted release asset URL/);
   let calls=0;await assert.rejects(loadAsset('3.0.0',directory,async()=>{calls++;return {ok:true,json:async()=>bad};}),/Untrusted release asset URL/);assert.equal(calls,1);
  }
  assert.equal(await fs.stat(path.join(directory,'3.0.0')).then(()=>true,()=>false),false);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});
function result(){
 const samples=[{browser:'chromium',version:'2.2.10',iteration:0,scenario:'mount/media',scope:'common',metrics:{workMs:1,settleMs:2,totalMs:3},skipped:[]},{browser:'chromium',version:'3.0.0',iteration:0,scenario:'mount/media',scope:'common',metrics:{workMs:2,settleMs:2,totalMs:4},skipped:[]}];
 const assets=['2.2.10','3.0.0'].map(version=>verifyAsset(release(version),bytes,version));
 return {schemaVersion:1,metadata:{mode:'official',timestamp:'2026-10-05',harnessCommit:'a'.repeat(40),harnessFilesSha256:'b'.repeat(64),harnessDirty:false,workingTreeDirty:false,platform:'darwin',osRelease:'test',osVersion:'test',architecture:'arm64',cpu:'fixture',ramBytes:1,logicalCpus:1,node:'v22',pnpm:'11',playwright:'test'},versions:['2.2.10','3.0.0'],assets,bundle:assets,config:{iterations:1,warmups:0,assignments:120,quietMs:40,settleTimeoutMs:6000},browsers:[{name:'chromium',status:'available',version:'fixture',viewport:{width:1280,height:720},devicePixelRatio:1},{name:'firefox',version:null,status:'unavailable'}],samples,summary:summarize(samples),skips:[],errors:[{browser:'firefox',stage:'launch',error:'unavailable'}]};
}
test('schema enforces published provenance, finite samples, consistent times and summaries derived from raw samples',()=>{
 assert.equal(validateResult(result()).schemaVersion,1);
 for(const mutate of [r=>r.schemaVersion=2,r=>delete r.assets,r=>r.samples[0].metrics.totalMs=9,r=>r.samples[0].metrics.workMs=Infinity,r=>r.assets[0].provenance='working-tree',r=>r.summary=[]]){const r=result();mutate(r);assert.throws(()=>validateResult(r),/schema v1/);}
});
test('Markdown shows all versions, slower deltas, browser unavailability and runtime errors without browser averaging',()=>{
 const r=result(),text=markdown(r);assert.match(text,/33\.3%/);assert.match(text,/firefox \(unavailable\)/);assert.match(text,/"stage": "launch"/);assert.match(text,/p95/);assert.match(csv(r),/chromium,3.0.0,mount\/media/);
});
