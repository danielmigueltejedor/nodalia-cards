import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResult, markdown, csv, delta, summarize } from './core.mjs';

import { scenarios } from './workloads.mjs';

export const SECTION_START='<!-- nodalia-performance:start -->';
export const SECTION_END='<!-- nodalia-performance:end -->';
const engines=['chromium','firefox','webkit','webkit-iphone'];
function requiredEngines(result,target) {
 if (!result.metadata.referenceException) return engines;
 const excluded=result.browsers.find(b=>b.name==='firefox');
 const required=engines.filter(name=>name!=='firefox');
 if(result.metadata.referenceException!=='macos-firefox-rc'||result.metadata.platform!=='darwin'||
    !/^3\.0\.0-rc\.[1-9]\d*$/.test(target)||result.versions.includes('3.0.0')||
    excluded?.status!=='unavailable'||excluded.excludedByPolicy!==true||!excluded.reason||
    result.samples.some(row=>row.browser==='firefox')||
    result.config.browsers?.length!==3||!required.every(name=>result.config.browsers.includes(name)))
   throw new Error('Invalid macOS Firefox RC exception; stable evidence still requires all four engines');
 return required;
}
export function assertOfficialEvidence(result,target) {
 if(!/^3\.0\.0(?:-rc\.[1-9]\d*)?$/.test(target||''))throw new Error('Release notes evidence target must be stable 3.0.0 or its release candidate');
 validateResult(result);
 if(result.metadata.mode!=='official'||result.metadata.harnessDirty)throw new Error('Release evidence requires an official run from a clean committed harness');
 if(!result.versions.includes('2.2.10')||!result.versions.includes(target))throw new Error(`Evidence must compare exact published 2.2.10 and ${target} assets`);
 if(result.errors.length)throw new Error('Benchmark has errors; release performance notes are blocked');
 if(result.config.iterations<5||result.config.warmups<1)throw new Error('Insufficient official iterations/warmups');
 const required=requiredEngines(result,target);
 for(const name of required){const browser=result.browsers.find(b=>b.name===name);if(browser?.status!=='available'||!browser.version)throw new Error(`Official browser unavailable: ${name}`);}
 for(const browser of result.browsers.filter(b=>required.includes(b.name))){
  if(!browser.commonCards?.length)throw new Error(`Missing comparable card intersection: ${browser.name}`);
  for(const scenario of scenarios({...result.config,commonCards:browser.commonCards}))for(const version of result.versions){
   const rows=result.samples.filter(row=>row.browser===browser.name&&row.version===version&&row.scenario===scenario.id&&row.scope===scenario.scope);
   if(rows.length!==result.config.iterations)throw new Error(`Incomplete workload coverage: ${browser.name} ${version} ${scenario.id}`);
  }
 }
 for(const browser of required)for(const version of ['2.2.10',target])for(const scenario of ['cold-startup','dashboard/mount','dashboard/unrelated','dashboard/relevant','tracks/media/50','graph/graph/1000','lifecycle/media/100']) {
  const row=result.summary.find(row=>row.browser===browser&&row.version===version&&row.scenario===scenario&&row.scope==='common');
  if(row?.metrics.workMs?.samples!==result.config.iterations)throw new Error(`Incomplete official sample coverage: ${browser} ${version} ${scenario}`);
 }
 return result;
}
export function buildPerformanceSection(result,target,{reportRef='main'}={}) {
 assertOfficialEvidence(result,target);
 const reportUrl=`https://github.com/danielmigueltejedor/nodalia-cards/blob/${encodeURIComponent(reportRef)}/docs/benchmarks/2.2.10-vs-${target}.md`;
 const jsonUrl=reportUrl.replace(/\.md$/,'.json');
 const browser=result.browsers.find(b=>b.name==='chromium');
 const lines=[SECTION_START,'## Performance vs Nodalia Cards 2.2.10','',
  `Reference: ${result.metadata.cpu}, ${result.metadata.platform} ${result.metadata.architecture}, Chromium ${browser.version}. Values are medians from ${result.config.iterations} samples; browsers are not averaged.`,
  '',`Measured the exact published ${target} asset. [Full ${result.metadata.referenceException?'three-engine RC':'four-engine'} report](${reportUrl}) · [Raw samples and hashes](${jsonUrl}).`,
  ...(result.metadata.referenceException?['','Firefox performance is unavailable on this reference Mac and explicitly excluded by the release owner for RC acceptance. Linux Firefox compatibility tests remain required. This exception cannot generate stable 3.0.0 evidence.']:[]),
  '',`| Metric | 2.2.10 | ${target} | Change |`,'|---|---:|---:|---:|'];
 for(const [key,label]of [['rawBytes','Bundle raw (bytes)'],['gzipBytes','Bundle gzip (bytes)']]){const before=result.assets.find(a=>a.version==='2.2.10')[key],after=result.assets.find(a=>a.version===target)[key];lines.push(`| ${label} | ${before} | ${after} | ${delta(before,after)} |`);}
 // Fixed representative selection includes slower results; do not filter on delta.
 for(const [scenario,metric,label]of [['cold-startup','totalMs','Fresh-context module load (ms)'],['cold-startup','scriptCpuMs','Module initialization script CPU (ms)'],['dashboard/mount','totalMs','Dashboard mount and settle (ms)'],['dashboard/mount','scriptCpuMs','Dashboard mount script CPU (ms)'],['dashboard/unrelated','workMs','Unrelated HA updates, synchronous work (ms)'],['dashboard/relevant','workMs','Relevant HA updates, synchronous work (ms)'],['tracks/media/50','workMs','50 Media track updates, synchronous work (ms)'],['graph/graph/1000','workMs','Graph 1,000-point dispatch (ms)'],['graph/graph/1000','scriptCpuMs','Graph 1,000-point script CPU (ms)'],['lifecycle/media/100','workMs','Media lifecycle, 100 cycles (ms)'],['lifecycle/media/100','usedDelta','Media settled heap delta, 100 cycles (bytes)']]){
  const values=['2.2.10',target].map(version=>result.summary.find(row=>row.browser==='chromium'&&row.version===version&&row.scenario===scenario)?.metrics[metric]);
  const before=values[0]?.samples?values[0].median:null,after=values[1]?.samples?values[1].median:null;
  if(before===null||after===null){lines.push(`| ${label} | ${before??'unavailable'} | ${after??'unavailable'} | unavailable |`);continue;}
  lines.push(`| ${label} | ${before.toFixed(2)} | ${after.toFixed(2)} | ${delta(before,after)} |`);
 }
 lines.push('', 'These fixture measurements describe specific operations on the reference machine, not a global speed increase. Heap deltas alone do not establish a leak. See p95, engine differences, workload definitions and limitations in the full report.',SECTION_END);
 return lines.join('\n');
}
export function replacePerformanceSection(notes,section){
 const start=notes.indexOf(SECTION_START),end=notes.indexOf(SECTION_END);
 if((start===-1)!==(end===-1)||end<start)throw new Error('Malformed performance section markers');
 return start===-1?`${notes.trimEnd()}\n\n${section}\n`:`${notes.slice(0,start)}${section}${notes.slice(end+SECTION_END.length)}`;
}
export async function writeEvidence(result,target,directory,options={}) {
 assertOfficialEvidence(result,target);const selected=structuredClone(result);
 selected.versions=['2.2.10',target];selected.assets=selected.assets.filter(a=>selected.versions.includes(a.version));selected.bundle=selected.bundle.filter(a=>selected.versions.includes(a.version));selected.samples=selected.samples.filter(a=>selected.versions.includes(a.version));selected.summary=summarize(selected.samples);
 validateResult(selected);await fs.mkdir(directory,{recursive:true});const stem=`2.2.10-vs-${target}`;
 await fs.writeFile(path.join(directory,`${stem}.json`),JSON.stringify(selected,null,2)+'\n');await fs.writeFile(path.join(directory,`${stem}.csv`),csv(selected));await fs.writeFile(path.join(directory,`${stem}.md`),markdown(selected));
 const section=buildPerformanceSection(selected,target,options);await fs.writeFile(path.join(directory,`${stem}-release-notes.md`),section+'\n');return section;
}
async function main(){
 const args=process.argv.slice(2).filter(arg=>arg!=='--');const [target,input,notesFile,reportRef]=args;
 if(!/^3\.0\.0(?:-rc\.\d+)?$/.test(target||'')||!input)throw new Error('Usage: node bench/release-evidence.mjs <3.0.0 or RC> <official.json> [release-notes.md]');
 const result=JSON.parse(await fs.readFile(input,'utf8'));
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const section=await writeEvidence(result,target,path.join(root,'docs/benchmarks'),reportRef?{reportRef}:{});
 if(notesFile){const notes=await fs.readFile(notesFile,'utf8');await fs.writeFile(notesFile,replacePerformanceSection(notes,section));}
 console.log(`Verified exact published ${target} evidence; report copied to docs/benchmarks.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error);process.exitCode=1;});
