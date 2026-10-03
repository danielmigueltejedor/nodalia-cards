import {expect,test} from '@playwright/test';
test('Notifications templates render absent measurements without a unit and preserve a real zero',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-notifications-card'));
 await page.evaluate(()=>{const card=document.createElement('nodalia-notifications-card');card.setConfig({smart_recommendations:false,custom_notifications:[{title:'Measurement:{sensor.temperature}',message:'Readout:{value}',entity:'sensor.temperature',condition:'always'}]});card.hass=window.makeHass({'sensor.temperature':{state:'',attributes:{friendly_name:'Temperature',unit_of_measurement:'°C'}}});document.querySelector('#fixture').append(card);window.notificationValuesFixture=card;});
 const card=page.locator('nodalia-notifications-card');await expect(card.locator('ha-card')).toContainText('Measurement:');await expect(card.locator('ha-card')).not.toContainText('°C');
 await page.evaluate(()=>{window.notificationValuesFixture.hass=window.makeHass({'sensor.temperature':{state:'0',attributes:{friendly_name:'Temperature',unit_of_measurement:'°C'}}});});await expect(card.locator('ha-card')).toContainText('Measurement:0°C');await expect(card.locator('ha-card')).toContainText('Readout:0°C');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Rain notification templates show the current weather temperature and react to HA updates',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-notifications-card'));
 await page.evaluate(()=>{
  const forecast=[{datetime:new Date(Date.now()+3600000).toISOString(),condition:'rainy',temperature:9}];
  const card=document.createElement('nodalia-notifications-card');
  card.setConfig({language:'es',weather_entities:['weather.openweathermap'],smart_notifications:{rain:{title:'Lluvia próxima: {temperature}{temperature_unit}'}},smart_entity_overrides:[{entity:'weather.openweathermap',message:'Fuera hacen {value}.',mobile:'inherit'}],animations:{enabled:false}});
  card.hass=window.createHassFixture({entities:{'weather.openweathermap':{state:'rainy',attributes:{friendly_name:'Tiempo',temperature:15.2,temperature_unit:'°C',forecast}}},overrides:{callWS:async()=>({response:{'weather.openweathermap':{forecast}}})}});
  document.querySelector('#fixture').append(card);window.rainTemperatureCard=card;
 });
 const card=page.locator('nodalia-notifications-card');
 await expect(card.locator('ha-card')).toContainText('Lluvia próxima: 15.2°C');
 await expect(card.locator('ha-card')).toContainText('Fuera hacen 15.2°C.');
 await page.evaluate(()=>{const card=window.rainTemperatureCard;card.hass={...card._hass,states:{...card._hass.states,'weather.openweathermap':{...card._hass.states['weather.openweathermap'],attributes:{...card._hass.states['weather.openweathermap'].attributes,temperature:0}}}};});
 await expect(card.locator('ha-card')).toContainText('Fuera hacen 0°C.');
 await expect(card.locator('ha-card')).toContainText('Lluvia próxima: 0°C');
 await page.evaluate(()=>{const card=window.rainTemperatureCard;card.hass={...card._hass,states:{...card._hass.states,'weather.openweathermap':{...card._hass.states['weather.openweathermap'],attributes:{...card._hass.states['weather.openweathermap'].attributes,temperature:32,temperature_unit:'°F'}}}};});
 await expect(card.locator('ha-card')).toContainText('Fuera hacen 32°F.');
 await expect(card.locator('ha-card')).toContainText('Lluvia próxima: 32°F');
 await page.evaluate(()=>{const card=window.rainTemperatureCard;card.hass={...card._hass,states:{...card._hass.states,'weather.openweathermap':{...card._hass.states['weather.openweathermap'],attributes:{...card._hass.states['weather.openweathermap'].attributes,temperature:null}}}};});
 await expect(card.locator('ha-card')).toContainText('Fuera hacen .');
 await expect(card.locator('ha-card')).not.toContainText('Fuera hacen 0°C.');
 await expect(card.locator('ha-card')).not.toContainText('Fuera hacen 32°F.');
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
