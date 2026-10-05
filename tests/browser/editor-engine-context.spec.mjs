import {expect,test} from '@playwright/test';
for(const name of ['climate','notifications'])for(const change of ['user','auth'])test(`${name} editor retires Engine status after same-object ${change} changes`,async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-climate-card-editor'));
 await page.evaluate(name=>{
  window.editorStatusRequests=[];window.NodaliaBackend={...window.NodaliaBackend,getEditorEngineStatus:()=>new Promise(resolve=>window.editorStatusRequests.push(resolve))};
  window.contextEditor=document.createElement(`nodalia-${name}-card-editor`);window.contextEditor.setConfig({entity:'climate.one'});
  window.contextEditorHass=window.createHassFixture({overrides:{connection:{},auth:{},user:{id:'first',is_admin:true}}});window.contextEditor.hass=window.contextEditorHass;document.querySelector('#fixture').append(window.contextEditor);
 },name);
 await expect.poll(()=>page.evaluate(()=>window.editorStatusRequests.length)).toBe(1);
 await page.evaluate(change=>{if(change==='user')window.contextEditorHass.user.id='second';else window.contextEditorHass.auth={};window.contextEditor.hass=window.contextEditorHass;},change);
 await expect.poll(()=>page.evaluate(()=>window.editorStatusRequests.length)).toBe(2);
 await page.evaluate(()=>window.editorStatusRequests[0]({available:true,version:'old',capabilities:[],caps:{notificationsBackground:true,climateSchedules:true}}));
 expect(await page.evaluate(()=>window.contextEditor._engineStatus)).toBe(null);
 await page.evaluate(()=>window.editorStatusRequests[1]({available:false,version:'current',capabilities:[],caps:{notificationsBackground:false,climateSchedules:false}}));
 await expect.poll(()=>page.evaluate(()=>window.contextEditor._engineStatus?.version)).toBe('current');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
