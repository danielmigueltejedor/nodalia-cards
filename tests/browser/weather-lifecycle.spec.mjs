import {expect,test} from '@playwright/test';
const rows=[{datetime:'2026-10-01T12:00:00Z',temperature:10,templow:0,condition:'sunny'},{datetime:'2026-10-02T12:00:00Z',temperature:12,templow:2,condition:'rainy'}];
async function mount(page,config={},subscription=false){
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-weather-card'));
 await page.evaluate(({config,subscription,rows})=>{
  window.weatherCalls=[];window.weatherDisposed=[];
  window.weatherStates={'weather.one':{state:'sunny',attributes:{temperature:10,temperature_unit:'°C',wind_speed:10,wind_speed_unit:'km/h',pressure:1000,pressure_unit:'hPa',supported_features:3,forecast:rows}},'weather.two':{state:'rainy',attributes:{temperature:20,temperature_unit:'°C',supported_features:3}},'binary_sensor.meteoalarm':{state:'on',attributes:{headline:'Warning',description:'Initial warning',severity:'Moderate'}}};
  window.weatherConnection={subscribeMessage(callback,message){return new Promise((resolve,reject)=>window.weatherCalls.push({callback,message,resolve:()=>resolve(()=>window.weatherDisposed.push(message.entity_id+':'+message.forecast_type)),reject}));}};
  window.weatherHass=window.createHassFixture({entities:window.weatherStates,overrides:subscription?{connection:window.weatherConnection}:{}});
  const card=document.createElement('nodalia-weather-card');card.setConfig({entity:'weather.one',language:'en',show_forecast_details:true,forecast_type:'daily',animations:{enabled:false},...config});card.hass=window.weatherHass;document.querySelector('#fixture').append(card);window.weatherCard=card;
 },{config,subscription,rows});return page.locator('nodalia-weather-card');
}
test('Weather isolates forecast subscriptions across entities, types, connections and detached lifetimes',async({page})=>{
 const card=await mount(page,{},true);
 expect(await page.evaluate(()=>window.weatherCalls.length)).toBe(1);
 await page.evaluate(rows=>window.weatherCalls[0].callback({forecast:rows}),rows);await expect(card.locator('.weather-card__forecast-temp').first()).toHaveText('10°C / 0°C');
 await page.evaluate(()=>{window.weatherCard.setConfig({entity:'weather.two',language:'en',show_forecast_details:true,forecast_type:'daily',animations:{enabled:false}});window.weatherCard.hass=window.weatherHass;});
 await page.evaluate(()=>{window.weatherCalls[0].callback({forecast:[{temperature:999}]});window.weatherCalls[0].resolve();});
 await expect.poll(()=>page.evaluate(()=>window.weatherDisposed)).toEqual(['weather.one:daily']);await expect(card.locator('.weather-card__forecast-empty')).toBeVisible();
 await page.evaluate(rows=>{window.weatherCalls[1].callback({forecast:rows});window.weatherCalls[1].resolve();},rows);await expect(card.locator('.weather-card__forecast-temp').first()).toHaveText('10°C / 0°C');
 await card.locator('[data-weather-action="set-forecast-type"][data-forecast-type="hourly"]').click();
 await expect.poll(()=>page.evaluate(()=>window.weatherDisposed.length)).toBe(2);
 await page.evaluate(()=>window.weatherCalls[1].callback({forecast:[{temperature:888}]}));await expect(card.locator('.weather-card__forecast-empty')).toBeVisible();
 await page.evaluate(rows=>window.weatherCalls[2].callback({forecast:rows}),rows);await expect(card.locator('.weather-card__forecast-temp').first()).toHaveText('10°C');
 await page.evaluate(()=>{const connection={subscribeMessage:window.weatherConnection.subscribeMessage};window.weatherCard.hass={...window.weatherHass,connection};window.weatherCalls[2].callback({forecast:[{temperature:777}]});window.weatherCalls[2].reject(new Error('obsolete'));});
 expect(await page.evaluate(()=>window.weatherCalls.length)).toBe(4);
 await page.evaluate(rows=>window.weatherCalls[3].callback({forecast:rows}),rows);await expect(card.locator('.weather-card__forecast-temp').first()).toHaveText('10°C');
 await page.evaluate(()=>{window.weatherCard.remove();window.weatherCalls[3].callback({forecast:[{temperature:666}]});window.weatherCalls[3].resolve();});
 await expect.poll(()=>page.evaluate(()=>window.weatherDisposed.length)).toBe(3);
 await page.evaluate(()=>document.querySelector('#fixture').append(window.weatherCard));expect(await page.evaluate(()=>window.weatherCalls.length)).toBe(5);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Weather retries failed subscriptions, validates forecast payloads and treats empty live forecasts as authoritative',async({page})=>{
 const card=await mount(page,{},true);
 await page.evaluate(()=>window.weatherCalls[0].reject(new Error('offline')));await expect.poll(()=>page.evaluate(()=>window.weatherCard._forecastSubscription)).toBe(null);
 await page.evaluate(()=>window.weatherCard.hass=window.weatherHass);expect(await page.evaluate(()=>window.weatherCalls.length)).toBe(2);
 await page.evaluate(()=>window.weatherCalls[1].callback({forecast:[null,'bad',0,{datetime:'2026-10-01T12:00:00Z',temperature:0,templow:0,condition:'sunny'}]}));
 await expect(card.locator('.weather-card__forecast-item')).toHaveCount(1);await expect(card.locator('.weather-card__forecast-temp')).toHaveText('0°C / 0°C');
 await page.evaluate(()=>window.weatherCalls[1].callback({forecast:null}));await expect(card.locator('.weather-card__forecast-item')).toHaveCount(1);
 await page.evaluate(()=>window.weatherCalls[1].callback({forecast:[]}));await expect(card.locator('.weather-card__forecast-item')).toHaveCount(0);await expect(card.locator('.weather-card__forecast-empty')).toBeVisible();
 await page.evaluate(()=>{window.weatherCard.remove();window.weatherCalls[1].resolve();window.weatherConnection.subscribeMessage=()=>{throw new Error('sync offline');};document.querySelector('#fixture').append(window.weatherCard);});expect(await page.evaluate(()=>window.weatherCard._forecastSubscription)).toBe(null);expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Weather updates legacy forecasts, unit labels and alert details while keeping keyboard chart points and focus cleanup',async({page})=>{
 const card=await mount(page,{forecast_view:'chart',show_pressure_chip:true,show_meteoalarm_chip:true});
 const point=card.locator('.weather-card__forecast-chart-hit').first();await point.focus();await point.press('Enter');await expect(card.locator('.weather-card__forecast-popup')).toBeVisible();await card.locator('.weather-card__forecast-popup-close').press('Escape');await expect(card.locator('.weather-card__forecast-popup')).toHaveCount(0);
 await point.focus();await point.press(' ');await expect(card.locator('.weather-card__forecast-popup')).toBeVisible();await card.locator('.weather-card__forecast-popup-close').click();
 await page.evaluate(()=>{window.weatherStates['weather.one'].attributes.forecast[0].temperature=30;window.weatherStates['weather.one'].attributes.temperature_unit='°F';window.weatherStates['weather.one'].attributes.pressure_unit='Pa';window.weatherCard.hass=window.createHassFixture({entities:window.weatherStates});});
 await expect(card.locator('.weather-card__forecast-chart-hit').first()).toHaveAttribute('aria-label',/30°F/);await expect(card.locator('.weather-card__chip').filter({hasText:'1000 Pa'})).toBeVisible();
 await card.locator('[data-weather-action="open-meteoalarm"]').click();await expect(card.locator('[role="dialog"]')).toContainText('Initial warning');
 await page.evaluate(()=>{window.weatherStates['binary_sensor.meteoalarm'].attributes.description='Updated warning';window.weatherCard.hass=window.createHassFixture({entities:window.weatherStates});});await expect(card.locator('[role="dialog"]')).toContainText('Updated warning');
 await page.evaluate(()=>{window.weatherCard.hass=window.createHassFixture({entities:{}});});await expect(card.locator('[role="dialog"]')).toHaveCount(0);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Weather owns animation fallback work and preserves conversions, missing values and actual zero metrics',async({page})=>{
 const card=await mount(page,{unit_system:'imperial',animations:{enabled:true}});await expect(card.locator('.weather-card__temperature')).toHaveText('50°F');
 const result=await page.evaluate(()=>{const card=window.weatherCard;const original=window.NodaliaUtils.scheduleDeferTimer;window.NodaliaUtils.scheduleDeferTimer=undefined;card._triggerPressAnimation(card.shadowRoot.querySelector('.weather-card__content'));window.NodaliaUtils.scheduleDeferTimer=original;const before=card._fallbackAnimationTimers.size;card._suppressNextWeatherTap=true;card.remove();return{before,after:card._fallbackAnimationTimers.size,tap:card._suppressNextWeatherTap,entrance:card._entranceAnimationResetTimer};});expect(result).toEqual({before:1,after:0,tap:false,entrance:0});
 await page.evaluate(()=>{window.weatherCard.setConfig({entity:'weather.one',animations:'malformed',haptics:'malformed',show_pressure_chip:true});window.weatherStates['weather.one'].attributes.temperature=0;window.weatherStates['weather.one'].attributes.humidity=0;window.weatherStates['weather.one'].attributes.wind_speed=0;window.weatherStates['weather.one'].attributes.pressure=null;window.weatherCard.hass=window.createHassFixture({entities:window.weatherStates});document.querySelector('#fixture').append(window.weatherCard);});
 await expect(card.locator('.weather-card__temperature')).toHaveText('0°C');await expect(card.locator('.weather-card__chips')).toContainText('0%');await expect(card.locator('.weather-card__chips')).toContainText('0 km/h');await expect(card.locator('.weather-card__chips')).not.toContainText('hPa');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
