import { expect, test } from '@playwright/test';

// A long press runs the hold action and arms a one-shot flag that swallows the
// click synthesized by the release. When the release happens off the card (the
// finger slid away, or the hold opened a dialog under it) no click ever reaches
// the card, so the flag must not survive to swallow the user's next real tap.
const CARDS = [
  { tag: 'nodalia-person-card', entity: 'person.me', states: { 'person.me': { state: 'home', attributes: { friendly_name: 'Me' } } }, surface: '[data-person-action="primary"]' },
  { tag: 'nodalia-insignia-card', entity: 'sensor.temp', states: { 'sensor.temp': { state: '21', attributes: { friendly_name: 'Temp', unit_of_measurement: '°C' } } }, surface: '.insignia-card' },
  { tag: 'nodalia-weather-card', entity: 'weather.home', states: { 'weather.home': { state: 'sunny', attributes: { friendly_name: 'Home', temperature: 21, humidity: 40 } } }, surface: 'ha-card' },
  { tag: 'nodalia-vacuum-card', entity: 'vacuum.robot', states: { 'vacuum.robot': { state: 'docked', attributes: { friendly_name: 'Robot', battery_level: 80 } } }, surface: 'ha-card' },
  { tag: 'nodalia-entity-card', entity: 'sensor.temp', states: { 'sensor.temp': { state: '21', attributes: { friendly_name: 'Temp', unit_of_measurement: '°C' } } }, surface: '[data-entity-action]' },
];

for (const card of CARDS) {
  test(`${card.tag} hold released off the card does not swallow the next tap`, async ({ page }) => {
    test.skip(Boolean(test.info().project.use.hasTouch), 'Hold is driven with mouse down/up timing.');
    await page.goto('/tests/fixtures/browser.html');
    await page.waitForFunction(tag => customElements.get(tag), card.tag);
    await page.evaluate(card => {
      window.moreInfo = 0;
      const element = document.createElement(card.tag);
      element.setConfig({ entity: card.entity, language: 'en', animations: { enabled: false }, haptics: { enabled: false }, tap_action: 'more-info', hold_action: 'more-info', double_tap_action: 'none' });
      element.hass = window.createHassFixture({ entities: structuredClone(card.states) });
      element.addEventListener('hass-more-info', () => { window.moreInfo += 1; });
      element.style.cssText = 'display:block;width:320px';
      document.querySelector('#fixture').append(element);
    }, card);
    const element = page.locator(card.tag);
    const surface = element.locator(card.surface).first();
    let box = null;
    await expect.poll(async () => (box = await surface.boundingBox()) !== null).toBe(true);

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => window.moreInfo)).toBe(1);
    // Release far away from the card: the browser never targets a click at it.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 300);
    await page.mouse.up();
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.moreInfo)).toBe(1);

    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => page.evaluate(() => window.moreInfo)).toBe(2);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}
