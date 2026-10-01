import {expect,test} from '@playwright/test';
test('Climate malformed nested config falls back safely and keeps a real zero target',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-climate-card'));
 await page.evaluate(()=>{const card=document.createElement('nodalia-climate-card');card.setConfig({entity:'climate.boundary',styles:{icon:false,dial:null},security:false,haptics:null,animations:{enabled:false},display:false});card.hass=window.makeHass({'climate.boundary':{state:'heat',attributes:{friendly_name:'Boundary',current_temperature:0,temperature:0,min_temp:0,max_temp:30,hvac_modes:['off','heat']}}});document.querySelector('#fixture').append(card);window.climateBoundaryFixture=card;});
 const card=page.locator('nodalia-climate-card');await expect(card.locator('ha-card')).toBeVisible();await expect(card.locator('ha-card')).toContainText('Boundary');await expect(card.locator('ha-card')).toContainText('0.0');expect(await page.evaluate(()=>window.climateBoundaryFixture._config.security.strict_service_actions)).toBe(true);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
