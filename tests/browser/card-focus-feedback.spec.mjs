import { expect, test } from '@playwright/test';

async function mount(page, tag) {
  await page.route('**/tests/fixtures/browser.html', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('class extends HTMLElement {}', `class extends HTMLElement {
      constructor(){super();if(this.localName==='ha-card') this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;box-sizing:border-box;position:relative}</style><slot></slot>';}
    }`) });
  });
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(tag => customElements.get(tag), tag);
  await page.evaluate(tag => {
    document.documentElement.style.setProperty('--primary-color', '#ff9800');
    document.documentElement.style.setProperty('--primary-text-color', '#fff');
    document.documentElement.style.setProperty('--divider-color', '#333');
    document.documentElement.style.setProperty('--ha-card-background', '#24262c');
    const card = document.createElement(tag);
    card.setConfig({ entity: 'sensor.home', tap_action: 'more-info',
      entities: { grid: { entity: 'sensor.grid' }, home: { entity: 'sensor.home' } },
      styles: { card: { border_radius: '28px', background: '#24262c' } },
      animations: { enabled: false }, haptics: { enabled: false } });
    card.hass = window.makeHass({ 'sensor.home': { state: '191', attributes: { unit_of_measurement: 'W' } }, 'sensor.grid': { state: '191', attributes: { unit_of_measurement: 'W' } } });
    card.style.cssText = 'display:block;width:360px';
    document.querySelector('#fixture').append(card); window.visualFocusCard = card;
  }, tag);
  const card = page.locator(tag);
  await expect.poll(() => card.evaluate(card => typeof card._cardWidth !== 'number' || card._cardWidth > 0)).toBe(true);
  return card;
}

test('Graph primary header and chart show one rounded card frame without inner rectangles', async ({ page }, testInfo) => {
  const card = await mount(page, 'nodalia-graph-card');
  await page.keyboard.press('Tab');
  for (const selector of ['[data-graph-action="primary"]', '[data-graph-surface="chart"]']) {
    const target = card.locator(selector).first();
    await target.focus();
    expect(await target.evaluate(node => getComputedStyle(node).outlineStyle)).toBe('none');
    await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(1);
    expect(await card.locator('[data-nodalia-card-focus-frame]').evaluate(node => getComputedStyle(node).borderTopLeftRadius)).toBe('28px');
    if (selector.includes('primary')) await card.screenshot({ path: testInfo.outputPath('graph-focus.png'), scale: 'css' });
  }
  await card.locator('[data-graph-action="primary"]').first().click();
  await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(0);
  await page.keyboard.press('Shift');
  await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(1);
});

test('Power Flow paints a full two-pixel frame above its content on all four straight sides', async ({ page }, testInfo) => {
  const card = await mount(page, 'nodalia-power-flow-card');
  await card.locator('ha-card').evaluate(node => { node.style.height = '320px'; });
  await page.keyboard.press('Tab');
  await card.locator('[data-card-action="primary"]').focus();
  const screenshot = await card.locator('ha-card').screenshot({ scale: 'css', path: testInfo.outputPath('powerflow-focus.png') });
  const edges = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const color = (x, y) => [...ctx.getImageData(x, y, 1, 1).data].slice(0, 3);
    const x = Math.floor(image.width / 2), y = Math.floor(image.height / 2);
    return [color(x, 1), color(x, 2), color(x, image.height - 2), color(x, image.height - 3), color(1, y), color(2, y), color(image.width - 2, y), color(image.width - 3, y)];
  }, screenshot.toString('base64'));
  for (const color of edges) expect(color).toEqual([255, 152, 0]);
  await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(1);
});

test('a retained Lock control keeps its frame through HA updates and follows a changed card radius', async ({ page }) => {
  await mount(page, 'nodalia-graph-card');
  await page.evaluate(() => {
    const card = document.createElement('nodalia-lock-card');
    card.setConfig({ entity: 'lock.one', animations: { enabled: false }, styles: { card: { border_radius: '28px' } } });
    window.retainedLockHass = window.makeHass({ 'lock.one': { state: 'locked', attributes: { friendly_name: 'Lock' } } });
    card.hass = window.retainedLockHass;
    document.querySelector('#fixture').append(card); window.retainedLockCard = card;
  });
  const card = page.locator('nodalia-lock-card');
  await page.keyboard.press('Tab');
  const slider = card.locator('[role="slider"]');
  await slider.focus();
  await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(1);
  await page.evaluate(() => {
    window.retainedLockSlider = window.retainedLockCard.shadowRoot.activeElement;
    window.retainedLockHass.states['lock.one'].attributes.friendly_name = 'Updated';
    window.retainedLockCard.hass = window.retainedLockHass;
  });
  await expect(slider).toBeFocused();
  expect(await card.evaluate(card => card.shadowRoot.activeElement === window.retainedLockSlider)).toBe(true);
  await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(1);
  await card.evaluate(card => card.setConfig({ entity: 'lock.one', animations: { enabled: false }, styles: { card: { border_radius: '40px' } } }));
  await expect(slider).toBeFocused();
  await expect(card.locator('[data-nodalia-card-focus-frame]')).toHaveCount(1);
  expect(await card.locator('[data-nodalia-card-focus-frame]').evaluate(node => getComputedStyle(node).borderTopLeftRadius)).toBe('40px');
});
