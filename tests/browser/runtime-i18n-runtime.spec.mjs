import {test,expect} from '@playwright/test';
async function load(page){await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>window.NodaliaI18n?.strings);}
test('Runtime locales keep every shipped vacuum error and disconnected charger label readable',async({page})=>{
  await load(page);
  const result=await page.evaluate(()=>{const api=window.NodaliaI18n;return Object.keys(api.PACK).map(lang=>({lang,charger:api.translateAdvanceVacuumReportedState(null,lang,'charger disconnected'),error:api.translateVacuumErrorState(null,lang,'main_brush_jammed'),same:api.strings(lang)===api.strings(lang)}));});
  expect(result).toHaveLength(12);expect(result.every(item=>item.charger && item.error && item.same)).toBe(true);
  expect(result.find(item=>item.lang==='es').error).toBe('Cepillo principal bloqueado');
  expect(result.find(item=>item.lang==='es').charger).not.toMatch(/charger/i);
  expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Fav renders boolean attributes in Spanish and refreshes false without changing entity state',async({page})=>{
  await load(page);await page.evaluate(()=>{const card=document.createElement('nodalia-fav-card');card.setConfig({entity:'sensor.one',state_attribute:'enabled',language:'es'});document.querySelector('#fixture').append(card);card.hass=window.makeHass({'sensor.one':{state:'ready',attributes:{enabled:true}}});window.booleanFav=card;});
  const chip=page.locator('nodalia-fav-card .fav-card__chip');await expect(chip).toHaveText('Sí');
  await page.evaluate(()=>{window.booleanFav.hass=window.makeHass({'sensor.one':{state:'ready',attributes:{enabled:false}}});});
  await expect(chip).toHaveText('No');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
test('Runtime merges a partial public locale safely in the native bundle',async({page})=>{
  await load(page);const result=await page.evaluate(()=>{const api=window.NodaliaI18n,english=api.strings('en');api.PACK.fr=JSON.parse('{"calendarCard":{"allDay":"Custom"},"__proto__":{"polluted":"yes"}}');const locale=api.strings('fr');return {label:api.translateCalendarUi(null,'fr','allDay'),fallback:locale.calendarCard.fields.title===english.calendarCard.fields.title,prototype:Object.getPrototypeOf(locale).polluted??null,cached:locale===api.strings('fr')};});
  expect(result).toEqual({label:'Custom',fallback:true,prototype:null,cached:true});expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
