import { expect, test } from '@playwright/test';

// Issue #321 reporter configuration (both cards in one horizontal-stack).
const reporterLight = (entity, name, icon) => ({
  entity, name, icon, show_state: false, compact_layout_mode: 'auto',
  show_brightness: true, show_slider_mode_buttons: true, show_quick_brightness: true,
  show_color_controls: true, show_temperature_controls: true, quick_brightness: [10, 35, 65, 100],
  haptics: { enabled: true, style: 'medium', fallback_vibrate: false },
  animations: { enabled: true, power_duration: 600, controls_duration: 600, mode_switch_duration: 600, button_bounce_duration: 320, mode_switch_horizontal: true },
  styles: {
    card: { background: 'var(--ha-card-background)', border: '1px solid var(--divider-color)', border_radius: '14px', box_shadow: 'var(--ha-card-box-shadow)', padding: '7px', gap: '6px' },
    icon: { size: '29px', background: 'color-mix(in srgb, var(--primary-text-color) 6%, transparent)', color: 'var(--primary-text-color)', on_color: 'var(--warning-color, #f6b73c)', off_color: 'var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 50%, transparent))' },
    control: { size: '20px', accent_color: 'var(--primary-text-color)', accent_background: 'rgba(var(--rgb-primary-color), 0.18)' },
    chip_height: '24px', chip_font_size: '11px', chip_padding: '0 9px', title_size: '14px',
    slider_wrap_height: '56px', slider_height: '16px', slider_thumb_size: '28px', slider_color: 'var(--primary-color)',
  },
});
const lightAttributes = { brightness: 150, color_mode: 'color_temp', color_temp_kelvin: 3200, hs_color: [30, 40], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500, supported_color_modes: ['color_temp', 'hs'] };

/**
 * Mirrors the HA views that own card placement. hui-view answers `card-updated` from a
 * card wrapper with `_cards = [..._cards]`; Masonry/Sidebar/Panel then rebuild their
 * containers and re-append every hui-card (disconnect + reconnect). Sections renders a
 * keyed repeat and keeps the same nodes, so it must still receive the notification.
 */
async function mountView(page, { kind = 'masonry', width = 900, columns = 3, stack, extra = [], states = {} }) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-light-card'));
  await page.evaluate(({ kind, width, columns, stack, extra, states }) => {
    const fixture = document.querySelector('#fixture');
    fixture.style.cssText = `display:block;max-width:none;width:${width}px`;
    const hass = window.makeHass(states);
    const nodalia = [];
    const makeCard = ({ tag, config }) => {
      const card = document.createElement(tag);
      card.setConfig(config); card.hass = hass; nodalia.push(card);
      return card;
    };
    const wrap = (element) => { const wrapper = document.createElement('hui-card'); wrapper.append(element); return wrapper; };
    const filler = (height) => {
      const card = document.createElement('div');
      card.style.cssText = `height:${height}px;background:#222;border-radius:12px`;
      card.getCardSize = () => Math.round(height / 50);
      return card;
    };
    const topLevel = [];
    if (stack) {
      // hui-horizontal-stack-card: #root flex, inner hui-card display:contents, children flex 1 1 0.
      const root = document.createElement('div');
      root.style.cssText = 'display:flex;gap:8px';
      for (const definition of stack) {
        const inner = wrap(makeCard(definition)); inner.style.display = 'contents';
        inner.firstElementChild.style.cssText = 'flex:1 1 0;min-width:0';
        root.append(inner);
      }
      root.getCardSize = () => Math.max(...[...root.querySelectorAll(':scope > hui-card > *')].map(card => card.getCardSize?.() ?? 1));
      topLevel.push(wrap(root));
    }
    for (const definition of extra) topLevel.push(wrap(definition.tag ? makeCard(definition) : filler(definition.height)));
    const view = document.createElement(kind === 'sections' ? 'hui-section' : 'div');
    view.style.cssText = kind === 'sections'
      ? 'display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:8px'
      : 'display:flex;align-items:flex-start;gap:8px';
    fixture.append(view);
    const state = window.viewFixture = { rebuilds: 0, notifications: 0, iteration: 0, nodalia, hass, view, topLevel };
    const nextRender = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
    const createColumns = async () => {
      const iteration = ++state.iteration; state.rebuilds++;
      const sizes = []; const elements = [];
      for (let i = 0; i < Math.min(columns, state.topLevel.length); i++) {
        const column = document.createElement('div'); column.style.cssText = 'flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:8px';
        sizes.push(0); elements.push(column);
      }
      view.replaceChildren(...elements);
      let started = performance.now();
      for (const card of state.topLevel) {
        if (performance.now() - started > 16) { await nextRender(); started = performance.now(); }
        const size = await Promise.resolve(card.firstElementChild.getCardSize?.() ?? 1);
        if (iteration !== state.iteration) return;
        const index = sizes.indexOf(Math.min(...sizes));
        sizes[index] += Number(size) || 1;
        elements[index].append(card);
      }
      for (const column of elements) if (!column.lastChild) column.remove();
    };
    for (const card of topLevel) {
      card.addEventListener('card-updated', (event) => {
        event.stopPropagation(); state.notifications++;
        state.topLevel = [...state.topLevel];
        if (kind === 'masonry') queueMicrotask(createColumns);
      });
    }
    if (kind === 'masonry') void createColumns();
    else for (const card of topLevel) { const cell = document.createElement('div'); cell.style.gridColumn = 'span 12'; cell.append(card); view.append(cell); }
  }, { kind, width, columns, stack, extra, states });
}

