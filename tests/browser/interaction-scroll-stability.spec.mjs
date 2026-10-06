import { expect, test } from '@playwright/test';
test.use({ hasTouch: true });

// Issue #320: pressing a control must not move a long dashboard. WebKit (iOS) scroll
// anchoring is enabled, and a card that re-renders its shadow tree must not make it
// adjust. The fixture mirrors HA: a block ha-card with its own shadow root inside a
// Sections grid, with long content above and below.
const devices = {
  humidifier: ['nodalia-humidifier-card', 'humidifier.one', { state: 'on', attributes: { friendly_name: 'Humidifier', humidity: 50, current_humidity: 44, min_humidity: 30, max_humidity: 80, mode: 'normal', available_modes: ['normal', 'eco', 'boost'], supported_features: 1 } }],
  fan: ['nodalia-fan-card', 'fan.one', { state: 'on', attributes: { friendly_name: 'Fan', percentage: 50, preset_mode: 'auto', preset_modes: ['auto', 'sleep'], supported_features: 9 } }],
  cover: ['nodalia-cover-card', 'cover.one', { state: 'open', attributes: { friendly_name: 'Cover', current_position: 50, supported_features: 15 } }],
  light: ['nodalia-light-card', 'light.one', { state: 'on', attributes: { friendly_name: 'Light', brightness: 128, supported_color_modes: ['hs', 'color_temp'], hs_color: [30, 50], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 } }],
};
const actionPrefix = { 'nodalia-humidifier-card': 'humidifier', 'nodalia-fan-card': 'fan', 'nodalia-cover-card': 'cover', 'nodalia-light-card': 'light' };

async function mountDashboard(page, [tag, entity, state], config = {}) {
  await page.route('**/tests/fixtures/browser.html', async route => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace('class extends HTMLElement {}', `class extends HTMLElement {
      constructor(){super();if(this.localName==='ha-card') this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;box-sizing:border-box;position:relative}</style><slot></slot>';}
    }`) });
  });
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(tag => customElements.get(tag), tag);
  await page.evaluate(({ tag, entity, state, config }) => {
    const fixture = document.querySelector('#fixture');
    fixture.style.cssText = 'display:block;max-width:none';
    const filler = height => { const node = document.createElement('div'); node.style.cssText = `grid-column:span 12;height:${height}px;border-radius:12px;background:#1d2027`; return node; };
    const section = document.createElement('hui-section');
    section.style.cssText = 'display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px';
    const card = document.createElement(tag);
    card.setConfig({ entity, ...config });
    const wrapper = document.createElement('hui-card'); wrapper.append(card);
    const cell = document.createElement('div'); cell.className = 'card'; cell.style.gridColumn = 'span 12'; cell.append(wrapper);
    section.append(filler(1400), cell, filler(1800));
    fixture.append(section);
    const scroll = window.scrollFixture = { card, calls: [], min: 0, max: 0, states: { [entity]: state } };
    const assign = () => { const hass = window.makeHass(scroll.states); hass.callService = callService; card.hass = hass; };
    // HA feedback arrives shortly after a command, as a fresh hass object.
    const callService = async (domain, service, data = {}) => {
      scroll.calls.push(`${domain}.${service}`);
      setTimeout(() => {
        const current = scroll.states[entity];
        const next = { ...current, attributes: { ...current.attributes }, last_updated: String(performance.now()) };
        if (/turn_on|open_cover/.test(service)) next.state = domain === 'cover' ? 'open' : 'on';
        if (/turn_off|close_cover/.test(service)) next.state = domain === 'cover' ? 'closed' : 'off';
        if (service === 'toggle') next.state = current.state === 'on' ? 'off' : 'on';
        if ('mode' in data) next.attributes.mode = data.mode;
        if ('preset_mode' in data) next.attributes.preset_mode = data.preset_mode;
        if ('humidity' in data) next.attributes.humidity = data.humidity;
        if ('percentage' in data) next.attributes.percentage = data.percentage;
        scroll.states = { ...scroll.states, [entity]: next };
        assign();
      }, 120);
    };
    scroll.update = patch => {
      const current = scroll.states[entity];
      scroll.states = { ...scroll.states, [entity]: { ...current, ...patch, attributes: { ...current.attributes, ...patch.attributes }, last_updated: String(performance.now()) } };
      assign();
    };
    assign();
    window.addEventListener('scroll', () => { scroll.min = Math.min(scroll.min, scrollY); scroll.max = Math.max(scroll.max, scrollY); }, { passive: true });
  }, { tag, entity, state, config });
  await page.waitForTimeout(700);
  return page.locator(tag);
}

/** Scroll like a user so the card top sits `offset` px below (or above, if negative) the viewport top. */
async function placeCard(page, offset) {
  await page.evaluate(offset => window.scrollTo(0, scrollY + window.scrollFixture.card.getBoundingClientRect().top - offset), offset);
  await page.waitForTimeout(120);
}

