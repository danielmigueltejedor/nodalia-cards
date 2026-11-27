// Local candidate diagnostic. Run with the fixture server on port 4173:
// PLAYWRIGHT_BROWSERS_PATH=../browsers node bench/dashboard-soak.mjs [baseline-bundle]
import { webkit } from '@playwright/test';
import { resolve } from 'node:path';
const baseline = process.argv[2] && resolve(process.argv[2]);
const browser = await webkit.launch({headless:true});
const results = [];
for (let round=0; round<2; round++) {
 for (const [name, asset] of (round % 2 ? [['candidate',null],['baseline',baseline]] : [['baseline',baseline],['candidate',null]])) {
 if (name === 'baseline' && !asset) continue;
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  if(asset) await page.route('**/nodalia-cards.js', route => route.fulfill({path:asset,contentType:'text/javascript'}));
  await page.goto('http://127.0.0.1:4173/tests/fixtures/browser.html');
  await page.waitForFunction(()=>customElements.get('nodalia-light-card'));
  const result = await page.evaluate(async () => {
   const fixture=document.querySelector('#fixture'); fixture.style.cssText='display:block;max-width:none';
   const entities={}; const types=['light','fan','humidifier','vacuum'];
   for(let i=0;i<48;i++) {const type=types[i%4]; entities[`${type}.item${i}`]={state:'on',attributes:{friendly_name:`Device ${i}`,brightness:128,percentage:50,humidity:50,temperature:22,supported_features:0}};}
   let hass=window.makeHass(entities);
   const panels=[[],[]];
   for(let i=0;i<48;i++){const type=types[i%4], card=document.createElement(`nodalia-${type}-card`); card.setConfig({entity:`${type}.item${i}`,animations:{enabled:true}});card.hass=hass; panels[Math.floor(i/4)%2].push(card);}
   const container=document.createElement('div');container.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:12px';fixture.append(container);
   const frame=()=>new Promise(r=>requestAnimationFrame(r)); const sleep=ms=>new Promise(r=>setTimeout(r,ms));
   const sample=async(index)=>{const t=performance.now();container.replaceChildren(...panels[index]);const mount=performance.now()-t;let prev=performance.now(), gaps=[], peakAnimations=0;const end=prev+350;while(performance.now()<end){await frame();let now=performance.now();gaps.push(now-prev);prev=now;if(gaps.length===1) peakAnimations=panels[index].reduce((n,c)=>n+(c.shadowRoot?.getAnimations({subtree:true}).length||0),0);}return {mount,frames:gaps.length,maxGap:Math.max(...gaps),slowFrames:gaps.filter(x=>x>34).length,peakAnimations};};
   let before=[];for(let i=0;i<4;i++)before.push(await sample(i%2));
   let updateMs=0;
   for(let cycle=0;cycle<80;cycle++){
    const start=performance.now();const slot=Math.floor(cycle/2)%24;const item=Math.floor(slot/4)*8+(cycle%2)*4+slot%4;const id=`${types[item%4]}.item${item}`;hass={...hass,states:{...hass.states,[id]:{...hass.states[id],attributes:{...hass.states[id].attributes,percentage:cycle%100,brightness:cycle%255}}}};
    const panelIndex=cycle%2;
    for(const card of panels[panelIndex]) card.hass=hass;
    container.replaceChildren(...panels[panelIndex]);updateMs+=performance.now()-start;
    if(cycle%4===0) await frame();
   }
   await sleep(500);let after=[];for(let i=0;i<4;i++)after.push(await sample(i%2));
   container.replaceChildren();await sleep(250);
   const cleanup=panels.flat().map(c=>({connected:c.isConnected,timers:c._panelWork?.timers?.size??c._animationWork?.timers?.size??0,frame:c._resizeFrame||0}));
   return {before,after,updateMs,cleanupPending:cleanup.filter(x=>x.connected||x.timers||x.frame).length, errors:window.bundleErrors};
  });
  results.push({name,round,...result}); await page.close();
 }
}
console.log(JSON.stringify(results,null,2)); await browser.close();
