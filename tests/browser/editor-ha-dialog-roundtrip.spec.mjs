import { expect, test } from '@playwright/test';

// Every visual editor must keep working through Home Assistant's real edit-dialog flow:
// hui-element-editor deletes undefined keys on the emitted object, the dialog
// deep-freezes that same object, and both the preview card and the editor receive it
// back through setConfig. An editor that mutates a config it emitted or received stops
// emitting changes after the first edit.
const tags = 'nodalia-navigation-bar nodalia-media-player nodalia-light-card nodalia-fan-card nodalia-humidifier-card nodalia-circular-gauge-card nodalia-graph-card nodalia-power-flow-card nodalia-cover-card nodalia-climate-card nodalia-alarm-panel-card nodalia-lock-card nodalia-advance-vacuum-card nodalia-entity-card nodalia-fav-card nodalia-insignia-card nodalia-person-card nodalia-scenes-card nodalia-weather-card nodalia-calendar-card nodalia-notifications-card nodalia-vacuum-card nodalia-news-card nodalia-camera-card nodalia-room-summary-card'.split(' ');
for (const tag of tags) test(`${tag} visual editor applies repeated edits through the HA dialog flow`, async ({ page }) => {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(tag => customElements.get(tag), tag);
  const setup = await page.evaluate(async tag => {
    const states = {
      'light.one': { state: 'on', attributes: { friendly_name: 'Light One', brightness: 128, supported_color_modes: ['brightness'] } },
      'fan.one': { state: 'on', attributes: { friendly_name: 'Fan One', percentage: 50, supported_features: 1 } },
      'humidifier.one': { state: 'on', attributes: { friendly_name: 'Hum One', humidity: 50, min_humidity: 30, max_humidity: 80 } },
      'sensor.one': { state: '21', attributes: { friendly_name: 'Sensor One', unit_of_measurement: '°C', device_class: 'temperature' } },
      'cover.one': { state: 'open', attributes: { friendly_name: 'Cover One', current_position: 50, supported_features: 15 } },
      'climate.one': { state: 'heat', attributes: { friendly_name: 'Clima One', hvac_modes: ['off', 'heat'], temperature: 21, current_temperature: 20, min_temp: 7, max_temp: 30, supported_features: 1 } },
      'alarm_control_panel.one': { state: 'disarmed', attributes: { friendly_name: 'Alarm One', supported_features: 63 } },
      'lock.one': { state: 'locked', attributes: { friendly_name: 'Lock One' } },
      'vacuum.one': { state: 'docked', attributes: { friendly_name: 'Vac One', supported_features: 16383 } },
      'switch.one': { state: 'on', attributes: { friendly_name: 'Switch One' } },
      'person.one': { state: 'home', attributes: { friendly_name: 'Person One' } },
      'scene.one': { state: '2026-10-01T00:00:00Z', attributes: { friendly_name: 'Scene One' } },
      'weather.one': { state: 'sunny', attributes: { friendly_name: 'Weather One', temperature: 20 } },
      'calendar.one': { state: 'off', attributes: { friendly_name: 'Cal One' } },
      'media_player.one': { state: 'playing', attributes: { friendly_name: 'Media One', media_title: 'Song', supported_features: 152463 } },
      'camera.one': { state: 'idle', attributes: { friendly_name: 'Cam One', entity_picture: '/x.jpg' } },
      'sensor.news': { state: '1', attributes: { friendly_name: 'News', items: [] } },
    };
    const hass = window.makeHass(states);
    const Card = customElements.get(tag);
    let config;
    try { config = { type: `custom:${tag}`, ...(Card.getStubConfig?.(hass, Object.keys(states), Object.keys(states)) || {}) }; } catch (e) { return { error: 'stub ' + e.message }; }
    const card = document.createElement(tag);
    try { card.setConfig(config); } catch (e) { return { error: 'setConfig ' + e.message, config }; }
    card.hass = hass;
    const editor = await Card.getConfigElement();
    editor.hass = hass; editor.setConfig(Object.freeze(JSON.parse(JSON.stringify(config))));
    window.ed = { card, editor, config, changes: 0, last: null, hass, setConfigErrors: [] };
    const deepFreeze = value => { if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); Object.values(value).forEach(deepFreeze); } return value; };
    window.ed.errors = [];
    window.addEventListener('error', e => window.ed.errors.push(String(e.message)));
    // Exactly like HA: hui-element-editor deletes undefined keys on the emitted object,
    // the dialog deep-freezes that same object, then preview + editor get it back.
    editor.addEventListener('config-changed', event => {
      const next = event.detail.config;
      Object.keys(next).forEach(key => { if (next[key] === undefined) delete next[key]; });
      deepFreeze(next);
      window.ed.changes++; window.ed.last = next;
      try { card.setConfig(next); } catch (e) { window.ed.setConfigErrors.push('card: ' + e.message); }
      try { editor.setConfig(next); } catch (e) { window.ed.setConfigErrors.push('editor: ' + e.message); }
    });
    const fixture = document.querySelector('#fixture');
    fixture.append(editor, card);
    return { ok: true, config };
  }, tag);
  expect(setup.ok, JSON.stringify(setup)).toBe(true);
  await page.waitForTimeout(500);
  // Expand collapsed sections.
  for (let i = 0; i < 20; i++) {
    const clicked = await page.evaluate(() => { const b = [...window.ed.editor.shadowRoot.querySelectorAll('[data-editor-toggle][aria-expanded="false"], [data-editor-toggle]:not([aria-expanded])')].find(x => !x.dataset.__done); if (!b) return false; b.dataset.__done = '1'; b.click(); return true; });
    if (!clicked) break; await page.waitForTimeout(80);
  }
  const result = await page.evaluate(async () => {
    const { editor, card } = window.ed; const root = editor.shadowRoot;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const get = (obj, path) => path.split('.').reduce((v, k) => v?.[k], obj);
    const steps = [];
    const edit = async (selector, apply) => {
      const node = root.querySelector(selector); if (!node) return 'missing';
      const field = node.dataset.field; const before = window.ed.changes; const errs = window.ed.errors.length;
      const expected = apply(node);
      node.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      // Wait for the emitted config instead of a fixed delay (busy CI workers).
      for (let waited = 0; waited < 3000 && String(get(window.ed.last, field)) !== String(expected); waited += 40) await sleep(40);
      const ok = window.ed.changes > before && String(get(window.ed.last, field)) === String(expected);
      return `${field}:${ok ? 'ok' : 'FAIL'}${window.ed.errors.length > errs ? ' err=' + window.ed.errors.at(-1).slice(0, 80) : ''}`;
    };
    const nameSel = 'input[data-field="name"], input[data-field="title"]';
    steps.push(await edit(nameSel, n => (n.value = 'First 1')));
    steps.push(await edit(nameSel, n => (n.value = 'Second 2')));
    steps.push(await edit('input[type="color"][data-field]', n => { n.value = '#12ab34'; return '#12ab34'; }));
    steps.push(await edit('input[type="checkbox"][data-field]', n => { n.checked = !n.checked; return n.checked; }));
    steps.push(await edit(nameSel, n => (n.value = 'Third 3')));
    const text = card.shadowRoot?.textContent || '';
    return { steps: steps.filter(x => x !== 'missing'), cardShowsLast: text.includes('Third 3'), setConfigErrors: window.ed.setConfigErrors.slice(0, 3), errors: [...new Set(window.ed.errors)].slice(0, 3) };
  });
  expect(result.steps.length).toBeGreaterThan(1);
  expect(result.steps.filter(step => !step.endsWith(':ok'))).toEqual([]);
  expect(result.setConfigErrors).toEqual([]);
  expect(result.errors).toEqual([]);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
