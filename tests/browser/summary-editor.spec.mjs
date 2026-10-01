import {expect,test} from '@playwright/test';
async function mount(page, config={}) {
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-room-summary-card'));
 await page.evaluate(async config=>{const editor=await customElements.get('nodalia-room-summary-card').getConfigElement();editor.setConfig(config);editor.hass=window.makeHass({'media_player.one':{state:'idle'},'camera.one':{state:'idle'}});document.querySelector('#fixture').append(editor);window.summaryEditorFixture=editor;window.summaryEditorEmitted=[];editor.addEventListener('config-changed',event=>window.summaryEditorEmitted.push(event.detail.config));},config);
 return page.locator('nodalia-room-summary-card-editor');
}
test('Summary editor keeps custom names and icons aligned when entities move or are removed',async({page})=>{
 const editor=await mount(page,{lights:['light.one','light.two','light.three'],embed_options:{lights:[{entity:'light.one',name:'One',icon:'mdi:lamp'},{entity:'light.two',name:'Two',icon:'mdi:lightbulb'},{entity:'light.three',name:'Three',icon:'mdi:ceiling-light'}]}});
 await editor.locator('[data-act="move-up"][data-list="lights"][data-index="2"]').click();
 expect(await page.evaluate(()=>window.summaryEditorEmitted.at(-1))).toMatchObject({lights:['light.one','light.three','light.two'],embed_options:{lights:[{entity:'light.one',name:'One'},{entity:'light.three',name:'Three',icon:'mdi:ceiling-light'},{entity:'light.two',name:'Two'}]}});
 await editor.locator('[data-act="remove"][data-list="lights"][data-index="0"]').click();expect(await page.evaluate(()=>window.summaryEditorEmitted.at(-1))).toMatchObject({lights:['light.three','light.two'],embed_options:{lights:[{entity:'light.three',name:'Three'},{entity:'light.two',name:'Two'}]}});
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Summary editor guards malformed nested media events and accepts native camera and player changes',async({page})=>{
 const editor=await mount(page,{media_player:'media_player.one',camera:'camera.one'});
 await expect(editor.locator('nodalia-media-player-editor')).toHaveCount(1);await expect(editor.locator('nodalia-camera-card-editor')).toHaveCount(1);
 await page.evaluate(()=>{const editor=window.summaryEditorFixture;editor.shadowRoot.querySelector('nodalia-media-player-editor').dispatchEvent(new CustomEvent('config-changed',{detail:{config:{players:'invalid'}},bubbles:true,composed:true}));});
 expect(await page.evaluate(()=>window.summaryEditorEmitted.at(-1).media_player)).toBeUndefined();
 await page.evaluate(()=>{const editor=window.summaryEditorFixture;editor.shadowRoot.querySelector('nodalia-media-player-editor').dispatchEvent(new CustomEvent('config-changed',{detail:{config:{players:[null,{entity:'media_player.two',name:'Two'},{entity:'media_player.one'}]}},bubbles:true,composed:true}));editor.shadowRoot.querySelector('nodalia-camera-card-editor').dispatchEvent(new CustomEvent('config-changed',{detail:{config:{cameras:['camera.two','camera.one']}},bubbles:true,composed:true}));});
 expect(await page.evaluate(()=>window.summaryEditorEmitted.at(-1))).toMatchObject({media_player:'media_player.two',media_players:['media_player.one'],camera:'camera.two',camera_config:{entity:'camera.two',cameras:['camera.two','camera.one']}});
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
