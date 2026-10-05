import { expect, test } from '@playwright/test';
async function fixture(page) {
 await page.route('**/bench/artwork/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#2277bb"/></svg>'}));
 await page.goto('/bench/fixture.html');await page.waitForFunction(()=>window.bench);
}
test('benchmark observes light DOM, existing Shadow DOM and shadow roots attached later',async({page})=>{
 await fixture(page);
 const counts=await page.evaluate(async()=>{
  const {observeMutations}=await import('/bench/fixtures/runtime.mjs');const seen=[];
  const host=document.createElement('div');const shadow=host.attachShadow({mode:'open'});document.body.append(host);
  const observer=observeMutations(document,records=>seen.push(...records.map(r=>r.type)));
  const existing=document.createElement('span');shadow.append(existing);existing.textContent='first';
  const late=document.createElement('div');host.append(late);const lateShadow=late.attachShadow({mode:'open'});const text=document.createTextNode('late');lateShadow.append(text);late.setAttribute('data-observed','yes');
  await Promise.resolve();text.data='changed';existing.setAttribute('title','changed');await Promise.resolve();observer.flush();observer.disconnect();
  return {childList:seen.filter(type=>type==='childList').length,attributes:seen.filter(type=>type==='attributes').length,characterData:seen.filter(type=>type==='characterData').length};
 });
 expect(counts.childList).toBeGreaterThanOrEqual(4);expect(counts.attributes).toBeGreaterThanOrEqual(2);expect(counts.characterData).toBeGreaterThanOrEqual(1);
});
test('benchmark distinguishes empty skips from success and records actual runtime failures',async({page})=>{
 await fixture(page);await page.evaluate(()=>import('/nodalia-cards.js'));
 const result=await page.evaluate(async()=>{
  const config={quietMs:20,settleTimeoutMs:6000,assignments:120,commonCards:['media']};
  await window.bench.prepare('unrelated/media',config);
  window.dispatchEvent(new ErrorEvent('error',{message:'benchmark injected runtime failure'}));
  return window.bench.run('unrelated/media',config);
 });
 expect(result.skipped).toEqual([]);expect(result.metrics.workMs).toBeGreaterThanOrEqual(0);expect(result.metrics.totalMs).toBeCloseTo(result.metrics.workMs+result.metrics.settleMs,4);expect(result.errors).toContain('benchmark injected runtime failure');
});
test('Graph benchmark ingests real large history rather than rendering an empty series',async({page})=>{
 await fixture(page);await page.evaluate(()=>import('/nodalia-cards.js'));
 const result=await page.evaluate(async()=>{
  const config={quietMs:20,settleTimeoutMs:6000,assignments:120,commonCards:['graph']};
  await window.bench.prepare('graph/graph/1000',config);return window.bench.run('graph/graph/1000',config);
 });
 expect(result.errors).toEqual([]);expect(result.metrics.historyInputPoints).toBe(1000);expect(result.metrics.historySamplesObserved).toBeGreaterThan(1);expect(result.metrics.numericProcessingMs).toBeGreaterThan(0);
});
test('vacuum profiles exercise a large helper catalog, robot switch and negotiated API v3 commands',async({page})=>{
 await fixture(page);await page.evaluate(()=>import('/nodalia-cards.js'));
 const results=await page.evaluate(async()=>{
  const config={quietMs:20,settleTimeoutMs:6000,assignments:120,commonCards:['advance-vacuum']},results=[];
  for(const scenario of ['helpers/advance-vacuum/explicit','helpers/advance-vacuum/robot-switch','engine-session/advance-vacuum']){await window.bench.prepare(scenario,config);results.push(await window.bench.run(scenario,config));}return results;
 });
 expect(results.every(result=>result.errors.length===0&&result.skipped.length===0)).toBe(true);
 expect(results[0].metrics.catalogEntities).toBeGreaterThan(1700);expect(results[0].metrics.catalogScans).toBe(0);
 expect(results[2].metrics.engineCommands).toBe(3);expect(results[2].metrics.engineV3Commands).toBe(2);
});
test('framed map benchmark consumes robot and image feedback while preserving pinch ownership',async({page})=>{
 await fixture(page);await page.evaluate(()=>import('/nodalia-cards.js'));
 const results=await page.evaluate(async()=>{
  const config={quietMs:20,settleTimeoutMs:6000,assignments:120,commonCards:['advance-vacuum']},results=[];
  for(const type of ['pointer',...(typeof TouchEvent==='function'?['touch']:[])]){
   const scenario=`gesture/advance-vacuum/${type}/20`;await window.bench.prepare(scenario,config);results.push(await window.bench.run(scenario,config));
  }
  return results;
 });
 expect(results.length).toBeGreaterThan(0);
 for(const result of results){
  expect(result.errors).toEqual([]);expect(result.skipped).toEqual([]);
  expect(result.metrics.feedbackUpdates).toBe(5);expect(result.metrics.mapFeedbackUpdates).toBe(5);
  expect(result.metrics.mapScaleAfter).toBeGreaterThan(result.metrics.mapScaleBefore);
  expect(result.metrics.markerIdentity).toBe(1);expect(result.metrics.mapImageIdentity).toBe(1);
  expect(result.metrics.gestureFullRenders).toBe(0);expect(result.metrics.gestureOverlayBuilds).toBe(0);expect(result.metrics.renderedFrames).toBeGreaterThan(0);
 }
});
