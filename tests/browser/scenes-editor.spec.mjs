import {expect,test} from '@playwright/test';
async function mount(page,config){await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-scenes-card'));await page.evaluate(async config=>{const editor=await customElements.get('nodalia-scenes-card').getConfigElement();editor.setConfig(config);editor.hass=window.makeHass({'scene.one':{state:'ready'},'scene.two':{state:'ready'}});document.querySelector('#fixture').append(editor);window.scenesEditorFixture=editor;window.scenesEditorEmitted=[];editor.addEventListener('config-changed',e=>window.scenesEditorEmitted.push(e.detail.config));},config);return page.locator('nodalia-scenes-card-editor');}
test('Scenes editor retains editable drafts while exporting only configured rows and preserves row metadata',async({page})=>{
 const editor=await mount(page,{scenes:[{entity:'scene.one',name:'One',icon:'mdi:lamp'},{entity:'scene.two',name:'Two',color:'#aabbcc'}]});
 await editor.locator('[data-action="move-scene-up"][data-index="1"]').click();expect(await page.evaluate(()=>window.scenesEditorEmitted.at(-1).scenes)).toEqual([{entity:'scene.two',name:'Two',color:'#aabbcc'},{entity:'scene.one',name:'One',icon:'mdi:lamp'}]);
 await editor.locator('[data-action="add-scene"]').click();await expect(editor.locator('.scene-editor-card')).toHaveCount(3);expect(await page.evaluate(()=>window.scenesEditorEmitted.at(-1).scenes)).toHaveLength(2);
 const newEntity=editor.locator('input[data-field="scenes.2.entity"]');await newEntity.fill('scene.three');await newEntity.dispatchEvent('change');expect(await page.evaluate(()=>window.scenesEditorEmitted.at(-1).scenes.at(-1))).toEqual({entity:'scene.three'});
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Scenes editor clears numeric overrides, guards malformed style groups and retains focus across HA updates',async({page})=>{
 const editor=await mount(page,{columns:5,scenes:['scene.one'],styles:{card:null,icon:'invalid',button:[]},haptics:null});
 const columns=editor.locator('input[data-field="columns"]');await columns.fill('');await columns.dispatchEvent('change');await expect(columns).toHaveValue('3');expect(await page.evaluate(()=>window.scenesEditorEmitted.at(-1).columns)).toBeUndefined();
 const name=editor.locator('input[data-field="name"]');await name.fill('Relax');await page.evaluate(()=>{window.scenesEditorFixture.hass=window.makeHass({'scene.one':{state:'ready',attributes:{friendly_name:'New name'}}});});await expect(name).toBeFocused();await expect(name).toHaveValue('Relax');
 await editor.locator('[data-editor-toggle="styles"]').click();await expect(editor.locator('input[data-field="styles.card.padding"]')).toHaveValue('14px');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
