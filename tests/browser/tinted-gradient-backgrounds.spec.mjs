import { expect, test } from '@playwright/test';

// Cards tint their background in an active state. The tint used to be color-mixed into
// styles.card.background, which only accepts colors: a gradient background (a documented
// style value, written multi-line in YAML) made the whole declaration invalid, so neither
// the user's gradient nor the tint was shown. The tint is now a translucent layer above
// the configured background.
const GRADIENT = 'radial-gradient(circle at 80% 0%,\n  rgb(12, 34, 56) 0%,\n  transparent 60%),\n\nlinear-gradient(160deg,\n  rgb(98, 76, 54) 0%,\n  rgb(21, 43, 65) 100%)\n';
const BASE = 'rgb(28, 28, 28)';

const STATES = {
  'alarm_control_panel.one': { state: 'armed_away', attributes: { friendly_name: 'Alarm One', supported_features: 63 } },
  'camera.one': { state: 'idle', attributes: { friendly_name: 'Cam One', entity_picture: '/x.jpg' } },
  'sensor.one': { state: '21', attributes: { friendly_name: 'Sensor One', unit_of_measurement: '°C', device_class: 'temperature' } },
  'climate.one': { state: 'heat', attributes: { friendly_name: 'Clima One', hvac_modes: ['off', 'heat'], hvac_action: 'heating', temperature: 21, current_temperature: 20, min_temp: 7, max_temp: 30, supported_features: 1 } },
  'cover.one': { state: 'open', attributes: { friendly_name: 'Cover One', current_position: 50, supported_features: 15 } },
  'fan.one': { state: 'on', attributes: { friendly_name: 'Fan One', percentage: 50, supported_features: 1 } },
  'light.one': { state: 'on', attributes: { friendly_name: 'Light One', brightness: 128, supported_color_modes: ['brightness'] } },
  'humidifier.one': { state: 'on', attributes: { friendly_name: 'Hum One', humidity: 50, min_humidity: 30, max_humidity: 80 } },
  'person.one': { state: 'home', attributes: { friendly_name: 'Person One' } },
  'scene.one': { state: '2026-10-01T00:00:00Z', attributes: { friendly_name: 'Scene One' } },
  'vacuum.one': { state: 'cleaning', attributes: { friendly_name: 'Vac One', supported_features: 16383 } },
  'weather.one': { state: 'sunny', attributes: { friendly_name: 'Weather One', temperature: 20 } },
  'switch.one': { state: 'on', attributes: { friendly_name: 'Switch One' } },
  'sensor.aqi': { state: '42', attributes: { friendly_name: 'Air quality', device_class: 'aqi' } },
};

// alpha: the tint's first stop. decorated: the card paints its own layers above the tint.
// keyframes: the power-up animation that also layers the tint.
const CASES = [
  { tag: 'nodalia-alarm-panel-card', config: { entity: 'alarm_control_panel.one' }, alpha: 0.14 },
  // The camera config pins layout to "mosaic"; the security tint is reached by overriding it.
  // Its 180deg direction is the default, which computed values omit.
  { tag: 'nodalia-camera-card', config: { entity: 'camera.one' }, layout: 'security', alpha: 0.1, angle: null },
  { tag: 'nodalia-circular-gauge-card', config: { entity: 'sensor.one' }, alpha: 0.22, decorated: true },
  { tag: 'nodalia-climate-card', config: { entity: 'climate.one' }, alpha: 0.22, decorated: true },
  { tag: 'nodalia-cover-card', config: { entity: 'cover.one' }, alpha: 0.18 },
  { tag: 'nodalia-entity-card', config: { entity: 'switch.one' }, alpha: 0.18 },
  { tag: 'nodalia-entity-card', label: 'air quality', config: { entity: 'sensor.aqi', layout: 'air_quality' }, alpha: 0.18 },
  { tag: 'nodalia-fan-card', config: { entity: 'fan.one' }, alpha: 0.18, keyframes: 'fan-card-power-up' },
  { tag: 'nodalia-fav-card', config: { entity: 'light.one' }, alpha: 0.18 },
  { tag: 'nodalia-graph-card', config: { entities: [{ entity: 'sensor.one' }] }, alpha: 0.18 },
  { tag: 'nodalia-humidifier-card', config: { entity: 'humidifier.one' }, alpha: 0.18, keyframes: 'humidifier-card-power-up' },
  { tag: 'nodalia-light-card', config: { entity: 'light.one' }, alpha: 0.18, keyframes: 'light-card-power-up' },
  { tag: 'nodalia-person-card', config: { entity: 'person.one' }, alpha: 0.14 },
  { tag: 'nodalia-scenes-card', config: { scenes: [{ entity: 'scene.one' }] }, alpha: 0.14, decorated: true },
  { tag: 'nodalia-vacuum-card', config: { entity: 'vacuum.one' }, alpha: 0.18 },
  { tag: 'nodalia-weather-card', config: { entity: 'weather.one' }, alpha: 0.18, decorated: true },
];

