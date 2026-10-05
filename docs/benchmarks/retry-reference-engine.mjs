// Repeat an entire failed engine without selecting favourable individual samples.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,webkit} from '@playwright/test';
import {run} from '../../bench/run.mjs';
import {validateResult,summarize,markdown,csv,sha256} from '../../bench/core.mjs';
import {assertOfficialEvidence} from '../../bench/release-evidence.mjs';

export function combineEngineAttempt(base,retry,engine,provenance) {
 validateResult(base);validateResult(retry);
 if(!['chromium','webkit','webkit-iphone'].includes(engine)||!base.errors.some(e=>e.browser===engine))throw new Error('Repeat only a failed complete engine');
 for(const key of ['harnessFilesSha256','platform','osRelease','osVersion','architecture','cpu','ramBytes','node','pnpm','playwright','referenceException'])
  if(base.metadata[key]!==retry.metadata[key])throw new Error(`Different reference protocol/system: ${key}`);
 if(base.metadata.harnessDirty||retry.metadata.harnessDirty||base.metadata.mode!=='official'||retry.metadata.mode!=='official')throw new Error('Require clean committed official harnesses');
 if(JSON.stringify(base.config)!==JSON.stringify(retry.config)||JSON.stringify(base.versions)!==JSON.stringify(retry.versions)||base.assets.some(a=>retry.assets.find(b=>b.version===a.version)?.sha256!==a.sha256))throw new Error('Different workloads, versions or assets');
 if(retry.errors.some(e=>e.browser===engine)||base.errors.some(e=>e.browser!==engine))throw new Error('Retained or replacement engine has errors');
 const descriptor=retry.browsers.find(b=>b.name===engine),previous=base.browsers.find(b=>b.name===engine);
 if(descriptor?.status!=='available'||descriptor.version!==previous?.version||JSON.stringify(descriptor.viewport)!==JSON.stringify(previous.viewport)||descriptor.devicePixelRatio!==previous.devicePixelRatio)throw new Error('Different browser descriptor');
 const result=structuredClone(base);
 result.samples=[...base.samples.filter(s=>s.browser!==engine),...retry.samples.filter(s=>s.browser===engine)];
 result.skips=[...base.skips.filter(s=>s.browser!==engine),...retry.skips.filter(s=>s.browser===engine)];
 result.errors=[];result.summary=summarize(result.samples);
 result.metadata.engineRetry={engine,method:'Replace the entire failed engine; preserve both original attempts; no individual sample selection',...provenance,originalTimestamp:base.metadata.timestamp,retryTimestamp:retry.metadata.timestamp,retryHarnessCommit:retry.metadata.harnessCommit,originalErrors:base.errors};
 assertOfficialEvidence(result,result.versions.find(v=>/^3\.0\.0-rc\./.test(v)));
 return result;
}
async function main(){
 const [input,engine,output]=process.argv.slice(2);
 if(!input||!output||!['chromium','webkit','webkit-iphone'].includes(engine))throw new Error('Usage: node docs/benchmarks/retry-reference-engine.mjs <failed.json> <engine> <output-directory>');
 const base=JSON.parse(await fs.readFile(input,'utf8'));validateResult(base);
 if(base.metadata.referenceException!=='macos-firefox-rc'||!base.errors.some(e=>e.browser===engine)||base.errors.some(e=>e.browser!==engine))throw new Error('Require one failed engine in an explicitly authorized macOS RC run');
 await fs.mkdir(output,{recursive:true});
 const original=path.join(output,'original-failed.json');await fs.copyFile(input,original);
 const launchChromium=chromium.launch,launchWebkit=webkit.launch;let webkitOrdinal=0;
 // Selection happens at launch only. All measured fixture code/config is unchanged.
 chromium.launch=function(options){if(engine==='chromium')return launchChromium.call(this,options);throw new Error('Excluded from whole-engine retry');};
 webkit.launch=function(options){const name=webkitOrdinal++===0?'webkit':'webkit-iphone';if(name===engine)return launchWebkit.call(this,options);throw new Error('Excluded from whole-engine retry');};
 let retry;try{retry=await run(['--skip-firefox-on-mac',...base.versions,'--out',path.join(output,'retry')]);}finally{chromium.launch=launchChromium;webkit.launch=launchWebkit;}
 const retryFile=path.join(output,'retry',base.versions.join('-vs-')+'.json');
 const result=combineEngineAttempt(base,retry,engine,{originalFile:'original-failed.json',retryFile:path.relative(output,retryFile),orchestratorSha256:sha256(await fs.readFile(fileURLToPath(import.meta.url)))});
 const stem=base.versions.join('-vs-');for(const [ext,data]of [['json',JSON.stringify(result,null,2)+'\n'],['csv',csv(result)],['md',markdown(result)]])await fs.writeFile(path.join(output,`${stem}.${ext}`),data);
 console.log(`${result.samples.length} accepted samples; zero measured-engine errors; original failed attempt retained`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});
