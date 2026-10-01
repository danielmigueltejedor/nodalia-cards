import {expect,test} from '@playwright/test';
test('Advanced Vacuum keeps nested rectangle rooms visible and ignores malformed map rows',async({page})=>{
 await page.goto('/tests/fixtures/browser.html');await page.waitForFunction(()=>customElements.get('nodalia-advance-vacuum-card'));
 await page.evaluate(()=>{const card=document.createElement('nodalia-advance-vacuum-card');card.setConfig({entity:'vacuum.test',room_segments:[null,{id:'one',label:'Kitchen',outlines:[[0,0,100,100]]}],calibration_source:{calibration_points:[null,{map:[0,0],vacuum:[0,0]}]},custom_menu:null,room_tracking:null});card.hass=window.makeHass({'vacuum.test':{state:'docked',attributes:{friendly_name:'Robot',battery_level:90}}});document.querySelector('#fixture').append(card);window.advancedGeometryFixture=card;});
 const card=page.locator('nodalia-advance-vacuum-card');await expect(card.locator('ha-card')).toBeVisible();await card.locator('[data-mode-id="rooms"]').click();await expect(card.locator('button[data-room-id="one"]')).toContainText('Kitchen');expect(await page.evaluate(()=>window.bundleErrors)).toEqual([]);
});
