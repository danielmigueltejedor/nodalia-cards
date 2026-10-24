import {expect, test} from '@playwright/test';

// Compare the actual visible edge-to-edge distance, not only the CSS grid gap.
// An oversized grid track can silently introduce spacing unlike sibling cards.
test('Entity hero gap matches Light, Fan and Humidifier, while idle speakers have breathing room',async ({page})=>{
 await page.goto('/tests/fixtures/browser.html');
 await page.waitForFunction(()=>['nodalia-entity-card','nodalia-light-card','nodalia-fan-card','nodalia-humidifier-card','nodalia-media-player'].every(name=>customElements.get(name)));
 await page.evaluate(()=>{
  const entities={
   'switch.test':{state:'off',attributes:{friendly_name:'Entity test'}},
   'light.test':{state:'off',attributes:{friendly_name:'Light test',supported_color_modes:['brightness'],brightness:0}},
   'fan.test':{state:'off',attributes:{friendly_name:'Fan test',percentage:0,supported_features:1}},
   'humidifier.test':{state:'off',attributes:{friendly_name:'Humidifier test',humidity:40,min_humidity:30,max_humidity:80}},
   'media_player.speaker':{state:'off',attributes:{friendly_name:'HomePod mini',supported_features:1}}
  };
  const hass=window.makeHass(entities);
  for(const [tag,entity] of [
    ['nodalia-entity-card','switch.test'],
    ['nodalia-light-card','light.test'],
    ['nodalia-fan-card','fan.test'],
    ['nodalia-humidifier-card','humidifier.test']
  ]){
   const card=document.createElement(tag);
   card.setConfig({entity,animations:{enabled:false}});
   card.hass=hass;document.querySelector('#fixture').append(card);
  }
  const media=document.createElement('nodalia-media-player');
  media.setConfig({players:[{entity:'media_player.speaker',show:true}],layout:{mode:'standard'},animations:{enabled:false}});
  media.hass=hass;document.querySelector('#fixture').append(media);
 });
 const items=[
  ['nodalia-entity-card','.entity-card__icon','.entity-card__title'],
  ['nodalia-light-card','.light-card__icon','.light-card__title'],
  ['nodalia-fan-card','.fan-card__icon','.fan-card__title'],
  ['nodalia-humidifier-card','.humidifier-card__icon','.humidifier-card__title'],
  ['nodalia-media-player','.media-player__artwork--idle','.media-player__idle-name']
 ];
 for(const width of [310,420]){
  const gaps=[];
  for(const [tag,icon,title] of items){
   const card=page.locator(tag);
   await card.evaluate((node,w)=>{node.style.width=w+'px';},width);
   await expect(card.locator(title)).toBeVisible();
   const measured=await card.evaluate((node,selectors)=>{
    const [icon,title]=selectors.map(q=>node.shadowRoot.querySelector(q));
    const a=icon.getBoundingClientRect(),b=title.getBoundingClientRect();
    return {gap:b.left-a.right,visible:b.width>0,aligned:b.left>=a.right};
   },[icon,title]);
   expect(measured.visible).toBe(true);
   expect(measured.aligned).toBe(true);
   gaps.push(measured.gap);
  }
  // Entity and sibling control cards use the same compact/standard 10–12px rhythm.
  for(const gap of gaps.slice(0,4))expect(gap).toBeGreaterThanOrEqual(9);
  expect(Math.max(...gaps.slice(0,4))-Math.min(...gaps.slice(0,4))).toBeLessThanOrEqual(3);
  expect(gaps[4]).toBeGreaterThanOrEqual(15);
  expect(gaps[4]).toBeLessThanOrEqual(17);
 }
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Compact Entity keeps its icon gap without an invisible track; TV idle retains its own spacing',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');
 await page.waitForFunction(()=>customElements.get('nodalia-entity-card')&&customElements.get('nodalia-media-player'));
 await page.evaluate(()=>{
  const hass=window.makeHass({
   'switch.test':{state:'off',attributes:{friendly_name:'Test entity'}},
   'media_player.tv':{state:'off',attributes:{friendly_name:'Televisión',device_class:'tv',supported_features:1}}
  });
  const entity=document.createElement('nodalia-entity-card');
  entity.setConfig({entity:'switch.test',grid_options:{columns:6,rows:1},animations:{enabled:false}});
  entity.hass=hass;entity.style.width='300px';document.querySelector('#fixture').append(entity);
  const tv=document.createElement('nodalia-media-player');
  tv.setConfig({players:[{entity:'media_player.tv',tv_mode:true,show:true}],layout:{mode:'standard'},animations:{enabled:false}});
  tv.hass=hass;tv.style.width='320px';document.querySelector('#fixture').append(tv);
 });
 const entity=page.locator('nodalia-entity-card');
 await expect(entity.locator('.entity-card__title')).toBeVisible();
 const gap=await entity.evaluate(node=>node.shadowRoot.querySelector('.entity-card__title').getBoundingClientRect().left-node.shadowRoot.querySelector('.entity-card__icon').getBoundingClientRect().right);
 expect(gap).toBeGreaterThanOrEqual(9);
 expect(gap).toBeLessThanOrEqual(11);
 const tv=page.locator('nodalia-media-player');
 await expect(tv.locator('.media-player__idle-name')).toHaveText('Televisión');
 const tvGap=await tv.evaluate(node=>node.shadowRoot.querySelector('.media-player__idle-name').getBoundingClientRect().left-node.shadowRoot.querySelector('.media-player__artwork--idle').getBoundingClientRect().right);
 expect(tvGap).toBeGreaterThanOrEqual(11);
 expect(tvGap).toBeLessThanOrEqual(13);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
