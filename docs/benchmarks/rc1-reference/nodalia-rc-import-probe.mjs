import fs from 'node:fs/promises';
import {webkit,devices} from '/Users/danielmigueltejedor/Documents/Codex/2026-09-29/cor/work/nodalia-cards/node_modules/@playwright/test/index.mjs';
import {serve} from '/Users/danielmigueltejedor/Documents/Codex/2026-09-29/cor/work/nodalia-cards/bench/run.mjs';
const server=await serve(),browser=await webkit.launch({headless:true}),errors=[];
try {const context=await browser.newContext(devices['iPhone 15']);
for(let i=0;i<100;i++){const page=await context.newPage();page.on('pageerror',e=>errors.push({iteration:i,error:e.message}));
try{await page.goto(server.url+'/bench/fixture.html');await page.waitForFunction(()=>window.bench);await page.evaluate(()=>window.bench.load('2.2.10'));
await page.evaluate(()=>window.bench.prepare('unrelated/gauge',{quietMs:40,settleTimeoutMs:6000,commonCards:['gauge']}));
}catch(e){errors.push({iteration:i,error:e.message});break;}finally{await page.close();}}
await context.close();}finally{await browser.close();await server.close();}
await fs.writeFile('/private/tmp/nodalia-rc-import-probe.json',JSON.stringify({iterations:100,errors},null,2));console.log(JSON.stringify({iterations:100,errors}));
