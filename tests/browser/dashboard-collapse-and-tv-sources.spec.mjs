import {expect,test} from '@playwright/test';

test('Alarm favourites release their expanded height in an automatic Sections row after repeated and interrupted collapses',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');
 await page.waitForFunction(()=>customElements.get('nodalia-fav-card'));
 await page.evaluate(()=>{
  const fixture=document.querySelector('#fixture').appendChild(document.createElement('hui-section'));
  fixture.style.cssText='display:grid;grid-template-columns:repeat(12,minmax(0,1fr));grid-auto-rows:auto;gap:8px;width:360px;max-width:100%';
  const hass=window.makeHass({'alarm_control_panel.one':{state:'disarmed',attributes:{supported_features:63,code_format:'number'}}});
  for(let i=0;i<3;i++) {
   const chip=document.createElement('div');chip.style.cssText='grid-column:span 2;height:68px';fixture.append(chip);
  }
  const wrapper=document.createElement('hui-card');wrapper.style.cssText='display:block;grid-column:span 6';
  const card=document.createElement('nodalia-fav-card');card.setConfig({entity:'alarm_control_panel.one',grid_options:{columns:6,rows:'auto'}});card.hass=hass;wrapper.append(card);fixture.append(wrapper);
  const heading=document.createElement('h2');heading.textContent='Weather and information';heading.id='next-section';heading.style.cssText='grid-column:1/-1;margin:0';fixture.append(heading);
  window.collapseCard=card;window.collapseHass=hass;window.collapseEvents=[];
  fixture.addEventListener('card-updated',()=>window.collapseEvents.push(card.getCardSize()));
  window.collapseResizes=0;window.addEventListener('resize',()=>window.collapseResizes++);
 });
 const card=page.locator('nodalia-fav-card'),toggle=card.locator('.fav-card__hero');
 const nextTop=()=>page.locator('#next-section').evaluate(node=>node.getBoundingClientRect().top);
 const initial=await nextTop();
 for(let i=0;i<5;i++) {
  await toggle.click();
  await expect(card.locator('.fav-card__alarm-panel')).toBeVisible();
  expect(await nextTop()).toBeGreaterThan(initial+50);
  await toggle.click();
  await page.evaluate(()=>{window.collapseCard.hass={...window.collapseHass};});
  await expect.poll(nextTop).toBeCloseTo(initial,1);
 }
 // Collapse before its open-frame callback can run, then change capabilities.
 await page.evaluate(()=>{
  const card=window.collapseCard;card._performPrimaryAction(card._getState());card._performPrimaryAction(card._getState());
  window.collapseHass.states['alarm_control_panel.one'].attributes.supported_features=1;card.hass={...window.collapseHass};
 });
 await expect.poll(nextTop).toBeCloseTo(initial,1);
 expect(await page.evaluate(()=>window.collapseCard.closest('hui-card').hasAttribute('data-fav-alarm-open'))).toBe(false);
 expect(await page.evaluate(()=>window.collapseEvents.at(-1))).toBe(1);
 expect(await page.evaluate(()=>window.collapseResizes)).toBe(0);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('TV source chips scroll and select inside a rounded transparent panel without clipped outer shadows',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');
 await page.waitForFunction(()=>customElements.get('nodalia-media-player'));
 await page.evaluate(()=>{
  const card=document.createElement('nodalia-media-player');card.style.cssText='width:180px;--primary-text-color:#181738;--ha-card-background:#fff;--rgb-primary-color:0,160,220';
  card.setConfig({entity:'media_player.tv',device_type:'tv',grid_options:{columns:6,rows:'auto'},animations:{enabled:false},artwork:{mode:'off'}});
  const hass=window.makeHass({'media_player.tv':{state:'playing',attributes:{device_class:'tv',media_title:'TV',source:'Source 0',source_list:Array.from({length:24},(_,i)=>`Source ${i}`),supported_features:2048}}});
  window.sourceCalls=[];hass.callService=async(domain,service,data)=>window.sourceCalls.push({domain,service,data});
  card.hass=hass;document.querySelector('#fixture').append(card);
 });
 const card=page.locator('nodalia-media-player');
 await card.locator('[data-media-control="toggle-source-panel"]').click();
 const panel=card.locator('.media-player__tv-source-panel');
 await expect(panel).toBeVisible();
 const surfaces=await panel.evaluate(node=>({
  background:getComputedStyle(node).backgroundColor,radius:parseFloat(getComputedStyle(node).borderRadius),scroll:node.scrollHeight>node.clientHeight,
  shadows:[...node.querySelectorAll('.media-player__source-button')].map(button=>getComputedStyle(button).boxShadow),
 }));
 expect(surfaces.background).toBe('rgba(0, 0, 0, 0)');expect(surfaces.radius).toBeGreaterThan(0);expect(surfaces.scroll).toBe(true);
 for(const shadow of surfaces.shadows) expect(shadow==='none' || /^.+inset$/.test(shadow)).toBe(true);
 await panel.evaluate(node=>node.scrollTop=node.scrollHeight);
 await card.locator('[data-media-source="Source 23"]').click();
 expect(await page.evaluate(()=>window.sourceCalls)).toEqual([{domain:'media_player',service:'select_source',data:{entity_id:'media_player.tv',source:'Source 23'}}]);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
