import { expect, test } from '@playwright/test';

// A committed slider drag arms a one-shot "suppress next tap" flag so the click
// synthesized by the release does not toggle the card. That flag must only ever
// swallow that click: a later deliberate icon tap has to toggle exactly once.
const CARDS = [
  {
    tag: 'nodalia-humidifier-card',
    entity: 'humidifier.one',
    states: { 'humidifier.one': { state: 'on', attributes: { friendly_name: 'Humidifier', humidity: 50, min_humidity: 0, max_humidity: 100 } } },
    slider: 'input[type="range"][data-humidifier-control]',
    icon: '[data-humidifier-action="icon"]',
    sliderCall: ['humidifier', 'set_humidity'],
    toggleCall: ['humidifier', 'turn_off'],
  },
  {
    tag: 'nodalia-fan-card',
    entity: 'fan.one',
    states: { 'fan.one': { state: 'on', attributes: { friendly_name: 'Fan', percentage: 50, percentage_step: 5, supported_features: 1 } } },
    slider: 'input[type="range"][data-fan-control]',
    icon: '[data-fan-action="icon"]',
    sliderCall: ['fan', 'set_percentage'],
    toggleCall: ['fan', 'turn_off'],
  },
  {
    tag: 'nodalia-cover-card',
    entity: 'cover.one',
    states: { 'cover.one': { state: 'open', attributes: { friendly_name: 'Cover', current_position: 50, supported_features: 15 } } },
    slider: 'input[type="range"][data-cover-control="position"]',
    icon: '[data-cover-action="icon"]',
    sliderCall: ['cover', 'set_cover_position'],
    toggleCall: ['cover', 'close_cover'],
  },
  {
    tag: 'nodalia-light-card',
    entity: 'light.one',
    states: { 'light.one': { state: 'on', attributes: { friendly_name: 'Light', brightness: 128, supported_color_modes: ['brightness'], color_mode: 'brightness' } } },
    slider: 'input[type="range"][data-light-control="brightness"]',
    icon: '[data-light-action="icon"]',
    sliderCall: ['light', 'turn_on'],
    toggleCall: ['light', 'turn_off'],
  },
];

async function mount(page, card, config) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(tag => customElements.get(tag), card.tag);
  await page.evaluate(({ card, config }) => {
    window.tapCalls = [];
    window.tapMoreInfo = 0;
    const states = structuredClone(card.states);
    const feedBack = (domain, service, data = {}) => {
      const entity = states[card.entity];
      if (service === 'turn_off') entity.state = 'off';
      if (service === 'close_cover') entity.state = 'closed';
      for (const [key, value] of Object.entries(data)) {
        if (key === 'position') entity.attributes.current_position = value;
        else if (key === 'brightness_pct') entity.attributes.brightness = Math.round(value * 2.55);
        else if (key !== 'entity_id') entity.attributes[key] = value;
      }
      element.hass = window.createHassFixture({ entities: states, overrides: { callService } });
    };
    // Mirror HA: record the call, then push the resulting state back to the card.
    const callService = (domain, service, data, target) => {
      window.tapCalls.push([domain, service]);
      window.setTimeout(() => feedBack(domain, service, { ...data, ...target }), 50);
      return Promise.resolve();
    };
    const element = document.createElement(card.tag);
    element.setConfig({ entity: card.entity, language: 'en', animations: { enabled: false }, haptics: { enabled: false }, ...config });
    element.hass = window.createHassFixture({ entities: states, overrides: { callService } });
    element.addEventListener('hass-more-info', () => { window.tapMoreInfo += 1; });
    document.querySelector('#fixture').append(element);
  }, { card, config });
  return page.locator(card.tag);
}

// The first HA assignment can still re-render the card; wait for a laid-out node.
async function boxOf(locator) {
  let box = null;
  await expect.poll(async () => (box = await locator.boundingBox()) !== null).toBe(true);
  return box;
}

async function tapAt(page, locator, xRatio = 0.5) {
  const box = await boxOf(locator);
  const x = box.x + box.width * xRatio;
  const y = box.y + box.height / 2;
  // Mobile projects drive real touches; desktop projects drive the mouse.
  if (test.info().project.use.hasTouch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

for (const card of CARDS) {
  for (const compact of ['never', 'always']) {
    test(`${card.tag} (${compact === 'always' ? 'compact' : 'full'}) slider tap does not swallow the next icon tap`, async ({ page }) => {
      const element = await mount(page, card, { compact_layout_mode: compact });
      const slider = element.locator(card.slider).first();
      await expect(slider).toBeVisible();

      await tapAt(page, slider, 0.75);
      await expect.poll(() => page.evaluate(() => window.tapCalls)).toEqual([card.sliderCall]);

      // Leave the drag's synthetic click well behind before the deliberate tap.
      await page.waitForTimeout(1000);
      await tapAt(page, element.locator(card.icon).first());
      await expect.poll(() => page.evaluate(() => window.tapCalls)).toEqual([card.sliderCall, card.toggleCall]);
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => window.tapCalls)).toEqual([card.sliderCall, card.toggleCall]);
      expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
    });
  }

  test(`${card.tag} hold still swallows its release click without blocking the next tap`, async ({ page }) => {
    test.skip(Boolean(test.info().project.use.hasTouch), 'Hold is driven with mouse down/up timing.');
    const element = await mount(page, card, { compact_layout_mode: 'never', icon_hold_action: 'more-info' });
    const icon = element.locator(card.icon).first();
    const box = await boxOf(icon);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect.poll(() => page.evaluate(() => window.tapMoreInfo)).toBe(1);
    await page.mouse.up();
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.tapCalls)).toEqual([]);

    await tapAt(page, icon);
    await expect.poll(() => page.evaluate(() => window.tapCalls)).toEqual([card.toggleCall]);
    expect(await page.evaluate(() => window.tapMoreInfo)).toBe(1);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}
