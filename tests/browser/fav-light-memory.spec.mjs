import { expect, test } from '@playwright/test';

const memoryKey = 'nodalia-light-card:last-visual-state:v1';
async function mount(page, attributes = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-fav-card'));
  await page.evaluate(attributes => {
    localStorage.clear();
    window.memoryHass = window.makeHass({ 'light.one': { state: 'on', attributes } });
    window.memoryHass.callService = () => new Promise(() => {});
    const card = document.createElement('nodalia-fav-card');
    card.setConfig({ entity: 'light.one', haptics: { enabled: false } });
    card.hass = window.memoryHass;
    document.querySelector('#fixture').append(card);
    window.memoryCard = card;
  }, attributes);
  const card = page.locator('nodalia-fav-card');
  await expect.poll(() => card.evaluate(card => card._cardWidth)).toBeGreaterThan(0);
  return card;
}
async function update(page, state, attributes = {}) {
  await page.evaluate(({ state, attributes }) => {
    const hass = window.memoryHass;
    hass.states['light.one'] = { ...hass.states['light.one'], state, attributes };
    window.memoryCard.hass = hass;
  }, { state, attributes });
}
const accent = card => card.locator('ha-card').evaluate(node => getComputedStyle(node).getPropertyValue('--fav-accent').trim());

for (const [name, attrs, expected] of [
  ['RGB', { rgb_color: [30, 100, 220] }, 'rgb(30, 100, 220)'],
  ['warm kelvin', { color_temp_kelvin: 2700 }, '#f4b55f'],
  ['neutral kelvin', { color_temp_kelvin: 4000 }, '#ffd166'],
  ['cool mireds', { color_temp: 154 }, '#8fd3ff'],
]) {
  test(`Fav restores ${name} before the light acknowledges turn-on, including a partial confirmation`, async ({ page }) => {
    const card = await mount(page, attrs);
    await update(page, 'off', { rgb_color: null, color_temp_kelvin: 0, color_temp: 0 });
    await page.clock.install();
    await card.locator('.fav-card__icon').click();
    expect(await accent(card)).toBe(expected);
    expect(await page.evaluate(() => window.memoryHass.states['light.one'].state)).toBe('off');
    await update(page, 'on', { brightness: 180 });
    expect(await accent(card)).toBe(expected);
    await page.clock.fastForward(200);
    await update(page, 'on', { color_temp_kelvin: 6000 });
    expect(await accent(card)).toBe('#8fd3ff');
    await page.clock.fastForward(500);
    expect(await accent(card)).toBe('#8fd3ff');
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}

test('Fav shares persistent light memory with Light Card and preserves a custom on color', async ({ page }) => {
  const card = await mount(page);
  await page.evaluate(() => {
    const light = document.createElement('nodalia-light-card');
    light.setConfig({ entity: 'light.one', animations: { enabled: false } });
    light.hass = window.makeHass({ 'light.one': { state: 'on', attributes: { rgb_color: [125, 35, 210] } } });
    document.querySelector('#fixture').append(light);
  });
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key))['light.one'].attributes.rgb_color, memoryKey)).toEqual([125, 35, 210]);
  await update(page, 'off');
  await card.locator('.fav-card__icon').click();
  expect(await accent(card)).toBe('rgb(125, 35, 210)');
  await update(page, 'on', { rgb_color: [125, 35, 210] });
  await update(page, 'off');
  await page.reload();
  await page.waitForFunction(() => customElements.get('nodalia-fav-card'));
  await page.evaluate(() => {
    const card = document.createElement('nodalia-fav-card');
    card.setConfig({ entity: 'light.one' });
    card.hass = window.makeHass({ 'light.one': { state: 'off' } });
    document.querySelector('#fixture').append(card);
    window.memoryCard = card;
  });
  const restored = page.locator('nodalia-fav-card');
  await restored.locator('.fav-card__icon').click();
  expect(await accent(restored)).toBe('rgb(125, 35, 210)');
  await restored.evaluate(card => card.setConfig({ entity: 'light.one', styles: { icon: { on_color: '#123456' } } }));
  await restored.locator('.fav-card__icon').click();
  expect(await accent(restored)).toBe('#123456');
});

test('Fav memory survives unavailable storage, rolls back failures and retires partial-color timers on detach', async ({ page }) => {
  // The fixture must not access storage while setting up this case.
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-fav-card'));
  await page.evaluate(() => {
    window.memoryStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const original = window.localStorage;
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem(key) { if (key === 'nodalia-light-card:last-visual-state:v1') throw new Error('Storage denied'); return original.getItem(key); },
      setItem(key, value) { if (key === 'nodalia-light-card:last-visual-state:v1') throw new Error('Storage denied'); original.setItem(key, value); },
    } });
    const card = document.createElement('nodalia-fav-card');
    card.setConfig({ entity: 'light.one', haptics: { enabled: false } });
    window.memoryHass = window.makeHass({ 'light.one': { state: 'on', attributes: { rgb_color: [40, 170, 80] } } });
    window.memoryHass.callService = () => new Promise((resolve, reject) => { window.memoryReject = reject; });
    card.hass = window.memoryHass;
    document.querySelector('#fixture').append(card); window.memoryCard = card;
  });
  const card = page.locator('nodalia-fav-card');
  await update(page, 'off');
  await card.locator('.fav-card__icon').click();
  expect(await accent(card)).toBe('rgb(40, 170, 80)');
  await page.evaluate(() => window.memoryReject(new Error('Offline')));
  await expect(card.locator('ha-card')).toHaveClass(/is-off/);
  await card.locator('.fav-card__icon').click();
  await update(page, 'on');
  expect(await accent(card)).toBe('rgb(40, 170, 80)');
  await page.evaluate(() => window.memoryCard.remove());
  expect(await page.evaluate(() => window.memoryCard._lightVisualSettleTimer)).toBe(0);
  await page.evaluate(() => Object.defineProperty(window, 'localStorage', window.memoryStorageDescriptor));
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Fav copies mutable HA color arrays and retires the partial-color phase on entity and HA context changes', async ({ page }) => {
  const card = await mount(page, { rgb_color: [40, 100, 230] });
  await page.evaluate(() => {
    window.memoryHass.states['light.one'].attributes.rgb_color[0] = 250;
    delete window.memoryHass.states['light.one'].attributes.rgb_color;
    window.memoryHass.states['light.one'].state = 'off';
    window.memoryCard.hass = window.memoryHass;
  });
  await card.locator('.fav-card__icon').click();
  expect(await accent(card)).toBe('rgb(40, 100, 230)');
  for (const change of ['entity', 'user', 'connection', 'config']) {
    await card.evaluate(card => card.setConfig({ entity: 'light.one', haptics: { enabled: false } }));
    await update(page, 'on', { rgb_color: [40, 100, 230] });
    await update(page, 'off');
    await card.locator('.fav-card__icon').click();
    await update(page, 'on');
    expect(await accent(card)).toBe('rgb(40, 100, 230)');
    await page.evaluate(change => {
      const card = window.memoryCard, hass = window.memoryHass;
      if (change === 'entity') card.setConfig({ entity: 'light.two' });
      if (change === 'config') card.setConfig({ entity: 'light.one', name: 'Changed' });
      if (change === 'user') { hass.user = { id: 'other' }; card.hass = hass; }
      if (change === 'connection') { hass.connection = {}; card.hass = hass; }
    }, change);
    expect(await card.evaluate(card => ({ snapshot: card._lightVisualSettle, timer: card._lightVisualSettleTimer }))).toEqual({ snapshot: null, timer: 0 });
  }
});
