import {expect,test} from '@playwright/test';
test('Notifications templates render absent measurements without a unit and preserve a real zero',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-notifications-card'));
 await page.evaluate(()=>{const card=document.createElement('nodalia-notifications-card');card.setConfig({smart_recommendations:false,custom_notifications:[{title:'Measurement:{sensor.temperature}',message:'Readout:{value}',entity:'sensor.temperature',condition:'always'}]});card.hass=window.makeHass({'sensor.temperature':{state:'',attributes:{friendly_name:'Temperature',unit_of_measurement:'°C'}}});document.querySelector('#fixture').append(card);window.notificationValuesFixture=card;});
 const card=page.locator('nodalia-notifications-card');await expect(card.locator('ha-card')).toContainText('Measurement:');await expect(card.locator('ha-card')).not.toContainText('°C');
 await page.evaluate(()=>{window.notificationValuesFixture.hass=window.makeHass({'sensor.temperature':{state:'0',attributes:{friendly_name:'Temperature',unit_of_measurement:'°C'}}});});await expect(card.locator('ha-card')).toContainText('Measurement:0°C');await expect(card.locator('ha-card')).toContainText('Readout:0°C');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
