import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import cp from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit, devices } from '@playwright/test';
import { parseArgs, referencePolicy, loadAsset, sampleOrder, summarize, validateResult, markdown, csv, sha256 } from './core.mjs';

import { scenarios } from './workloads.mjs';
export { scenarios } from './workloads.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function versionOf(command,args){try{return cp.execFileSync(command,args,{encoding:'utf8'}).trim();}catch{return null;}}
const harnessPaths=['bench/run.mjs','bench/core.mjs','bench/workloads.mjs','bench/fixtures/runtime.mjs','bench/fixture.html','bench/benchmark.config.json','tests/fixtures/hass.mjs'];
const harnessHash=async()=>sha256(Buffer.concat(await Promise.all(harnessPaths.map(file=>fs.readFile(path.join(root,file))))));
export async function serve(directory=root) {
 const server=http.createServer(async(req,res)=>{
  try {
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(pathname.startsWith('/bench/artwork/')){
    if(pathname.includes('failed')){res.writeHead(404);res.end();return;}
    const map=pathname.includes('map'),color=pathname.includes('cold')?'#a34568':'#2277bb';
    res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'max-age=3600'});res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="${map?1024:96}" height="${map?1024:96}"><rect width="100%" height="100%" fill="${color}"/></svg>`);return;
   }
   const filename=path.resolve(directory,`.${decodeURIComponent(pathname)}`);
   if(!filename.startsWith(directory+path.sep)){res.writeHead(403);res.end();return;}
   const body=await fs.readFile(filename);const type=filename.endsWith('.html')?'text/html':filename.endsWith('.mjs')||filename.endsWith('.js')?'text/javascript':filename.endsWith('.json')?'application/json':'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end(String(error.message));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
const metricMap={ScriptDuration:'scriptCpuMs',LayoutDuration:'layoutCpuMs',LayoutCount:'layouts',RecalcStyleCount:'styleRecalculations'};
async function cpuSnapshot(cdp){if(!cdp)return null;const result=await cdp.send('Performance.getMetrics');return Object.fromEntries(result.metrics.map(m=>[m.name,m.value]));}
async function heapSnapshot(cdp,page){
 if(!cdp)return {usedHeapBytes:null,totalHeapBytes:null,domNodes:null,...await page.evaluate(()=>window.bench.memoryReset())};
 const fixture=await page.evaluate(()=>window.bench.memoryReset());await cdp.send('HeapProfiler.collectGarbage');
 const metrics=await cpuSnapshot(cdp),nodes=await cdp.send('Memory.getDOMCounters');
 return {...fixture,usedHeapBytes:metrics.JSHeapUsedSize,totalHeapBytes:metrics.JSHeapTotalSize,domNodes:nodes.nodes};
}
export async function launchBrowser(engine,options){
 try{return {browser:await engine.launch(options),error:null};}
 catch(error){return {browser:null,error:{stage:'launch',error:String(error.message)}};}
}
export async function run(args=process.argv.slice(2),env=process.env) {
 const options=parseArgs(args,env),base=JSON.parse(await fs.readFile(path.join(root,'bench/benchmark.config.json'),'utf8'));
 const policy=referencePolicy(options,os.platform());
 const config={...base,...(options.quick?base.quick:{}),browsers:policy.browsers};delete config.quick;
 for(const browser of config.browsers)if(!['chromium','firefox','webkit','webkit-iphone'].includes(browser))throw new Error(`Unknown browser ${browser}`);
 if(new Set(config.browsers).size!==config.browsers.length)throw new Error('Duplicate browser projects');
 const assets=[];for(const version of options.versions)assets.push(await loadAsset(version,path.join(root,'bench/releases')));
 const result={schemaVersion:1,metadata:{timestamp:new Date().toISOString(),mode:options.quick?'quick':'official',harnessCommit:versionOf('git',['-C',root,'rev-parse','HEAD']),harnessDirty:!!versionOf('git',['-C',root,'status','--porcelain','--','bench','tests/fixtures','package.json','pnpm-lock.yaml']),workingTreeDirty:!!versionOf('git',['-C',root,'status','--porcelain']),
  referenceException:policy.referenceException,harnessFilesSha256:await harnessHash(),platform:os.platform(),osRelease:os.release(),osVersion:os.platform()==='darwin'?versionOf('sw_vers',['-productVersion']):os.version(),architecture:os.arch(),cpu:os.cpus()[0]?.model||'unavailable',logicalCpus:os.cpus().length,ramBytes:os.totalmem(),node:process.version,pnpm:versionOf('pnpm',['--version']),playwright:JSON.parse(await fs.readFile(path.join(root,'node_modules/@playwright/test/package.json'),'utf8')).version},versions:options.versions,assets,bundle:assets.map(({version,rawBytes,gzipBytes,brotliBytes,sha256})=>({version,rawBytes,gzipBytes,brotliBytes,sha256})),config,browsers:[],samples:[],summary:[],skips:[],errors:[]};
 if(policy.referenceException)result.browsers.push({name:'firefox',status:'unavailable',version:null,reason:'Explicit release-owner exception: Firefox cannot launch on the reference Mac',excludedByPolicy:true});
 const server=await serve();
 try {
  for(const name of config.browsers){
   const engine=name==='webkit-iphone'?webkit:{chromium,firefox,webkit}[name];let browser;
   const launched=await launchBrowser(engine,{headless:true,...(name==='chromium'?{args:['--js-flags=--expose-gc']}:{}),...(name==='firefox'?{firefoxUserPrefs:{'layers.acceleration.disabled':true,'gfx.webrender.force-disabled':true}}:{})});
   browser=launched.browser;
   if(launched.error){result.browsers.push({name,status:'unavailable',version:null});result.errors.push({browser:name,...launched.error});continue;}
   const descriptor=name==='webkit-iphone'?devices['iPhone 15']:name==='webkit'?devices['Desktop Safari']:name==='firefox'?devices['Desktop Firefox']:devices['Desktop Chrome'];
   result.browsers.push({name,version:browser.version(),status:'available',viewport:descriptor.viewport,devicePixelRatio:descriptor.deviceScaleFactor,engine:name.startsWith('webkit')?'webkit':name});
   try {
    // Discover the intersection by loading each exact release independently.
    const supported=[];
    for(const version of options.versions){const context=await browser.newContext(descriptor);const page=await context.newPage();try{await page.goto(`${server.url}/bench/fixture.html`);await page.waitForFunction(()=>window.bench);await page.evaluate(version=>window.bench.load(version),version);supported.push(await page.evaluate(()=>window.bench.supported()));}finally{await context.close();}}
    const commonCards=supported[0].filter(id=>supported.every(list=>list.includes(id)));
    result.browsers.at(-1).commonCards=commonCards;
    const browserConfig={...config,commonCards};
    for(let iteration=-config.warmups;iteration<config.iterations;iteration++){
     for(const version of sampleOrder(options.versions,iteration+config.warmups)){
      const context=await browser.newContext(descriptor);let page=await context.newPage(),cdp=null,requests=0;const runtimeErrors=[];
      const observePage=()=>{page.on('pageerror',error=>runtimeErrors.push(String(error.message)));page.on('request',request=>{if(request.url().includes('/bench/artwork/'))requests++;});};
      observePage();
      try {
       if(name==='chromium'){cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');}
       await page.goto(`${server.url}/bench/fixture.html`);await page.waitForFunction(()=>window.bench);
       const startCpu=await cpuSnapshot(cdp),startup=await page.evaluate(version=>window.bench.load(version),version),endCpu=await cpuSnapshot(cdp);
       for(const [key,metric]of Object.entries(metricMap))startup[metric]=cdp?(endCpu[key]-startCpu[key])*(key.endsWith('Duration')?1000:1):null;
       if(iteration>=0)result.samples.push({browser:name,version,iteration,scenario:'cold-startup',scope:'common',metrics:startup,skipped:[]});
       for(const scenario of scenarios(browserConfig)){
        try {
         // A profile must not inherit retired frames, module caches or private
         // card state from an earlier profile. Setup/import stays outside its timing.
         await page.close();page=await context.newPage();observePage();
         cdp=null;if(name==='chromium'){cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');}
         await page.goto(`${server.url}/bench/fixture.html`);await page.waitForFunction(()=>window.bench);
         await page.evaluate(version=>window.bench.load(version),version);
         await page.evaluate(({id,config})=>window.bench.prepare(id,config),{id:scenario.id,config:browserConfig});
         const memoryBefore=scenario.id.startsWith('lifecycle/')?await heapSnapshot(cdp,page):null;
         // memoryReset clears only detached fixtures; lifecycle preparation intentionally has no mounted card.
         const before=await cpuSnapshot(cdp),requestStart=requests;
         const sample=await page.evaluate(({id,config})=>window.bench.run(id,config),{id:scenario.id,config:browserConfig});
         const after=await cpuSnapshot(cdp);for(const [key,metric]of Object.entries(metricMap))sample.metrics[metric]=cdp?(after[key]-before[key])*(key.endsWith('Duration')?1000:1):null;
         sample.metrics.artworkRequests=requests-requestStart;
         if(memoryBefore){const memoryAfter=await heapSnapshot(cdp,page);sample.memory={before:memoryBefore,after:memoryAfter};sample.metrics.usedBefore=memoryBefore.usedHeapBytes;sample.metrics.usedAfter=memoryAfter.usedHeapBytes;sample.metrics.usedDelta=cdp?memoryAfter.usedHeapBytes-memoryBefore.usedHeapBytes:null;sample.metrics.totalHeapBytes=memoryAfter.totalHeapBytes;sample.metrics.residualNodes=memoryAfter.nodes-memoryBefore.nodes;sample.metrics.residualBrowserNodes=cdp?memoryAfter.domNodes-memoryBefore.domNodes:null;}
         if(sample.errors.length)throw new Error(sample.errors.join('; '));
         if(iteration>=0){result.samples.push({browser:name,version,iteration,scenario:scenario.id,scope:scenario.scope,...sample});for(const reason of sample.skipped)result.skips.push({browser:name,version,scenario:scenario.id,reason});}
        }catch(error){result.errors.push({browser:name,version,iteration,scenario:scenario.id,error:String(error.message)});}
       }
       if(runtimeErrors.length)result.errors.push({browser:name,version,iteration,stage:'runtime',errors:runtimeErrors});
       console.log(`${name} ${version}: ${iteration<0?'warmup':'sample'} ${iteration<0?iteration+config.warmups+1:iteration+1}/${iteration<0?config.warmups:config.iterations}`);
      }finally{await context.close();}
     }
    }
   }catch(error){result.errors.push({browser:name,stage:'suite',error:String(error.message)});}
   finally{await browser.close();}
  }
 }finally{await server.close();}
 if(await harnessHash()!==result.metadata.harnessFilesSha256)result.errors.push({stage:'harness_changed',error:'Harness files changed during the run; these measurements cannot be official release evidence'});
 result.summary=summarize(result.samples);validateResult(result);
 const output=path.resolve(root,options.out);await fs.mkdir(output,{recursive:true});
 const stem=options.versions.join('-vs-')+(options.quick?'-quick':'');
 await fs.writeFile(path.join(output,`${stem}.json`),JSON.stringify(result,null,2)+'\n');await fs.writeFile(path.join(output,`${stem}.md`),markdown(result));await fs.writeFile(path.join(output,`${stem}.csv`),csv(result));
 console.log(`${result.samples.length} samples; ${result.errors.length} errors; output ${output}`);
 if(options.publishNotes)throw new Error('Use the separately validated post-release evidence command; benchmark runner never publishes notes directly');
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().then(result=>{if(result.errors.length)process.exitCode=1;}).catch(error=>{console.error(error);process.exitCode=1;});
