import {expect,test} from '@playwright/test';
test('Climate resolves modern translucent theme colors immediately without leaving probes',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-climate-card'));
 await page.evaluate(()=>{const card=document.createElement('nodalia-climate-card');card.setConfig({entity:'climate.one',animations:{enabled:false}});card.hass=window.makeHass({'climate.one':{state:'heat',attributes:{friendly_name:'One',current_temperature:20,temperature:21,min_temp:10,max_temp:30,hvac_modes:['off','heat']}}});document.querySelector('#fixture').append(card);window.climateColorFixture=card;});
 await expect(page.locator('nodalia-climate-card ha-card')).toBeVisible();
 for(const [text,background,light] of [['color(srgb 0 0 0 / .8)','color(srgb 1 1 1 / .8)',true],['rgb(100% 100% 100% / 80%)','rgb(0% 0% 0% / 80%)',false]]){
  const actual=await page.evaluate(({text,background})=>{const card=window.climateColorFixture;card.style.setProperty('--primary-text-color',text);card.style.setProperty('--ha-card-background',background);const before=card.childElementCount+card.shadowRoot.childElementCount;return {light:card._isLightThemeSurface(),before,after:card.childElementCount+card.shadowRoot.childElementCount};},{text,background});expect(actual.light).toBe(light);expect(actual.after).toBe(actual.before);
 }
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
