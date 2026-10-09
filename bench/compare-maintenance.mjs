/** Local candidate diagnostics. Deliberately separate from published-release evidence. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import cp from 'node:child_process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, devices } from '@playwright/test';
import { serve } from './run.mjs';
import { loadAsset, sha256, sampleOrder, summarize } from './core.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const command=(cmd,args)=>cp.execFileSync(cmd,args,{cwd:root,encoding:'utf8'}).trim();
const profiles=[...['lock','humidifier','weather','advance-vacuum'].flatMap(card=>['mount','relevant','unrelated'].map(kind=>`${kind}/${card}`)),
 'states/lock/40','map-updates/advance-vacuum/robot/120','map-updates/advance-vacuum/frame/20','map-updates/advance-vacuum/selection/20',
 'gesture/advance-vacuum/pointer/80','gesture/advance-vacuum/touch/80','lifecycle/advance-vacuum/100'];
const allCards=['light','fan','humidifier','climate','entity','fav','gauge','graph','media','vacuum','weather','calendar','power-flow','cover','alarm','lock','advance-vacuum','insignia','person','scenes','notifications','news','camera','summary','navigation'];
// --broad: every registered card's mount, unrelated and relevant profiles plus the whole dashboard.
const broadProfiles=[...allCards.flatMap(card=>['mount','relevant','unrelated'].map(kind=>`${kind}/${card}`)),'dashboard/mount','dashboard/unrelated','dashboard/relevant',
 ...profiles.filter(p=>/^(states|map-updates|gesture|lifecycle)\//.test(p)),'helpers/advance-vacuum/auto','helpers/advance-vacuum/explicit','helpers/advance-vacuum/robot-switch'];
const harnessPaths=['bench/compare-maintenance.mjs','bench/run.mjs','bench/core.mjs','bench/workloads.mjs','bench/fixtures/runtime.mjs','bench/fixture.html','bench/benchmark.config.json','tests/fixtures/hass.mjs'];
const hashHarness=async()=>sha256(Buffer.concat(await Promise.all(harnessPaths.map(file=>fs.readFile(path.join(root,file))))));
export async function compare({smoke=false,baselineVersion='3.0.0',broad=false,iterations,warmups}={}) {
 const baseline=await loadAsset(baselineVersion,path.join(root,'bench/releases'));
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const candidateBytes=await fs.readFile(path.join(root,'nodalia-cards.js'));
 const candidate={version:pkg.version,provenance:'local-source-candidate',sha256:sha256(candidateBytes),rawBytes:candidateBytes.length,gzipBytes:zlib.gzipSync(candidateBytes,{level:9}).length,brotliBytes:zlib.brotliCompressSync(candidateBytes).length};
 const directory=path.join(root,'bench/releases',candidate.version);await fs.mkdir(directory,{recursive:true});await fs.writeFile(path.join(directory,'nodalia-cards.js'),candidateBytes);
 const versions=[baseline.version,candidate.version],config={...JSON.parse(await fs.readFile(path.join(root,'bench/benchmark.config.json'),'utf8')),commonCards:broad?allCards:['lock','humidifier','weather','advance-vacuum']};delete config.quick;
 if(iterations)config.iterations=iterations;if(warmups!==undefined)config.warmups=warmups;
 const selectedProfiles=smoke?profiles.filter(p=>p.startsWith("map-updates/")||p.startsWith("states/")):broad?broadProfiles:profiles;
 if(smoke){config.iterations=1;config.warmups=0;}
 const result={schemaVersion:'maintenance-diagnostic-1',metadata:{timestamp:new Date().toISOString(),mode:smoke?'local-candidate-smoke':'local-candidate-diagnostic',commit:command('git',['rev-parse','HEAD']),workingTreeDirty:!!command('git',['status','--porcelain']),harnessFilesSha256:await hashHarness(),node:process.version,pnpm:command('pnpm',['--version']),playwright:JSON.parse(await fs.readFile(path.join(root,'node_modules/@playwright/test/package.json'),'utf8')).version,platform:os.platform(),osVersion:command('sw_vers',['-productVersion']),osRelease:os.release(),architecture:os.arch(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,ramBytes:os.totalmem(),firefox:'excluded on this Mac by explicit owner instruction; no Firefox performance claim'},versions,assets:[baseline,candidate],config,profiles:selectedProfiles,browsers:[],samples:[],errors:[]};
 const server=await serve();
 try {
  for(const name of ['chromium','webkit','webkit-iphone']) {
   const engine=name==='chromium'?chromium:webkit,browser=await engine.launch({headless:true,...(name==='chromium'?{args:['--js-flags=--expose-gc']}: {})});
   const descriptor=devices[name==='chromium'?'Desktop Chrome':name==='webkit'?'Desktop Safari':'iPhone 15'];
   result.browsers.push({name,version:browser.version(),viewport:descriptor.viewport,devicePixelRatio:descriptor.deviceScaleFactor});
   try {
    for(let iteration=-config.warmups;iteration<config.iterations;iteration++)for(const version of sampleOrder(versions,iteration+config.warmups)) {
     for(const profile of selectedProfiles){
      const context=await browser.newContext(descriptor),page=await context.newPage(),runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(e.message));
      let cdp;
      const memory=async()=>{
       const fixture=await page.evaluate(()=>window.bench.memoryReset());
       if(!cdp)return {...fixture,usedHeapBytes:null,domNodes:null};
       await cdp.send('HeapProfiler.collectGarbage');
       const metrics=await cdp.send('Performance.getMetrics'),nodes=await cdp.send('Memory.getDOMCounters');return {...fixture,usedHeapBytes:metrics.metrics.find(m=>m.name==='JSHeapUsedSize').value,domNodes:nodes.nodes};
      };
      try {
       if(name==='chromium'){cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');}
       await page.goto(`${server.url}/bench/fixture.html`);await page.waitForFunction(()=>window.bench);
       await page.evaluate(v=>window.bench.load(v),version);
       await page.evaluate(({profile,config})=>window.bench.prepare(profile,config),{profile,config});
       const before=profile.startsWith('lifecycle/')?await memory():null;
       const sample=await page.evaluate(({profile,config})=>window.bench.run(profile,config),{profile,config});
       if(before){const after=await memory();sample.memory={before,after};Object.assign(sample.metrics,{usedDelta:cdp?after.usedHeapBytes-before.usedHeapBytes:null,residualNodes:after.nodes-before.nodes,residualBrowserNodes:cdp?after.domNodes-before.domNodes:null});}
       if(sample.errors.length||sample.skipped.length||runtimeErrors.length)throw new Error(JSON.stringify({errors:sample.errors,skipped:sample.skipped,runtimeErrors}));
       if(iteration>=0)result.samples.push({browser:name,version,iteration,scenario:profile,scope:'maintenance',...sample});
      }catch(error){result.errors.push({browser:name,version,iteration,scenario:profile,error:String(error.message)});}
      finally{await context.close();}
     }
     console.log(`${name} ${version}: ${iteration<0?'warmup':'sample'} ${iteration<0?iteration+config.warmups+1:iteration+1}`);
    }
   }finally{await browser.close();}
  }
 }finally{await server.close();}
 if(await hashHarness()!==result.metadata.harnessFilesSha256)result.errors.push({error:'Harness changed during measurement'});
 if(sha256(await fs.readFile(path.join(root,'nodalia-cards.js')))!==candidate.sha256)result.errors.push({error:'Candidate changed during measurement'});
 result.summary=summarize(result.samples);
 const output=path.join(root,`bench/results/maintenance-${candidate.version}${baselineVersion!=='3.0.0'?`-vs-${baselineVersion}`:''}${broad?'-broad':''}${smoke?'-smoke':''}.json`);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');
 console.log(`${result.samples.length} samples; ${result.errors.length} errors; ${output}`);return result;
}
const argument=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.split('=')[1];
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))compare({smoke:process.argv.includes('--smoke'),baselineVersion:argument('baseline')||'3.0.0',broad:process.argv.includes('--broad'),iterations:argument('iterations')?Number(argument('iterations')):undefined,warmups:argument('warmups')!==undefined?Number(argument('warmups')):undefined}).then(r=>{if(r.errors.length)process.exitCode=1;}).catch(e=>{console.error(e);process.exitCode=1;});
