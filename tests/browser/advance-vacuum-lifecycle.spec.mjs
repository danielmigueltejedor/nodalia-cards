import {expect,test} from '@playwright/test';
async function mount(page,extra={}) {
 await page.route('**/local/vacuum-map.svg*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="#ccc"/></svg>'}));
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-advance-vacuum-card'));
 await page.evaluate(extra=>{
  window.avCalls=[];window.avDefer=false;
  window.avConfig={entity:'vacuum.one',language:'en',max_repeats:1,vacuum_platform:'roborock',map_source:{camera:'camera.map'},animations:{enabled:false},calibration_source:{calibration_points:[{map:{x:0,y:0},vacuum:{x:0,y:0}},{map:{x:1024,y:0},vacuum:{x:1024,y:0}},{map:{x:0,y:1024},vacuum:{x:0,y:1024}}]},room_segments:[{id:'1',label:'Living',outline:[[20,20],[490,20],[490,490],[20,490]]},{id:'2',label:'Kitchen',outline:[[520,20],[1000,20],[1000,490],[520,490]]}],...extra};
  window.avHass=window.createHassFixture({entities:{'vacuum.one':{state:'docked',attributes:{friendly_name:'Robot',battery_level:50,fan_speed:'Balanced',fan_speed_list:['Quiet','Balanced','Turbo']}},'vacuum.two':{state:'docked',attributes:{friendly_name:'Second'}},'camera.map':{state:'idle',attributes:{entity_picture:'/local/vacuum-map.svg'}}},overrides:{connection:{},user:{id:'first',is_admin:true},callService(domain,service,data,target){if(!this.states)throw new Error('Lost HA receiver');const row={domain,service,data,target,receiver:this};window.avCalls.push(row);return window.avDefer?new Promise((resolve,reject)=>Object.assign(row,{resolve,reject})):Promise.resolve();}}});
  const card=document.createElement('nodalia-advance-vacuum-card');card.setConfig(window.avConfig);card.hass=window.avHass;document.querySelector('#fixture').append(card);window.avCard=card;
 },extra);
 await expect.poll(()=>page.evaluate(()=>window.avCard.shadowRoot.querySelector('[data-map-image]')?.naturalWidth)).toBe(1024);
 return page.locator('nodalia-advance-vacuum-card');
}
const calls=page=>page.evaluate(()=>window.avCalls.map(({domain,service,data,target})=>({domain,service,data,target})));
test('Advance Vacuum keeps native room keyboard focus through HA updates and sends only selected rooms',async({page})=>{
 const card=await mount(page);await card.locator('[data-mode-id="rooms"]').press('Enter');const room=card.locator('button[data-room-id="1"]');await room.focus();await room.press(' ');await expect(room).toBeFocused();expect(await page.evaluate(()=>window.avCard._selectedRoomIds)).toEqual(['1']);
 await page.evaluate(()=>{window.avHass.states['vacuum.one'].attributes.battery_level=0;window.avCard.hass={...window.avHass};});await expect(room).toBeFocused();await card.locator('[data-control-action="primary"]').press('Enter');await expect.poll(()=>page.evaluate(()=>window.avCalls.length)).toBe(1);expect((await calls(page))[0]).toEqual({domain:'vacuum',service:'send_command',data:{entity_id:'vacuum.one',command:'app_segment_clean',params:[{segments:[1],repeat:1}]},target:undefined});expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Advance Vacuum cancels room taps, goto and zone gestures without persisting a cancelled selection',async({page})=>{
 const card=await mount(page);await card.locator('[data-mode-id="rooms"]').press('Enter');const room=card.locator('button[data-room-id="1"]');await room.dispatchEvent('pointerdown',{pointerId:9,pointerType:'touch',button:0,clientX:20,clientY:20});await room.dispatchEvent('pointercancel',{pointerId:9,pointerType:'touch',clientX:20,clientY:20});await room.dispatchEvent('pointerup',{pointerId:9,pointerType:'touch',clientX:20,clientY:20});expect(await page.evaluate(()=>window.avCard._selectedRoomIds)).toEqual([]);
 await card.locator('[data-mode-id="goto"]').press('Enter');let surface=card.locator('[data-map-surface="main"]');await surface.dispatchEvent('pointerdown',{pointerId:10,button:0,clientX:80,clientY:80});await surface.dispatchEvent('pointercancel',{pointerId:10,clientX:100,clientY:100});await surface.dispatchEvent('pointerup',{pointerId:10,clientX:100,clientY:100});expect(await page.evaluate(()=>window.avCard._gotoPoint)).toBe(null);
 await card.locator('[data-mode-id="zone"]').press('Enter');await surface.dispatchEvent('pointerdown',{pointerId:11,button:0,clientX:80,clientY:80});await surface.dispatchEvent('pointermove',{pointerId:11,clientX:200,clientY:200});await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await surface.dispatchEvent('pointerup',{pointerId:11,clientX:200,clientY:200});expect(await page.evaluate(()=>({zones:window.avCard._manualZones,draft:window.avCard._draftZone,pointers:window.avCard._gesturePointers.size}))).toEqual({zones:[],draft:null,pointers:0});expect(await calls(page)).toEqual([]);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Advance Vacuum retains real pointer capture while dragging a zone and rolls back cancellation',async({page})=>{
 const card=await mount(page);await card.locator('[data-mode-id="zone"]').press('Enter');await card.locator('[data-control-action="add_zone"]').press('Enter');expect(await page.evaluate(()=>window.avCard._manualZones.length)).toBe(1);
 const handle=card.locator('[data-zone-handle-action="move"]');const box=await handle.boundingBox();expect(box).not.toBeNull();await page.evaluate(()=>{window.avSurface=window.avCard.shadowRoot.querySelector('[data-map-surface="main"]');window.avOriginalZone=JSON.stringify(window.avCard._manualZones);window.avSurface.addEventListener('pointerdown',event=>window.avPointerId=event.pointerId,{once:true});});await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+25,box.y+box.height/2+25,{steps:4});
 expect(await page.evaluate(()=>window.avSurface===window.avCard.shadowRoot.querySelector('[data-map-surface="main"]'))).toBe(true);expect(await page.evaluate(()=>window.avSurface.hasPointerCapture(window.avPointerId))).toBe(true);expect(await page.evaluate(()=>JSON.stringify(window.avCard._manualZones)!==window.avOriginalZone)).toBe(true);
 await page.evaluate(()=>window.avSurface.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,composed:true,pointerId:window.avPointerId})));await page.mouse.up();expect(await page.evaluate(()=>JSON.stringify(window.avCard._manualZones)===window.avOriginalZone)).toBe(true);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Advance Vacuum retires deferred pause and owned delay before a zone command on another robot or user',async({page})=>{
 const card=await mount(page);await page.clock.install();await page.evaluate(()=>{window.avHass.states['vacuum.one'].state='cleaning';window.avCard.hass={...window.avHass};});await card.locator('[data-control-action="add_zone"]').press('Enter');await card.locator('[data-control-action="add_zone"]').press('Enter');await page.evaluate(()=>window.avDefer=true);await card.locator('[data-control-action="primary"]').press('Enter');expect((await calls(page)).map(row=>row.service)).toEqual(['pause']);
 await page.evaluate(()=>window.avCalls[0].resolve());await expect.poll(()=>page.evaluate(()=>window.avCard._waits.size)).toBeGreaterThan(0);await page.evaluate(()=>{window.avCard.setConfig({...window.avConfig,entity:'vacuum.two'});window.avHass={...window.avHass,connection:{},user:{id:'second',is_admin:true}};window.avCard.hass=window.avHass;});await page.clock.runFor(1000);expect((await calls(page)).map(row=>row.service)).toEqual(['pause']);expect(await page.evaluate(()=>({waiting:window.avCard._waits.size,inFlight:window.avCard._mapActionInFlight,zones:window.avCard._manualZones.length}))).toEqual({waiting:0,inFlight:false,zones:0});expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Advance Vacuum guards queued room resume and stale shared helper feedback across HA contexts',async({page})=>{
 await mount(page,{shared_cleaning_session_entity:'input_text.session'});await page.evaluate(()=>{window.avCalls=[];window.avHass.states['input_text.session']={entity_id:'input_text.session',state:'',attributes:{max:255}};window.avDefer=true;window.avCard._persistSharedCleaningSession({activeMode:'rooms',selectedRoomIds:['1']});window.avCard._setPendingRoomCleaningResume(['1'],1);window.avCard._attemptPendingRoomCleaningResume();window.avHass={...window.avHass,connection:{},user:{id:'second',is_admin:false}};window.avCard.hass=window.avHass;window.avCard._lastSubmittedSharedCleaningSessionValue='new-context';window.avCalls[0].reject(new Error('retired helper'));});
 await expect.poll(()=>page.evaluate(()=>window.avCard._roomCleaningResumeInFlight)).toBe(false);expect(await page.evaluate(()=>window.avCalls.filter(row=>row.domain==='vacuum').length)).toBe(0);expect(await page.evaluate(()=>window.avCard._lastSubmittedSharedCleaningSessionValue)).toBe('new-context');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Advance Vacuum scopes private sessions, handles malformed snapshots and refreshes mutated registries',async({page})=>{
 await mount(page);const result=await page.evaluate(()=>{const card=window.avCard;const first=card._getCleaningSessionStorageKey();card._persistCleaningSession({activeMode:'rooms',selectedRoomIds:['1'],selectionUpdatedAt:0,repeats:Infinity,pendingStartAt:NaN});const valid=card._readStoredCleaningSession();window.avHass.user.id='second';card.hass=window.avHass;const second=card._getCleaningSessionStorageKey();const empty=card._selectedRoomIds;window.avHass.entities={'vacuum.one':{device_id:'robot'},'sensor.active_room':{device_id:'other'}};window.avHass.states['sensor.active_room']={entity_id:'sensor.active_room',state:'1',attributes:{friendly_name:'Current room'}};const before=card._getRelatedVacuumEntityIds().roomIds;window.avHass.entities['sensor.active_room'].device_id='robot';const after=card._getRelatedVacuumEntityIds().roomIds;return{different:first!==second,valid,empty,before,after};});expect(result.different).toBe(true);expect(result.valid.repeats).toBe(1);expect(result.valid.pendingStartAt).toBe(0);expect(result.valid.selectionUpdatedAt).toBe(0);expect(result.empty).toEqual([]);expect(result.before).not.toContain('sensor.active_room');expect(result.after).toContain('sensor.active_room');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Advance Vacuum configured services retain targets and zero/false data, and never fall through a denied map action',async({page})=>{
 const card=await mount(page,{security:{strict_service_actions:true,allowed_service_domains:['switch']},custom_menu:{items:[{label:'Custom',tap_action:{action:'call-service',service:'switch.turn_on',service_data:{enabled:false,brightness:0},target:{area_id:'room'}}}]}});
 await page.evaluate(()=>window.avCard._runCustomMenuItem(window.avCard._config.custom_menu.items[0]));expect((await calls(page))[0]).toEqual({domain:'switch',service:'turn_on',data:{enabled:false,brightness:0},target:{area_id:'room'}});
 await page.evaluate(()=>{window.avCard.setConfig({...window.avConfig,security:{strict_service_actions:true,allowed_service_domains:['switch']},map_modes:[{template:'vacuum_clean_segment',service_call_schema:{service:'light.turn_on',service_data:{brightness:0}}}]});});await card.locator('[data-mode-id="rooms"]').press('Enter');await card.locator('button[data-room-id="1"]').press('Enter');await card.locator('[data-control-action="primary"]').press('Enter');expect(await page.evaluate(()=>window.avCalls.length)).toBe(1);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Advance Vacuum detachment releases gesture, locale, animation and delay work and ignores an old map image',async({page})=>{
 await mount(page);await page.clock.install();await page.evaluate(()=>{window.avOldImage=window.avCard.shadowRoot.querySelector('[data-map-image]');window.avCard._scheduleEntranceAnimationReset(600);window.avCard._scheduleLocaleReconciliation();window.avCard._waitForMapAction(450,window.avCard._generation);window.avCard.remove();window.avCard._onMapImageLoad({currentTarget:window.avOldImage});});expect(await page.evaluate(()=>({waits:window.avCard._waits.size,frames:window.avCard._localeFrames.size,locale:window.avCard._localeReconciliationTimeouts,entrance:window.avCard._entranceAnimationResetTimer,pointers:window.avCard._gesturePointers.size}))).toEqual({waits:0,frames:0,locale:null,entrance:0,pointers:0});await page.clock.runFor(2000);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Advance Vacuum ignores an older failed helper write after a newer selection in the same HA context',async({page})=>{
 await mount(page,{shared_cleaning_session_entity:'input_text.session'});
 await page.evaluate(()=>{window.avCalls=[];window.avHass.states['input_text.session']={entity_id:'input_text.session',state:'',attributes:{max:255}};window.avDefer=true;window.avCard._persistSharedCleaningSession({activeMode:'rooms',selectedRoomIds:['1']});window.avCard._persistSharedCleaningSession({activeMode:'rooms',selectedRoomIds:['2']});window.avLatest=window.avCard._lastSubmittedSharedCleaningSessionValue;window.avCalls[0].reject(new Error('older helper failed'));});
 await expect.poll(()=>page.evaluate(()=>window.avCalls.length)).toBe(2);
 expect(await page.evaluate(()=>window.avCard._lastSubmittedSharedCleaningSessionValue)).toBe(await page.evaluate(()=>window.avLatest));
 await page.evaluate(()=>{window.avCard._persistSharedCleaningSession({activeMode:'rooms',selectedRoomIds:['2']});window.avCalls[1].resolve();});
 expect(await page.evaluate(()=>window.avCalls.length)).toBe(2);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Advance Vacuum mounts its complete stylesheet before the first HA card connection and survives malformed error-color YAML',async({page})=>{
 await page.addInitScript(()=>{
  window.avFirstStyles=[];
  customElements.define('ha-card',class extends HTMLElement {connectedCallback(){const style=this.getRootNode().querySelector?.('[data-vacuum-style]');if(style) window.avFirstStyles.push(style.sheet.cssRules.length);}});
 });
 const card=await mount(page,{styles:{icon:{error_color:'var(--error-color,'}}});
 expect(await page.evaluate(()=>window.avFirstStyles[0])).toBeGreaterThan(20);
 await page.evaluate(()=>{window.avHass.states['vacuum.one']={...window.avHass.states['vacuum.one'],state:'error'};window.avCard.hass={...window.avHass};});
 expect(await card.locator('[data-control-action="primary"]').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(38);
 expect(await card.locator('ha-card').evaluate(el=>parseFloat(getComputedStyle(el).borderRadius))).toBeGreaterThan(20);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Advance Vacuum submits one smart command when suction and water share the fan service',async({page})=>{
 await mount(page);
 await page.evaluate(()=>{
  window.avHass.states['vacuum.one'].attributes.fan_speed_list=['Balanced','Smart'];
  window.avCard.hass={...window.avHass};window.avCalls=[];
  window.avCard._selectModePanelPreset('smart');
 });
 expect((await calls(page)).map(({domain,service,data})=>({domain,service,data}))).toEqual([{domain:'vacuum',service:'set_fan_speed',data:{entity_id:'vacuum.one',fan_speed:'Smart'}}]);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Advance Vacuum consumes entrance once and keeps smart controls visible through rapid cleaning feedback',async({page})=>{
 const card=await mount(page,{animations:{enabled:true,content_duration:600,panel_duration:500},suction_select_entity:'select.robot_fan',mop_select_entity:'select.robot_water',mop_mode_select_entity:'select.robot_route'});
 await page.clock.install();
 await page.evaluate(()=>{
  const hass=window.avHass;hass.states['vacuum.one'].state='cleaning';
  for(const [id,value] of [['select.robot_fan','balanced'],['select.robot_water','medium'],['select.robot_route','standard']]) hass.states[id]={entity_id:id,state:value,attributes:{options:[value,'smart']}};
  window.avCard.hass={...hass};window.avCalls=[];
 });
 await card.locator('[data-control-action="toggle_modes"]').press('Enter');
 await card.locator('[data-mode-preset-id="smart"]').press('Enter');
 const commands=await calls(page);
 expect(commands.filter(row=>row.domain==='select').map(row=>row.data.entity_id).sort()).toEqual(['select.robot_fan','select.robot_route','select.robot_water']);
 for(let i=0;i<8;i++) {
  await page.evaluate(i=>{window.avHass.states['vacuum.one'].last_updated=String(i);window.avCard.hass={...window.avHass};},i);
  await page.clock.runFor(100);
  expect(await card.locator('.advance-vacuum-card__utility-panel').evaluate(el=>({opacity:getComputedStyle(el).opacity,animation:getComputedStyle(el).animationName}))).toEqual({opacity:'1',animation:'none'});
 }
 expect(await card.locator('ha-card').evaluate(el=>el.classList.contains('advance-vacuum-card--entering'))).toBe(false);
 expect(await page.evaluate(()=>window.avCard._getActiveModePanelPreset())).toBe('smart');
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});

