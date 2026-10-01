import { expect, test } from '@playwright/test';

test('Media and Navigation render guarded nested YAML with their default control styles',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-media-player')&&customElements.get('nodalia-navigation-bar'));
 await page.evaluate(()=>{
  const hass=window.makeHass({'media_player.one':{state:'paused',attributes:{media_title:'One'}}});
  const media=document.createElement('nodalia-media-player');media.setConfig({entity:'media_player.one',layout:null,styles:false,artwork:{dim:null,opacity:null},animations:{enabled:false}});media.hass=hass;
  const nav=document.createElement('nodalia-navigation-bar');nav.setConfig({routes:[null,{icon:'mdi:home',path:'/home',popup:'bad'}],layout:false,styles:false,media_player:{players:'bad',artwork:false},animations:{enabled:false}});nav.hass=hass;
  document.querySelector('#fixture').append(media,nav);window.guardedConfigFixtures={media,nav};
 });
 await expect(page.locator('nodalia-media-player .media-player-card')).toBeVisible();
 await expect(page.locator('nodalia-navigation-bar .navbar')).toBeVisible();
 expect(await page.evaluate(()=>window.guardedConfigFixtures.media._config.artwork.dim)).toBe(.22);
 expect(await page.evaluate(()=>window.guardedConfigFixtures.nav._config.routes.length)).toBe(1);
 expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
