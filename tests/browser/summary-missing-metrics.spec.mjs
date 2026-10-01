import {expect,test} from '@playwright/test';

test('Summary omits blank metric chips and shows a real zero immediately',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-room-summary-card'));
 await page.evaluate(()=>{
  const card=document.createElement('nodalia-room-summary-card');card.setConfig({name:'Room',temperature:'sensor.temp',animations:{enabled:false}});
  const state=value=>({state:value,attributes:{unit_of_measurement:'°C'}});card.hass=window.makeHass({'sensor.temp':state('')});document.querySelector('#fixture').append(card);window.summaryMetricFixture={card,state};
 });
 const card=page.locator('nodalia-room-summary-card');await expect(card.locator('.room-hub')).toBeVisible();await expect(card.locator('.room-hub__metric-bubble--temperature')).toHaveCount(0);
 await page.evaluate(()=>{const{card,state}=window.summaryMetricFixture;card.hass=window.makeHass({'sensor.temp':state('0')});});
 await expect(card.locator('.room-hub__metric-bubble--temperature')).toContainText('0°C');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
