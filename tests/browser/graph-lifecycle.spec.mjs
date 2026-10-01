import {expect,test} from '@playwright/test';
test.use({hasTouch:true});
async function mount(page,{deferred=false,empty=false}={}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(()=>customElements.get('nodalia-graph-card'));
  await page.evaluate(({deferred,empty})=>{
    window.graphRequests=[]; window.graphRest=[]; window.graphActions=[];
    window.graphConnection={};
    window.graphConfig={entities:[{entity:'sensor.one',name:'Same name',color:'#ffaa00'},{entity:'sensor.two',name:'Same name',color:'#42a5f5'}],min:0,max:100,points:20,animations:{enabled:false}};
    window.graphRows=id=>[[{entity_id:id,state:'10',last_changed:new Date(Date.now()-7200000).toISOString()},{entity_id:id,state:id==='sensor.one'?'40':'80',last_changed:new Date(Date.now()-3600000).toISOString()}]];
    const hass=window.createHassFixture({entities:{'sensor.one':{state:'30',attributes:{friendly_name:'First',unit_of_measurement:'%'}},'sensor.two':{state:'70',attributes:{friendly_name:'Second',unit_of_measurement:'%'}}},overrides:{connection:window.graphConnection,user:{id:'first',is_admin:true},callWS(message){
      if(this?.states!==hass.states) throw new Error('Lost HA receiver');
      const entry={message}; window.graphRequests.push(entry);
      if(deferred) return new Promise((resolve,reject)=>Object.assign(entry,{resolve,reject}));
      return Promise.resolve(empty?{}:message.type==='history/history_during_period'?window.graphRows(message.entity_ids[0]):{});
    },auth:{fetchWithAuth:async path=>{window.graphRest.push(path);return new Response('[]',{status:200});}}}});
    window.graphHass=hass;
    const card=document.createElement('nodalia-graph-card');card.setConfig(window.graphConfig);card.hass=hass;
    card.addEventListener('hass-more-info',event=>window.graphActions.push(event.detail.entityId));
    document.querySelector('#fixture').append(card);window.graphCard=card;
  },{deferred,empty});
  return page.locator('nodalia-graph-card');
}
async function resolveHistory(page,start=0) {
  await page.evaluate(start=>window.graphRequests.slice(start).filter(entry=>entry.message.type==='history/history_during_period'&&entry.resolve).forEach(entry=>entry.resolve(window.graphRows(entry.message.entity_ids[0]))),start);
  await expect.poll(()=>page.evaluate(()=>window.graphCard._historyAbortController===null)).toBe(true);
}
test('Graph coalesces pending history and isolates stale fallbacks, connections and reconnects',async({page})=>{
  const card=await mount(page,{deferred:true});
  await expect.poll(()=>page.evaluate(()=>window.graphRequests.length)).toBe(2);
  await page.evaluate(()=>{
    for(let n=0;n<10;n++){window.graphHass.states['sensor.one'].state=String(31+n);window.graphCard.hass={...window.graphHass};}
  });
  expect(await page.evaluate(()=>window.graphRequests.length)).toBe(2);
  await page.evaluate(()=>{
    const next={...window.graphHass,connection:{},user:{id:'second',is_admin:true}};
    next.callWS=message=>new Promise((resolve,reject)=>window.graphRequests.push({message,resolve,reject}));
    window.graphHass=next;window.graphCard.hass=next;
    window.graphRequests[0].reject(new Error('Old connection'));
    window.graphRequests[1].resolve(window.graphRows('sensor.two'));
  });
  await expect.poll(()=>page.evaluate(()=>window.graphRequests.length)).toBe(4);
  expect(await page.evaluate(()=>({rest:window.graphRest.length,pending:window.graphCard._pendingHistoryKey!==''}))).toEqual({rest:0,pending:true});
  await resolveHistory(page,2);
  await expect(card.locator('.graph-card__chart-series-line')).toHaveCount(2);
  await page.evaluate(()=>{
    window.graphCard._historyLoadedAt=0;window.graphCard._requestHistory();window.graphCard.remove();
    document.querySelector('#fixture').append(window.graphCard);
  });
  await expect.poll(()=>page.evaluate(()=>window.graphRequests.length)).toBe(8);
  await page.evaluate(()=>{window.graphRequests[4].reject(new Error('Detached'));window.graphRequests[5].resolve(window.graphRows('sensor.two'));});
  expect(await page.evaluate(()=>window.graphCard._historyAbortController!==null)).toBe(true);
  await resolveHistory(page,6);
  expect(await page.evaluate(()=>window.graphRest.length)).toBe(0);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Graph caches successful empty history, retains missing readings and genuine zero, and updates used attributes',async({page})=>{
  const card=await mount(page,{empty:true});
  await expect.poll(()=>page.evaluate(()=>window.graphCard._historyAbortController===null)).toBe(true);
  const initial=await page.evaluate(()=>window.graphRequests.length);
  await page.evaluate(()=>{
    window.graphHass.states['sensor.one'].state='unavailable';window.graphHass.states['sensor.two'].state='unknown';
    window.graphCard.hass={...window.graphHass};window.graphCard._requestHistory();
  });
  expect(await page.evaluate(()=>window.graphRequests.length)).toBe(initial);
  await expect(card.locator('.graph-card__value-number')).toHaveText('--');
  const values=await page.evaluate(()=>{
    const card=window.graphCard,start=new Date(0),end=new Date(2000);
    card.setConfig({...window.graphConfig,min:null,max:''});
    const stats=card._normalizeStatisticsSeries({'sensor.one':[null,false,{start:0,mean:0},{start:1,mean:5},{start:2,mean:null}]});
    const history=card._normalizeHistorySeries({'sensor.one':[null,{last_changed:0,last_updated:1,state:0}]},start,end);
    const missing=card._normalizeStatisticsSeries({});
    const bounds=card._getGraphBounds(stats);
    card.setConfig({...window.graphConfig,min:0,max:0});
    return {stats:stats[0].samples,history:history[0].samples[0],missing:missing.map(row=>row.currentValue),bounds,zero:card._getGraphBounds([])};
  });
  expect(values.stats).toEqual([{ts:0,value:0},{ts:1000,value:5}]);
  expect(values.history).toEqual({ts:0,value:0});expect(values.missing).toEqual([null,null]);
  expect(values.bounds.min).toBeLessThan(0);expect(values.bounds.max).toBeGreaterThan(5);expect(values.zero).toEqual({min:0,max:1});
  await page.evaluate(()=>{
    window.graphCard.setConfig({...window.graphConfig,min:null,max:null,icon:""});
    window.graphHass.states['sensor.one'].attributes.device_class='humidity';window.graphCard.hass={...window.graphHass};
    window.graphSignature=window.graphCard._getRenderSignature();
    window.graphHass.states['sensor.one'].attributes.icon='mdi:water';window.graphCard.hass={...window.graphHass};
  });
  await expect(card.locator('.graph-card__icon ha-icon').first()).toHaveAttribute('icon','mdi:water');
  expect(await page.evaluate(()=>window.graphCard._getGraphBounds([]))).toEqual({min:20,max:80});
  expect(await page.evaluate(()=>window.graphCard._getRenderSignature()!==window.graphSignature)).toBe(true);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Graph keyboard preserves focus and patches line, tooltip and distinct same-name series points in place',async({page})=>{
  const card=await mount(page);
  await expect(card.locator('.graph-card__chart-series-line')).toHaveCount(2);
  const chart=card.locator('[data-graph-surface="chart"]');
  await chart.focus();await chart.press('Home');
  await expect(card.locator('.graph-card__tooltip')).toBeVisible();await expect(chart).toBeFocused();
  await page.evaluate(()=>{window.graphTooltip=window.graphCard.shadowRoot.querySelector('.graph-card__tooltip');window.graphLine=window.graphCard.shadowRoot.querySelector('.graph-card__hover-line');});
  await chart.press('End');
  await expect.poll(()=>page.evaluate(()=>window.graphCard._hoverIndex)).toBe(19);
  expect(await page.evaluate(()=>({tooltip:window.graphTooltip===window.graphCard.shadowRoot.querySelector('.graph-card__tooltip'),line:window.graphLine===window.graphCard.shadowRoot.querySelector('.graph-card__hover-line'),x:window.graphLine.getAttribute('x1'),points:[...window.graphCard.shadowRoot.querySelectorAll('[data-graph-hover-entity]')].map(node=>({entity:node.dataset.graphHoverEntity,top:node.style.top,left:node.style.left})),name:window.graphTooltip.querySelector('.graph-card__tooltip-name').textContent}))).toMatchObject({tooltip:true,line:true,x:'100.00',name:'Same name'});
  const points=await page.evaluate(()=>[...window.graphCard.shadowRoot.querySelectorAll('[data-graph-hover-entity]')].map(node=>({top:node.style.top,left:node.style.left})));
  expect(points[0].top).not.toBe(points[1].top);expect(points[0].left).toBe('99.7%');
  await chart.press('Escape');await expect(card.locator('.graph-card__hover-point')).toHaveCount(0);
  await expect(card.locator('.graph-card__tooltip')).not.toBeVisible();
  const series=card.locator('[data-graph-series="sensor.two"]');await series.focus();await series.press(' ');
  await expect(series).toBeFocused();await expect(card.locator('.graph-card__chart-series-line')).toHaveCount(1);
  const header=card.locator('.graph-card__header');await header.focus();await header.press('Enter');
  expect(await page.evaluate(()=>window.graphActions)).toEqual(['sensor.one']);
  await series.focus();await series.press(' ');
  await page.evaluate(()=>{
    window.graphCard.setConfig({...window.graphConfig,entities:window.graphConfig.entities.map(entry=>({...entry,name:''}))});
  });
  await expect(card.locator('.graph-card__chart-series-line')).toHaveCount(2);
  await page.evaluate(()=>{window.graphHass.states['sensor.one'].attributes.friendly_name='Renamed';window.graphHass.states['sensor.one'].attributes.unit_of_measurement='W';window.graphCard.hass={...window.graphHass};});
  await chart.focus();await chart.press('Home');
  await expect(card.locator('.graph-card__tooltip-name').first()).toHaveText('Renamed');
  await expect(card.locator('.graph-card__tooltip-value').first()).toContainText('W');
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Graph cancels native holds and animation fallback work on cancel, configuration change and detach',async({page})=>{
  const card=await mount(page);await expect(card.locator('.graph-card__chart-series-line')).toHaveCount(2);
  await page.clock.install();
  await page.evaluate(()=>{
    const surface=window.graphCard.shadowRoot.querySelector('[data-graph-surface="chart"]');
    surface.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,pointerId:20,pointerType:'mouse',clientX:50,clientY:50}));
    surface.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,composed:true,pointerId:20,pointerType:'mouse'}));
  });
  await page.clock.runFor(600);expect(await page.evaluate(()=>window.graphActions)).toEqual([]);
  await page.evaluate(()=>{
    const surface=window.graphCard.shadowRoot.querySelector('[data-graph-surface="chart"]');
    surface.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,pointerId:22,pointerType:'mouse',clientX:50,clientY:50}));
    surface.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,composed:true,pointerId:22,pointerType:'mouse',clientX:90,clientY:50}));
  });
  await page.clock.runFor(600);expect(await page.evaluate(()=>window.graphActions)).toEqual([]);
  await page.evaluate(()=>{
    const surface=window.graphCard.shadowRoot.querySelector('[data-graph-surface="chart"]');
    surface.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,composed:true,pointerId:21,pointerType:'mouse',clientX:50,clientY:50}));
    window.graphCard.setConfig({...window.graphConfig,animations:{enabled:true}});
  });
  await page.clock.runFor(600);expect(await page.evaluate(()=>window.graphActions)).toEqual([]);
  await page.evaluate(()=>{
    window.graphCard.shadowRoot.querySelector('[data-graph-series]').click();
    window.graphCard.remove();
  });
  expect(await page.evaluate(()=>({hold:window.graphCard._chartHoldTimer,pointer:window.graphCard._chartPointerSession,timers:window.graphCard._animationWork.timers.size,hover:window.graphCard._hoverFrame,tooltip:window.graphCard._tooltipSyncFrame}))).toEqual({hold:0,pointer:null,timers:0,hover:0,tooltip:0});
  await page.clock.runFor(1000);expect(await page.evaluate(()=>window.graphActions)).toEqual([]);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