async function mountCard(page, { tag, config, layout }, background) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(tag => customElements.get(tag), tag);
  return page.evaluate(async ({ tag, config, layout, background, states, base }) => {
    // Home Assistant theme variables the card surfaces resolve against.
    const theme = { '--ha-card-background': base, '--primary-text-color': 'rgb(225, 225, 225)', '--primary-color': 'rgb(3, 169, 244)', '--divider-color': 'rgb(60, 60, 60)' };
    for (const [name, value] of Object.entries(theme)) document.documentElement.style.setProperty(name, value);
    const card = document.createElement(tag);
    const styles = background ? { card: { background } } : {};
    card.setConfig({ type: `custom:${tag}`, ...config, styles });
    card.hass = window.makeHass(states);
    document.querySelector('#fixture').append(card);
    if (layout) {
      card._config = { ...card._config, layout };
      card._render();
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    // Split the computed background-image into its top-level layers.
    const splitLayers = value => {
      const layers = [];
      let depth = 0;
      let start = 0;
      for (let index = 0; index < value.length; index++) {
        const char = value[index];
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (char === ',' && depth === 0) {
          layers.push(value.slice(start, index).trim());
          start = index + 1;
        }
      }
      layers.push(value.slice(start).trim());
      return layers;
    };
    const surface = card.shadowRoot.querySelector('ha-card');
    const style = getComputedStyle(surface);
    // Resolve each keyframe's background on a probe inside the card: declarations using
    // var() only turn invalid at computed-value time, so CSSOM parsing alone proves nothing.
    const keyframes = {};
    const probe = document.createElement('div');
    card.shadowRoot.append(probe);
    for (const sheet of [...card.shadowRoot.querySelectorAll('style')].map(node => node.sheet)) {
      for (const rule of sheet?.cssRules || []) {
        if (rule.type !== CSSRule.KEYFRAMES_RULE) continue;
        keyframes[rule.name] = [...rule.cssRules].map(frame => {
          probe.style.background = frame.style.getPropertyValue('background');
          return splitLayers(getComputedStyle(probe).backgroundImage);
        });
      }
    }
    probe.remove();
    return { layers: splitLayers(style.backgroundImage), color: style.backgroundColor, keyframes };
  }, { tag, config, layout, background, states: STATES, base: BASE });
}

const isTintLayer = (layer, { alpha, angle = '135deg' }) =>
  layer.startsWith(angle ? `linear-gradient(${angle}, ` : 'linear-gradient(') && new RegExp(`(/ |, )${String(alpha).replace('.', '\\.')}\\)`).test(layer);

for (const testCase of CASES) {
  const name = testCase.label ? `${testCase.tag} (${testCase.label})` : testCase.tag;
  test(`${name} keeps a multi-line gradient background under its active tint`, async ({ page }) => {
    const { layers, keyframes } = await mountCard(page, testCase, GRADIENT);
    // The user's two layers stay last, in order, with the tint directly above them.
    expect(layers.length, layers.join(' | ')).toBeGreaterThanOrEqual(3);
    expect(layers.at(-2)).toMatch(/^radial-gradient\(.*rgb\(12, 34, 56\)/);
    expect(layers.at(-1)).toMatch(/^linear-gradient\(160deg, rgb\(98, 76, 54\).*rgb\(21, 43, 65\)/);
    expect(isTintLayer(layers.at(-3), testCase), layers.at(-3)).toBe(true);
    if (testCase.keyframes) {
      // Every power-up keyframe still parses (an invalid declaration would be dropped).
      expect(keyframes[testCase.keyframes]?.length).toBeGreaterThan(0);
      for (const frame of keyframes[testCase.keyframes]) expect(frame.at(-2), frame.join(' | ')).toMatch(/^radial-gradient\(/);
      // The 55% and 100% frames layer the tint over the user's gradient.
      expect(keyframes[testCase.keyframes].filter(frame => frame.length === 3)).toHaveLength(2);
    }
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });

  test(`${name} still renders its active tint over the default solid background`, async ({ page }) => {
    const { layers, color } = await mountCard(page, testCase, null);
    // A translucent tint over the opaque base color equals the former color-mix result.
    // The base color is the final layer (its image slot is "none") with the tint just above.
    expect(color).toBe(BASE);
    expect(layers.at(-1)).toBe('none');
    expect(isTintLayer(layers.at(-2), testCase), layers.join(' | ')).toBe(true);
    // Cards without decorative layers of their own paint only the tint above the base.
    if (!testCase.decorated) expect(layers).toHaveLength(2);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}
