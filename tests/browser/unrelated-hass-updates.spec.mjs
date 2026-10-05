import { expect, test } from '@playwright/test';
for(const embedded of [false,true])test(`${embedded?'Summary embedded':'Standalone'} paused Media Player does not rewrite progress DOM on unrelated HA updates`,async({page})=>{
 await page.route('**/bench/artwork/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#2277bb"/></svg>'}));
 await page.goto('/bench/fixture.html');await page.waitForFunction(()=>window.bench);await page.evaluate(()=>import('/nodalia-cards.js'));
 const result=await page.evaluate(async embedded=>{
  const config={quietMs:40,settleTimeoutMs:6000,assignments:120,commonCards:['media','summary']},id=embedded?'summary':'media';
  await window.bench.prepare(`unrelated/${id}`,config);return window.bench.run(`unrelated/${id}`,config);
 },embedded);
 expect(result.errors).toEqual([]);
 expect(result.metrics.childList).toBe(0);
 expect(result.metrics.attributes).toBe(0);
 expect(result.metrics.characterData).toBe(0);
});