/** Run an interaction and report how far the page scrolled, including transient movement. */
async function scrollDuring(page, action, settle = 1100) {
  await page.evaluate(() => { const scroll = window.scrollFixture; scroll.start = scrollY; scroll.min = scroll.max = scrollY; });
  await action();
  await page.waitForTimeout(settle);
  return page.evaluate(() => {
    const { start, min, max } = window.scrollFixture;
    return { moved: Math.round(scrollY - start), range: Math.round(max - min) };
  });
}

const press = async (page, locator, isMobile) => {
  const box = await locator.boundingBox();
  if (isMobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

for (const [name, device] of Object.entries(devices)) {
  test(`${name} HA feedback re-renders keep the dashboard still while the card is partly scrolled past`, async ({ page }) => {
    await mountDashboard(page, device);
    const [, , state] = device;
    const results = [];
    for (const offset of [-120, -60, -20, 40]) {
      await placeCard(page, offset);
      results.push(await scrollDuring(page, () => page.evaluate(attributes => window.scrollFixture.update({ attributes }), {
        friendly_name: `${state.attributes.friendly_name} ${offset}`,
      }), 400));
    }
    expect(results).toEqual(results.map(() => ({ moved: 0, range: 0 })));
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}

/** Scroll like a user so a control sits `y` px below the viewport top, then press it. */
async function pressAt(page, locator, y, isMobile) {
  await locator.evaluate((node, y) => window.scrollTo(0, scrollY + node.getBoundingClientRect().top - y), y);
  await page.waitForTimeout(120);
  return scrollDuring(page, () => press(page, locator, isMobile));
}

for (const viewport of [{ width: 360, height: 740 }, { width: 393, height: 852 }, { width: 430, height: 932 }]) {
  for (const layout of ['auto', 'never']) {
    test(`Humidifier ${layout === 'auto' ? 'compact' : 'full'} controls keep the dashboard scroll position at ${viewport.width}x${viewport.height}`, async ({ page, isMobile }) => {
      await page.setViewportSize(viewport);
      const card = await mountDashboard(page, devices.humidifier, { compact_layout_mode: layout });
      await expect(card.locator('ha-card')).toHaveClass(layout === 'auto' ? /humidifier-card--compact/ : /^(?!.*humidifier-card--compact)/);
      const icon = card.locator('[data-humidifier-action="icon"]');
      const slider = card.locator('input[data-humidifier-control="humidity"]');
      const panelToggle = card.locator('[data-humidifier-action="toggle-mode-panel"]');
      const results = {};
      // 8px: the card top is already scrolled past, the usual case on a long phone dashboard.
      const positions = [8, 240, viewport.height - 160];
      for (const y of positions) {
        results[`${y}:off`] = await pressAt(page, icon, y, isMobile);
        await expect(card.locator('ha-card')).toHaveClass(/is-off/);
        results[`${y}:on`] = await pressAt(page, icon, y, isMobile);
        await expect(slider).toBeVisible();
        if (layout === 'never') {
          results[`${y}:panel`] = await pressAt(page, panelToggle, y, isMobile);
          results[`${y}:mode`] = await pressAt(page, card.locator(`[data-humidifier-action="mode"][data-mode="${y === 8 ? 'eco' : 'normal'}"]`), y, isMobile);
          if (await card.locator('.humidifier-card__panel').count()) results[`${y}:close`] = await pressAt(page, panelToggle, y, isMobile);
          await expect(card.locator('.humidifier-card__panel')).toHaveCount(0);
        }
        results[`${y}:feedback`] = await scrollDuring(page, () => page.evaluate(y => window.scrollFixture.update({ attributes: { current_humidity: 40 + y % 9 } }), y), 400);
      }
      for (const y of positions) results[`${y}:slider`] = await pressAt(page, slider, y, isMobile);
      expect(Object.entries(results).filter(([, delta]) => Math.abs(delta.moved) > 1 || delta.range > 1)).toEqual([]);
      expect(await page.evaluate(() => window.scrollFixture.calls.filter(call => call === 'humidifier.set_humidity').length)).toBe(positions.length);
      expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
    });
  }
}

test('Humidifier keyboard power keeps focus on the control without scrolling the dashboard', async ({ page }) => {
  const card = await mountDashboard(page, devices.humidifier);
  const icon = card.locator('[data-humidifier-action="icon"]');
  await icon.evaluate(node => window.scrollTo(0, scrollY + node.getBoundingClientRect().top - 8));
  await page.waitForTimeout(120);
  await icon.focus();
  for (const expected of [/is-off/, /is-on/]) {
    const delta = await scrollDuring(page, () => page.keyboard.press('Enter'));
    await expect(card.locator('ha-card')).toHaveClass(expected);
    expect(delta).toEqual({ moved: 0, range: 0 });
    // The re-rendered button, not a detached node or the card body, keeps keyboard focus.
    await expect(icon).toBeFocused();
  }
  expect(await page.evaluate(() => window.scrollFixture.calls)).toEqual(['humidifier.turn_off', 'humidifier.turn_on']);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
