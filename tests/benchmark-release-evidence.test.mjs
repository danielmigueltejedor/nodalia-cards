import test from 'node:test';import assert from 'node:assert/strict';
import {summarize} from '../bench/core.mjs';
import {assertOfficialEvidence,buildPerformanceSection,replacePerformanceSection} from '../bench/release-evidence.mjs';
import {scenarios} from '../bench/workloads.mjs';
function evidence(){
 const versions=['2.2.10','3.0.0'],browsers=['chromium','firefox','webkit','webkit-iphone'].map(name=>({name,status:'available',version:'test',viewport:{width:1280,height:720},devicePixelRatio:1,commonCards:['media','graph','advance-vacuum','light']}));
 const samples=[];for(const {name:browser}of browsers)for(const version of versions)for(const scenario of ['cold-startup',...scenarios({commonCards:['media','graph','advance-vacuum','light'],trackUpdates:[50],graphPoints:[1000],gestureMoves:[20],lifecycleCycles:[100]}).map(row=>row.id)])for(let iteration=0;iteration<5;iteration++)samples.push({browser,version,scenario,scope:scenario.startsWith('engine-session')||scenario.includes('/pointer/')?'3.0-only':'common',iteration,metrics:{workMs:version==='2.2.10'?2:3,settleMs:1,totalMs:version==='2.2.10'?3:4,scriptCpuMs:2,usedDelta:16},skipped:[]});
 const assets=versions.map(version=>({version,tag:`v${version}`,sha256:'a'.repeat(64),rawBytes:version==='2.2.10'?100:90,gzipBytes:version==='2.2.10'?20:22,provenance:'github-release-asset'}));
 return {schemaVersion:1,metadata:{mode:'official',harnessDirty:false,harnessCommit:'a'.repeat(40),harnessFilesSha256:'b'.repeat(64),workingTreeDirty:false,timestamp:'2026-10-05',cpu:'reference',platform:'darwin',osRelease:'test',osVersion:'test',architecture:'arm64',ramBytes:1,logicalCpus:1,node:'v22',pnpm:'11',playwright:'test'},config:{iterations:5,warmups:1,assignments:120,quietMs:40,settleTimeoutMs:6000,trackUpdates:[50],graphPoints:[1000],gestureMoves:[20],lifecycleCycles:[100]},versions,assets,bundle:assets,browsers,samples,summary:summarize(samples),errors:[],skips:[]};
}
test('release evidence rejects quick, dirty, errors, unavailable browsers, incomplete samples and wrong release assets',()=>{
 assertOfficialEvidence(evidence(),'3.0.0');
 for(const mutate of [r=>r.metadata.mode='quick',r=>r.metadata.harnessDirty=true,r=>r.errors.push('failed'),r=>r.browsers[1].status='unavailable',r=>r.config.iterations=7,r=>r.assets[1].tag='v3.0.0-beta.1']){const r=evidence();mutate(r);assert.throws(()=>assertOfficialEvidence(r,'3.0.0'));}
 assert.throws(()=>assertOfficialEvidence(evidence(),'3.0.0-rc.1'),/exact published/);
 for(const target of ['2.2.10','3.0.0-beta.1','3.0.0-rc.0','main'])assert.throws(()=>assertOfficialEvidence(evidence(),target),/target must be stable/);
});
test('stable performance section always shows raw and gzip including regressions and traces official JSON',()=>{
 const section=buildPerformanceSection(evidence(),'3.0.0');assert.match(section,/\| Bundle raw \(bytes\) \| 100 \| 90 \| -10\.0%/);assert.match(section,/\| Bundle gzip \(bytes\) \| 20 \| 22 \| 10\.0%/);assert.match(section,/50\.0%/);assert.match(section,/2\.2\.10-vs-3\.0\.0\.json/);assert.match(section,/Chromium test/);
 assert.match(section,/Dashboard mount and settle \(ms\) \| 3\.00 \| 4\.00 \| 33\.3%/);
});
test('post-release notes replace only the marked evidence section and never duplicate figures',()=>{
 const first=buildPerformanceSection(evidence(),'3.0.0');const notes=replacePerformanceSection('# Notes\n',first);const again=replacePerformanceSection(notes,first);assert.equal(notes,again);assert.throws(()=>replacePerformanceSection('<!-- nodalia-performance:start -->',first),/Malformed/);
});
test('RC Firefox exclusion remains explicit and cannot satisfy stable or missing-engine evidence',()=>{
 const r=evidence(),target='3.0.0-rc.1';
 r.versions[1]=target;for(const row of [...r.assets,...r.samples])if(row.version==='3.0.0'){row.version=target;if(row.tag)row.tag=`v${target}`;}
 r.metadata.referenceException='macos-firefox-rc';r.config.browsers=['chromium','webkit','webkit-iphone'];
 Object.assign(r.browsers[1],{status:'unavailable',version:null,excludedByPolicy:true,reason:'Release owner excludes Firefox on this Mac'});
 r.samples=r.samples.filter(row=>row.browser!=='firefox');r.summary=summarize(r.samples);
 assertOfficialEvidence(r,target);const section=buildPerformanceSection(r,target);assert.match(section,/three-engine RC/);assert.match(section,/Firefox performance is unavailable/);assert.doesNotMatch(section,/Full four-engine/);
 for(const mutate of [x=>x.metadata.platform='linux',x=>delete x.browsers[1].excludedByPolicy,x=>x.metadata.referenceException='other',x=>x.browsers[2].status='unavailable',x=>x.config.browsers=['chromium','webkit'],x=>x.versions.push('3.0.0')]){const x=structuredClone(r);mutate(x);assert.throws(()=>assertOfficialEvidence(x,target));}
 const stable=evidence();stable.metadata.referenceException='macos-firefox-rc';assert.throws(()=>assertOfficialEvidence(stable,'3.0.0'),/stable evidence/);
});
