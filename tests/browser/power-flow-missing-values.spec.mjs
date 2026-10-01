import {expect,test} from '@playwright/test';

test('Power Flow keeps whole kilowatt digits and renders absent consumption readings separately from zero',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-power-flow-card'));
 await page.evaluate(()=>{
  const card=document.createElement('nodalia-power-flow-card');card.setConfig({entities:{home:{entity:'sensor.home'},solar:{entity:'sensor.solar'}},consumption_chips:{day_entity:'sensor.day'},animations:{enabled:false}});
  const states={'sensor.home':{state:'10000',attributes:{unit_of_measurement:'W'}},'sensor.solar':{state:'10000',attributes:{unit_of_measurement:'W'}},'sensor.day':{state:'',attributes:{unit_of_measurement:'kWh'}}};
  card.hass=window.makeHass(states);document.querySelector('#fixture').append(card);window.powerFlowFixture={card,states};
 });
 const card=page.locator('nodalia-power-flow-card');
 await expect(card.locator('.power-flow-card__node--solar .power-flow-card__chip--value')).toHaveText('10 kW');
 await expect(card.locator('ha-card .power-flow-card__chip-stat-value')).toHaveText('--');
 await page.evaluate(()=>{const {card,states}=window.powerFlowFixture;states['sensor.day'].state='0';card.hass=window.makeHass(states);});
 await expect(card.locator('ha-card .power-flow-card__chip-stat-value')).toHaveText('0.00');
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
