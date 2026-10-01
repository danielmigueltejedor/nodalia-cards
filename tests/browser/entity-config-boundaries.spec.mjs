import {expect,test} from '@playwright/test';
test('Entity malformed style groups fall back and retain readable zero state',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-entity-card'));
 await page.evaluate(()=>{const card=document.createElement('nodalia-entity-card');card.setConfig({entity:'sensor.boundary',show_state:true,styles:{icon:null,card:false},animations:{enabled:false}});card.hass=window.makeHass({'sensor.boundary':{state:'0',attributes:{friendly_name:'Boundary',unit_of_measurement:'W'}}});document.querySelector('#fixture').append(card);});
 const card=page.locator('nodalia-entity-card');await expect(card.locator('ha-card')).toBeVisible();await expect(card.locator('ha-card')).toContainText('0');await expect(card.locator('ha-card')).toContainText('Boundary');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