const reporterStates = (state) => ({
  'light.licht_douche': { state, attributes: { friendly_name: 'Douche', ...lightAttributes } },
  'light.badkamer_wastafel': { state, attributes: { friendly_name: 'Wastafel', ...lightAttributes } },
});
const reporterStack = () => [
  { tag: 'nodalia-light-card', config: reporterLight('light.licht_douche', 'Douche', 'mdi:shower-head') },
  { tag: 'nodalia-light-card', config: reporterLight('light.badkamer_wastafel', 'Wastafel', 'mdi:faucet-variant') },
];
const settle = (page, ms) => page.waitForTimeout(ms);

/** Observe a quiet window: view rebuilds, replaced card content and restarted animations. */
async function observeQuietWindow(page, ms = 1500) {
  await page.evaluate(() => {
    const state = window.viewFixture;
    state.marker = { rebuilds: state.rebuilds, notifications: state.notifications, content: state.nodalia.map(card => card.shadowRoot.querySelector('ha-card')), animations: 0 };
    for (const card of state.nodalia) card.shadowRoot.addEventListener('animationstart', () => state.marker.animations++);
  });
  await settle(page, ms);
  return page.evaluate(() => {
    const { marker, nodalia, rebuilds, notifications } = window.viewFixture;
    return {
      rebuilds: rebuilds - marker.rebuilds,
      notifications: notifications - marker.notifications,
      replacedContent: nodalia.filter((card, index) => card.shadowRoot.querySelector('ha-card') !== marker.content[index]).length,
      animations: marker.animations,
      connected: nodalia.every(card => card.isConnected),
    };
  });
}
const quiet = { rebuilds: 0, notifications: 0, replacedContent: 0, animations: 0, connected: true };

