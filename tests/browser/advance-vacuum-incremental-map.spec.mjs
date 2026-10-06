import { expect, test } from '@playwright/test';
const svg=(color='gray',width=1024,height=1024)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`;
async function mount(page) {
  await page.route('**/incremental-base.svg*',r=>r.fulfill({contentType:'image/svg+xml',body:svg()}));
  await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-advance-vacuum-card'));
  await page.evaluate(()=>{
    window.mapHass=window.makeHass({'vacuum.one':{state:'docked',attributes:{friendly_name:'Robot',battery_level:100}},'image.map':{state:'base',attributes:{entity_picture:'/incremental-base.svg'}}});
    window.mapConfig={entity:'vacuum.one',language:'en',animations:{enabled:false},room_tracking:{auto_detect:false},map_source:{camera:'image.map'},calibration_source:{calibration_points:[{map:{x:0,y:0},vacuum:{x:0,y:0}},{map:{x:1024,y:0},vacuum:{x:1024,y:0}},{map:{x:0,y:1024},vacuum:{x:0,y:1024}}]},room_segments:[{id:'1',label:'Kitchen',outline:[[20,20],[490,20],[490,490],[20,490]]},{id:'2',label:'Living',outline:[[520,20],[1000,20],[1000,490],[520,490]]}]};
    const c=document.createElement('nodalia-advance-vacuum-card');c.setConfig(window.mapConfig);c.hass=window.mapHass;document.querySelector('#fixture').append(c);window.mapCard=c;
  });
  const card=page.locator('nodalia-advance-vacuum-card');await expect.poll(()=>card.locator('[data-map-image]').evaluate(el=>el.naturalWidth)).toBe(1024);
  await card.locator('[data-mode-id="rooms"]').click();
  await page.evaluate(()=>{
    const c=window.mapCard,r=c.shadowRoot;
    window.mapNodes=Object.fromEntries(['[data-map-surface]','.advance-vacuum-card__map-canvas','[data-map-image]','.advance-vacuum-card__map-svg','.advance-vacuum-card__map-overlays','.advance-vacuum-card__footer','button[data-room-id="1"]','polygon[data-room-id="2"]'].map(selector=>[selector,r.querySelector(selector)]));
    window.mapRenders=0;const render=c._renderView.bind(c);c._renderView=()=>{window.mapRenders++;render();};
    window.mapOverlayBuilds=0;const overlays=c._renderMapOverlays.bind(c);c._renderMapOverlays=(...args)=>{window.mapOverlayBuilds++;return overlays(...args);};
    window.mapObserver=new MutationObserver(()=>{});window.mapObserver.observe(r.querySelector('[data-map-surface]'),{subtree:true,childList:true,attributes:true});
  });
  return card;
}
test('Robot-only HA feedback keeps every map layer and emits no map DOM mutations',async({page})=>{
  await mount(page);
  const result=await page.evaluate(()=>{
    for(let i=0;i<50;i++) {const h=window.mapHass;h.states['vacuum.one']={...h.states['vacuum.one'],last_updated:`position-${i}`,attributes:{...h.states['vacuum.one'].attributes,robot_position:[i,i]}};window.mapCard.hass={...h};}
    return {stable:Object.entries(window.mapNodes).every(([s,n])=>n===window.mapCard.shadowRoot.querySelector(s)),mutations:window.mapObserver.takeRecords().length};
  });
  expect(result).toEqual({stable:true,mutations:0});expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Dynamic selection patches the affected polygon/markers without replacing the other room or base',async({page})=>{
  const card=await mount(page);await card.locator('button[data-room-id="1"]').click();
  await expect(card.locator('polygon[data-room-id="1"]')).toHaveClass(/is-revealed|is-selected/);
  const result=await page.evaluate(()=>({stable:Object.entries(window.mapNodes).every(([s,n])=>n===window.mapCard.shadowRoot.querySelector(s)),removed:window.mapObserver.takeRecords().flatMap(record=>[...record.removedNodes]).filter(n=>Object.values(window.mapNodes).includes(n)).length}));
  expect(result).toEqual({stable:true,removed:0});
  await card.locator('button[data-room-id="2"]').click();
  await page.evaluate(()=>window.otherRoomImage=window.mapCard.shadowRoot.querySelector('[data-room-highlight-id="2-0"]'));
  await card.locator('button[data-room-id="1"]').click();
  expect(await page.evaluate(()=>window.otherRoomImage===window.mapCard.shadowRoot.querySelector('[data-room-highlight-id="2-0"]'))).toBe(true);
  await expect(card.locator('polygon[data-room-id="1"]')).not.toHaveClass(/is-revealed|is-selected/);
});
test('A new raster frame skips view/overlay builds and commits only after decode; the newest frame wins',async({page})=>{
  const card=await mount(page);let release;const blocked=new Promise(resolve=>release=resolve);let requested=false;
  await page.route('**/incremental-slow.svg*',async r=>{requested=true;await blocked;await r.fulfill({contentType:'image/svg+xml',body:svg('red')});});
  await page.route('**/incremental-new.svg*',r=>r.fulfill({contentType:'image/svg+xml',body:svg('blue')}));
  await page.evaluate(()=>{window.mapHass.states['image.map']={...window.mapHass.states['image.map'],state:'slow',attributes:{entity_picture:'/incremental-slow.svg'}};window.mapCard.hass={...window.mapHass};});
  await expect.poll(()=>requested).toBe(true);await expect(card.locator('[data-map-image]')).toHaveAttribute('src',/incremental-base/);
  await page.evaluate(()=>{window.mapHass.states['image.map']={...window.mapHass.states['image.map'],state:'new',attributes:{entity_picture:'/incremental-new.svg'}};window.mapCard.hass={...window.mapHass};});
  await expect(card.locator('[data-map-image]')).toHaveAttribute('src',/incremental-new/);release();
  const result=await page.evaluate(()=>({renders:window.mapRenders,builds:window.mapOverlayBuilds,stable:Object.entries(window.mapNodes).every(([s,n])=>n===window.mapCard.shadowRoot.querySelector(s)),pending:window.mapCard._pendingMapImage,stale:window.mapCard.shadowRoot.querySelectorAll('[data-map-image-previous]').length}));
  expect(result).toEqual({renders:0,builds:0,stable:true,pending:null,stale:0});
  await expect(card.locator('[data-map-image]')).toHaveAttribute('src',/incremental-new/);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Real map dimensions and room structure update correctly while stable layers remain mounted',async({page})=>{
  const card=await mount(page);await page.route('**/incremental-wide.svg*',r=>r.fulfill({contentType:'image/svg+xml',body:svg('green',640,320)}));
  await page.evaluate(()=>{window.mapHass.states['image.map']={...window.mapHass.states['image.map'],state:'wide',attributes:{entity_picture:'/incremental-wide.svg'}};window.mapCard.hass={...window.mapHass};});
  await expect.poll(()=>page.evaluate(()=>[window.mapCard._mapImageWidth,window.mapCard._mapImageHeight])).toEqual([640,320]);
  await expect(card.locator('.advance-vacuum-card__map-svg')).toHaveAttribute('viewBox','0 0 640 320');
  expect(await page.evaluate(()=>window.mapNodes['[data-map-image]']===window.mapCard.shadowRoot.querySelector('[data-map-image]'))).toBe(true);
  await page.evaluate(()=>{window.mapCard.setConfig({...window.mapConfig,room_segments:[...window.mapConfig.room_segments,{id:'3',label:'New room',outline:[[10,10],[200,10],[200,200],[10,200]]}]});window.mapCard.hass=window.mapHass;});
  await card.locator('[data-mode-id="rooms"]').click();
  await expect(card.locator('button[data-room-id="3"]')).toHaveCount(1);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Failed/retired frames keep the last decoded image and own no stale requests after disconnect',async({page})=>{
  const card=await mount(page);await page.route('**/incremental-failed.svg*',r=>r.fulfill({status:404}));
  await page.evaluate(()=>{window.mapHass.states['image.map']={...window.mapHass.states['image.map'],state:'failed',attributes:{entity_picture:'/incremental-failed.svg'}};window.mapCard.hass={...window.mapHass};});
  await expect.poll(()=>page.evaluate(()=>window.mapCard._pendingMapImage)).toBeNull();await expect(card.locator('[data-map-image]')).toHaveAttribute('src',/incremental-base/);
  await page.evaluate(()=>{const c=window.mapCard;c._syncMapImage('/never-completes.svg');window.retiredMapFrame=c._pendingMapImage;c.remove();});
  expect(await page.evaluate(()=>({pending:window.mapCard._pendingMapImage,load:window.retiredMapFrame.onload,error:window.retiredMapFrame.onerror,source:window.retiredMapFrame.getAttribute('src')}))).toEqual({pending:null,load:null,error:null,source:null});
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
