import { expect, test } from '@playwright/test';
async function mount(page, attributes={}) {
  await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-humidifier-card'));
  await page.evaluate(attributes=>{
    window.iconHass=window.makeHass({'humidifier.neutral':{state:'on',attributes},'weather.one':{state:'rainy',attributes:{temperature:15,temperature_unit:'°C'}}});
    for(const [tag,entity] of [['nodalia-humidifier-card','humidifier.neutral'],['nodalia-weather-card','weather.one']]) {
      const c=document.createElement(tag);c.setConfig({entity,animations:{enabled:true},compact_layout_mode:'never'});c.hass=window.iconHass;document.querySelector('#fixture').append(c);
    }
  },attributes);
}
for(const deviceClass of ['humidifier','dehumidifier']) test(`${deviceClass} particles follow device metadata, not the entity name`,async({page})=>{
  await mount(page,{device_class:deviceClass});
  const icon=page.locator('nodalia-humidifier-card .humidifier-card__icon');
  await expect.poll(()=>icon.evaluate(el=>['::before','::after'].map(pseudo=>getComputedStyle(el,pseudo).animationDirection))).toEqual(Array(2).fill(deviceClass==='dehumidifier'?'reverse':'normal'));
  await page.evaluate(()=>{const c=document.querySelector('nodalia-humidifier-card');window.iconHass.states['humidifier.neutral'].attributes.action='humidifying';c.hass={...window.iconHass};});
  await expect.poll(()=>icon.evaluate(el=>getComputedStyle(el,'::before').animationDirection)).toBe('normal');
  await page.evaluate(()=>{const c=document.querySelector('nodalia-humidifier-card');window.iconHass.states['humidifier.neutral'].attributes.action='dehumidifying';c.hass={...window.iconHass};});
  await expect.poll(()=>icon.evaluate(el=>getComputedStyle(el,'::before').animationDirection)).toBe('reverse');
});
test('Rain emits below the cloud and behind the foreground icon; reduced motion stops both particle effects',async({page})=>{
  await mount(page,{device_class:'dehumidifier'});
  const weather=page.locator('.weather-card__icon--rain-motion');
  const layers=await weather.evaluate(el=>{const drops=getComputedStyle(el,'::after'),cloud=getComputedStyle(el.querySelector('ha-icon'));return {dropZ:+drops.zIndex,cloudZ:+cloud.zIndex,origin:parseFloat(drops.top)/el.getBoundingClientRect().height,isolation:getComputedStyle(el).isolation};});
  expect(layers.cloudZ).toBeGreaterThan(layers.dropZ);expect(layers.origin).toBeGreaterThanOrEqual(.54);expect(layers.isolation).toBe('isolate');
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const selector of ['.weather-card__icon--rain-motion','.humidifier-card__icon--active-motion']) {
    expect(await page.locator(selector).evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
  }
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
