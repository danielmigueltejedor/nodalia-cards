import {expect,test} from '@playwright/test';
test('News refreshes summary and URL when an existing article changes without a new headline',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-news-card'));
 await page.evaluate(()=>{const card=document.createElement('nodalia-news-card');card.setConfig({entity:'sensor.news',remember_items:false,layout:{mode:'list',show_summary:true}});const state=(summary,image,url)=>({state:'ready',attributes:{items:[{title:'Headline',summary,published:'2026-10-01T00:00:00Z',image,url}]}});card.hass=window.makeHass({'sensor.news':state('Before','','https://example.com/one')});document.querySelector('#fixture').append(card);window.newsContentFixture={card,state};});
 const card=page.locator('nodalia-news-card');await expect(card.locator('ha-card')).toContainText('Before');
 await page.evaluate(()=>{const{card,state}=window.newsContentFixture;card.hass=window.makeHass({'sensor.news':state('After','','https://example.com/two')});});await expect(card.locator('ha-card')).toContainText('After');await expect(card.locator('[data-news-url="https://example.com/two"]')).toBeVisible();await expect(card.locator('ha-card')).not.toContainText('Before');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