test('Advance Vacuum rejects failed presets without leaving smart selected and ignores failures from a retired selection',async({page})=>{
 await mount(page,{suction_select_entity:'select.robot_fan',mop_select_entity:'select.robot_water',mop_mode_select_entity:'select.robot_route'});
 await page.evaluate(()=>{
  window.avHass.states['vacuum.one'].state='cleaning';
  for(const [id,value] of [['select.robot_fan','balanced'],['select.robot_water','medium'],['select.robot_route','standard']]) window.avHass.states[id]={entity_id:id,state:value,attributes:{options:[value,'smart']}};
  window.avCard.hass={...window.avHass};window.avDefer=true;window.avCalls=[];window.avCard._selectModePanelPreset('smart');window.avCalls[0].reject(new Error('Cannot change while cleaning'));
 });
 await expect.poll(()=>page.evaluate(()=>window.avCard._activeModePanelPreset)).toBe('');
 await page.evaluate(()=>{
  for(const id of ['select.robot_fan','select.robot_water','select.robot_route']) window.avHass.states[id].state='smart';
  window.avCard.hass={...window.avHass};
 });
 expect(await page.evaluate(()=>window.avCard._getActiveModePanelPreset())).toBe('smart');
 await page.evaluate(()=>{
  for(const [id,value] of [['select.robot_fan','balanced'],['select.robot_water','medium'],['select.robot_route','standard']]) window.avHass.states[id].state=value;
  window.avCalls=[];window.avCard._selectModePanelPreset('smart');const old=window.avCalls[0];window.avCard._selectModePanelPreset('vacuum_mop');old.reject(new Error('Old command failed'));
 });
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
 expect(await page.evaluate(()=>window.avCard._activeModePanelPreset)).toBe('vacuum_mop');
 await page.evaluate(()=>{
  window.avCalls=[];window.avCard._selectModePanelPreset('smart');const old=window.avCalls[0];window.avCard.setConfig({...window.avConfig,entity:'vacuum.two'});old.reject(new Error('Retired robot command'));
 });
 await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
 expect(await page.evaluate(()=>window.avCard._activeModePanelPreset)).toBe('');
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