for (const lightState of ['on', 'off']) {
  test(`Masonry view stays still around the #321 horizontal-stack Light Cards (${lightState})`, async ({ page }) => {
    await mountView(page, { stack: reporterStack(), extra: [{ height: 220 }, { height: 120 }, { height: 340 }], states: reporterStates(lightState) });
    await settle(page, 1200);
    expect(await observeQuietWindow(page)).toEqual(quiet);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}

test('Masonry Light Cards stay usable: power commands and HA feedback update in place without a view relayout', async ({ page }) => {
  await mountView(page, { stack: reporterStack(), extra: [{ height: 220 }, { height: 120 }], states: reporterStates('off') });
  await page.evaluate(() => {
    const state = window.viewFixture; state.calls = [];
    // Feedback reaches every card just as hui-view forwards a new hass object.
    state.hass.callService = async (domain, service, data) => {
      state.calls.push([domain, service, data.entity_id]);
      const states = { ...state.hass.states, [data.entity_id]: { ...state.hass.states[data.entity_id], state: service === 'turn_on' ? 'on' : 'off', last_updated: String(performance.now()) } };
      const next = window.makeHass(states); next.callService = state.hass.callService; state.hass = next;
      for (const card of state.nodalia) card.hass = next;
    };
    for (const card of state.nodalia) card.hass = state.hass;
  });
  await settle(page, 1000);
  const before = await page.evaluate(() => window.viewFixture.rebuilds);
  const first = page.locator('nodalia-light-card').first();
  for (const expected of ['is-on', 'is-off', 'is-on']) {
    await first.locator('[data-light-action="icon"]').click();
    await expect(first.locator('.light-card')).toHaveClass(new RegExp(expected));
  }
  await expect(first.locator('input[data-light-control="brightness"]')).toBeVisible();
  await settle(page, 900);
  expect(await page.evaluate(() => window.viewFixture.calls.map(call => call[1]))).toEqual(['turn_on', 'turn_off', 'turn_on']);
  expect(await page.evaluate(() => window.viewFixture.rebuilds)).toBe(before);
  expect(await observeQuietWindow(page, 800)).toEqual(quiet);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

// Every card that reports settled sizes must leave Masonry/Sidebar/Panel layouts alone.
const notifierCards = [
  ['nodalia-light-card', 'light.one', { state: 'on', attributes: { brightness: 128, supported_color_modes: ['brightness'] } }],
  ['nodalia-fan-card', 'fan.one', { state: 'on', attributes: { supported_features: 1, percentage: 50 } }],
  ['nodalia-humidifier-card', 'humidifier.one', { state: 'on', attributes: { supported_features: 1, humidity: 50, min_humidity: 30, max_humidity: 80 } }],
  ['nodalia-cover-card', 'cover.one', { state: 'open', attributes: { supported_features: 15, current_position: 50 } }],
  ['nodalia-entity-card', 'switch.one', { state: 'on', attributes: {} }],
  ['nodalia-alarm-panel-card', 'alarm_control_panel.one', { state: 'disarmed', attributes: { supported_features: 63 } }],
  ['nodalia-fav-card', 'alarm_control_panel.two', { state: 'disarmed', attributes: { supported_features: 63 } }],
  ['nodalia-vacuum-card', 'vacuum.one', { state: 'docked', attributes: { supported_features: 16383 } }],
  ['nodalia-media-player', 'media_player.one', { state: 'playing', attributes: { media_title: 'Song', supported_features: 152463 } }],
];
test('Masonry view stays still around every card that reports settled sizes', async ({ page }) => {
  await mountView(page, {
    columns: 3,
    extra: [...notifierCards.map(([tag, entity]) => ({ tag, config: { entity, language: 'en' } })), { height: 160 }],
    states: Object.fromEntries(notifierCards.map(([, entity, state]) => [entity, state])),
  });
  await settle(page, 1500);
  expect(await observeQuietWindow(page)).toEqual(quiet);
  // The favourite alarm panel (a deliberate height change) still must not relayout Masonry.
  await page.locator('nodalia-fav-card .fav-card__hero').click();
  await expect(page.locator('nodalia-fav-card .fav-card__alarm-panel')).toBeVisible();
  await settle(page, 600);
  await page.locator('nodalia-fav-card .fav-card__hero').click();
  await settle(page, 900);
  expect(await page.evaluate(() => window.viewFixture.rebuilds)).toBe(1);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Sections still receives settled size changes from Light Cards and is quiet at a stable size', async ({ page }) => {
  await mountView(page, { kind: 'sections', stack: reporterStack(), states: reporterStates('off') });
  await settle(page, 1000);
  expect(await observeQuietWindow(page, 1000)).toEqual(quiet);
  const notifications = await page.evaluate(() => window.viewFixture.notifications);
  await page.evaluate(() => {
    const { hass, nodalia } = window.viewFixture;
    const states = Object.fromEntries(Object.entries(hass.states).map(([id, entity]) => [id, { ...entity, state: 'on', last_updated: 'on' }]));
    const next = window.makeHass(states);
    for (const card of nodalia) card.hass = next;
  });
  await expect.poll(() => page.evaluate(() => window.viewFixture.notifications)).toBeGreaterThan(notifications);
  await settle(page, 1200);
  expect(await observeQuietWindow(page, 1000)).toEqual(quiet);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Unrelated HA updates leave both horizontal-stack Light Cards without DOM churn', async ({ page }) => {
  await mountView(page, { stack: reporterStack(), extra: [{ height: 120 }], states: { ...reporterStates('on'), 'sensor.noise': { state: '0' } } });
  await settle(page, 1200);
  const mutations = await page.evaluate(async () => {
    const { nodalia } = window.viewFixture; let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    for (const card of nodalia) observer.observe(card.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true });
    let states = window.viewFixture.hass.states;
    for (let i = 1; i <= 60; i++) {
      states = { ...states, 'sensor.noise': { ...states['sensor.noise'], state: String(i), last_updated: String(i) } };
      const next = window.makeHass(states);
      for (const card of nodalia) card.hass = next;
      await new Promise(resolve => setTimeout(resolve, 8));
    }
    await new Promise(resolve => setTimeout(resolve, 300));
    observer.disconnect();
    return count;
  });
  expect(mutations).toBe(0);
  expect(await observeQuietWindow(page, 600)).toEqual(quiet);
});

test('Light responsive layout is stable at its threshold and still follows real width changes', async ({ page }) => {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-light-card'));
  await page.evaluate(({ config, states }) => {
    const box = document.createElement('div'); box.style.width = '700px';
    const card = document.createElement('nodalia-light-card');
    card.setConfig(config); card.hass = window.makeHass(states);
    box.append(card); document.querySelector('#fixture').append(box);
    window.thresholdFixture = { box, card };
  }, { config: reporterLight('light.licht_douche', 'Douche', 'mdi:shower-head'), states: reporterStates('on') });
  const compactAt = async width => {
    await page.evaluate(width => { window.thresholdFixture.box.style.width = `${width}px`; }, width);
    await settle(page, 250);
    // Hold the width (sub-pixel jitter rounds to the same measure) and record churn.
    return page.evaluate(async () => {
      const { box, card } = window.thresholdFixture; let mutations = 0;
      const observer = new MutationObserver(records => { mutations += records.length; });
      observer.observe(card.shadowRoot, { subtree: true, childList: true, attributes: true, characterData: true });
      const base = parseFloat(box.style.width);
      for (let i = 0; i < 12; i++) {
        box.style.width = `${base + (i % 2 ? 0.2 : 0)}px`;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      box.style.width = `${base}px`;
      await new Promise(resolve => setTimeout(resolve, 200));
      observer.disconnect();
      return { compact: card.shadowRoot.querySelector('.light-card').classList.contains('light-card--compact'), mutations };
    });
  };
  expect(await compactAt(700)).toEqual({ compact: false, mutations: 0 });
  expect(await compactAt(641)).toEqual({ compact: false, mutations: 0 });
  expect(await compactAt(639)).toEqual({ compact: true, mutations: 0 });
  expect(await compactAt(560)).toEqual({ compact: true, mutations: 0 });
  expect(await compactAt(700)).toEqual({ compact: false, mutations: 0 });
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
