import { expect, test } from '@playwright/test';

// Insignia showed Home Assistant's raw state keys ("not_home") and tinted its separator dot green
// for a person who is away. States are translated, and "not somewhere known" looks inactive.
async function mountInsignia(page, { entity, state, attributes = {}, language = 'en', config = {} }) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-insignia-card'));
  await page.evaluate(({ entity, state, attributes, language, config }) => {
    const element = document.createElement('nodalia-insignia-card');
    element.setConfig({ entity, ...config });
    element.hass = window.createHassFixture({
      entities: { [entity]: { state, attributes: { friendly_name: 'Marta', ...attributes } } },
      overrides: { language, locale: { language } },
    });
    document.querySelector('#fixture').append(element);
  }, { entity, state, attributes, language, config });
  const card = page.locator('nodalia-insignia-card');
  await expect(card.locator('.insignia-card__title')).toBeVisible();
  return card;
}

// color-mix() results compute to color(srgb r g b) with 0-1 channels; rgb() uses 0-255.
const channels = color => {
  const numbers = color.match(/[\d.]+/g).map(Number).slice(0, 3);
  return color.startsWith('color(') ? numbers.map(value => value * 255) : numbers;
};

const read = card => card.evaluate(element => ({
  value: element.shadowRoot.querySelector('.insignia-card__value')?.textContent?.trim(),
  dot: getComputedStyle(element.shadowRoot.querySelector('.insignia-card__dot')).backgroundColor,
}));

test('away person reads as a translated state with a neutral dot, home keeps its green dot', async ({ page }) => {
  const away = await read(await mountInsignia(page, { entity: 'person.marta', state: 'not_home' }));
  expect(away.value).not.toMatch(/_/);
  expect(away.value).toMatch(/away|not home/i);
  const home = await read(await mountInsignia(page, { entity: 'person.marta', state: 'home' }));
  expect(home.value).toMatch(/home/i);
  expect(home.dot).not.toBe(away.dot);
  // The home dot is the green tint; the away dot must not be green.
  const [r, g, b] = channels(away.dot);
  expect(g - Math.max(r, b)).toBeLessThan(30);
  const [hr, hg, hb] = channels(home.dot);
  expect(hg - Math.max(hr, hb)).toBeGreaterThan(30);
});

test('states follow the Home Assistant language', async ({ page }) => {
  const spanish = await read(await mountInsignia(page, { entity: 'person.marta', state: 'not_home', language: 'es' }));
  expect(spanish.value).not.toMatch(/_/);
  expect(spanish.value).not.toMatch(/away|not home/i);
});

test('unknown keys are humanized, free text and numbers are untouched', async ({ page }) => {
  expect((await read(await mountInsignia(page, { entity: 'sensor.mode', state: 'deep_clean_pending' }))).value).toBe('Deep clean pending');
  expect((await read(await mountInsignia(page, { entity: 'person.marta', state: 'Work' }))).value).toBe('Work');
  expect((await read(await mountInsignia(page, { entity: 'sensor.temp', state: '21.5', attributes: { unit_of_measurement: '°C' } }))).value).toBe('21.5 °C');
  expect((await read(await mountInsignia(page, { entity: 'sensor.temp', state: 'unavailable' }))).value).not.toMatch(/_/);
});

test('fan and humidifier tints go neutral when off', async ({ page }) => {
  const on = channels((await read(await mountInsignia(page, { entity: 'fan.living', state: 'on' }))).dot);
  const off = channels((await read(await mountInsignia(page, { entity: 'fan.living', state: 'off' }))).dot);
  expect(on[2] - on[0]).toBeGreaterThan(40);
  expect(Math.abs(off[2] - off[0])).toBeLessThan(40);
});
