import { expect, test } from '@playwright/test';
async function mount(page) {
  await page.route('**/local/zoom-map.svg', route => route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="gray"/></svg>'}));
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-advance-vacuum-card'));
  await page.evaluate(() => {
    const card = document.createElement('nodalia-advance-vacuum-card');
    card.setConfig({entity:'vacuum.one', animations:{enabled:false}, map_source:{camera:'camera.map'}, calibration_source:{calibration_points:[{map:{x:0,y:0},vacuum:{x:0,y:0}},{map:{x:1024,y:0},vacuum:{x:1024,y:0}},{map:{x:0,y:1024},vacuum:{x:0,y:1024}}]},room_segments:[{id:'1',label:'Kitchen',outline:[[20,20],[1000,20],[1000,1000],[20,1000]]}]});
    card.hass = window.makeHass({'vacuum.one':{state:'docked',attributes:{friendly_name:'Robot'}},'camera.map':{state:'idle',attributes:{entity_picture:'/local/zoom-map.svg'}}});
    document.querySelector('#fixture').append(card); window.zoomCard=card;
  });
  const card = page.locator('nodalia-advance-vacuum-card');
  await expect.poll(() => card.locator('[data-map-image]').evaluate(el=>el.naturalWidth)).toBe(1024);
  await card.locator('[data-mode-id="rooms"]').click();
  await page.evaluate(() => {
    const card=window.zoomCard, root=card.shadowRoot;
    window.zoomNodes={surface:root.querySelector('[data-map-surface]'),canvas:root.querySelector('.advance-vacuum-card__map-canvas'),image:root.querySelector('[data-map-image]'),footer:root.querySelector('.advance-vacuum-card__footer')};
    window.zoomRenders=0; const render=card._render.bind(card); card._render=()=>{window.zoomRenders++;render();};
  });
}
for (const nativeTouch of [false,true]) {
  test(`Vacuum ${nativeTouch?'native touch':'pointer'} pinch coalesces frames and keeps the map image and controls mounted`, async ({page}) => {
    if(nativeTouch) test.skip(!await page.evaluate(()=>typeof TouchEvent==='function'),'Native touch constructors unavailable');
    await mount(page);
    await page.evaluate(nativeTouch => {
      const surface=window.zoomNodes.surface, rect=surface.getBoundingClientRect(), y=rect.y+rect.height/2, x=rect.x+rect.width/2;
      const touches=distance=>[{identifier:1,target:surface,clientX:x-distance/2,clientY:y},{identifier:2,target:surface,clientX:x+distance/2,clientY:y}];
      const touchEvent=(type,points)=>{const event=new Event(type,{bubbles:true,composed:true,cancelable:true});Object.setPrototypeOf(event,TouchEvent.prototype);Object.defineProperty(event,'touches',{value:points});return event;};
      if(nativeTouch) {
        surface.dispatchEvent(touchEvent('touchstart',touches(80)));
        for(let i=0;i<40;i++) surface.dispatchEvent(touchEvent('touchmove',touches(80+i*3)));
      } else {
        for(const [id,offset] of [[1,-40],[2,40]]) surface.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,pointerId:id,pointerType:'touch',clientX:x+offset,clientY:y}));
        for(let i=0;i<40;i++) for(const [id,sign] of [[1,-1],[2,1]]) surface.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true,cancelable:true,pointerId:id,pointerType:'touch',clientX:x+sign*(40+i*1.5),clientY:y}));
      }
      window.zoomBeforeFrame=window.zoomRenders;
    }, nativeTouch);
    expect(await page.evaluate(()=>window.zoomBeforeFrame)).toBe(0);
    await expect.poll(()=>page.evaluate(()=>window.zoomCard._mapFrame)).toBe(0);
    const result=await page.evaluate(()=>{
      const card=window.zoomCard, root=card.shadowRoot, nodes=window.zoomNodes;
      return {renders:window.zoomRenders,scale:card._mapScale,canvas:nodes.canvas===root.querySelector('.advance-vacuum-card__map-canvas'),image:nodes.image===root.querySelector('[data-map-image]'),footer:nodes.footer===root.querySelector('.advance-vacuum-card__footer'),transform:nodes.canvas.style.transform, marker:root.querySelector('button[data-room-id="1"]').getBoundingClientRect().width};
    });
    expect(result.renders).toBe(0); expect(result.scale).toBeCloseTo(197/80); expect(result.canvas && result.image && result.footer).toBe(true); expect(result.transform).toContain('scale(2.4625)'); expect(result.marker).toBeGreaterThan(0);
    await page.evaluate(nativeTouch=>{
      const surface=window.zoomNodes.surface;
      if(nativeTouch) {const event=new Event('touchend',{bubbles:true,composed:true});Object.setPrototypeOf(event,TouchEvent.prototype);Object.defineProperty(event,'touches',{value:[]});surface.dispatchEvent(event);}
      else surface.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,composed:true,pointerId:1,pointerType:'touch'}));
    }, nativeTouch);
    expect(await page.evaluate(()=>window.zoomRenders)).toBe(1);
    expect(await page.evaluate(()=>window.zoomCard._mapGestureRect)).toBeNull();
    expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
  });
}
test('Vacuum cancels queued map painting when detached or its HA context changes',async({page})=>{
  await mount(page);
  const result=await page.evaluate(()=>{
    const card=window.zoomCard; card._setMapTransform(2,{x:-30,y:-40}); card._scheduleMapPaint(); const queued=card._mapFrame>0; card.remove(); return {queued,frame:card._mapFrame,rect:card._mapGestureRect};
  });
  expect(result).toEqual({queued:true,frame:0,rect:null});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
  expect(await page.evaluate(()=>window.zoomRenders)).toBe(0);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
