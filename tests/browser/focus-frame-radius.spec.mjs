import { expect, test } from '@playwright/test';

// Every primary action uses the shared frame over the entire card surface,
// including wrappers and full-bleed previews rendered through HA's slot.
const CARDS = [
  { name: 'gauge', tag: 'nodalia-circular-gauge-card', config: { entity: 'sensor.t', tap_action: 'more-info' }, entities: { 'sensor.t': { state: '21', attributes: { unit_of_measurement: 'W' } } }, target: '[data-gauge-action="primary"]' },
  { name: 'power flow', tag: 'nodalia-power-flow-card', config: { solar_entity: 'sensor.t', grid_entity: 'sensor.g', home_entity: 'sensor.h', tap_action: 'more-info' }, entities: { 'sensor.t': { state: '3', attributes: { unit_of_measurement: 'W' } }, 'sensor.g': { state: '1', attributes: {} }, 'sensor.h': { state: '1', attributes: {} } }, target: '[data-card-action="primary"]' },
  { name: 'insignia', tag: 'nodalia-insignia-card', config: { entity: 'sensor.t', tap_action: 'more-info' }, entities: { 'sensor.t': { state: '21', attributes: { unit_of_measurement: 'C' } } }, target: '[data-insignia-action="primary"]', shell: '.insignia-card' },
  { name: 'camera feed', tag: 'nodalia-camera-card', config: { entity: 'camera.t' }, entities: { 'camera.t': { state: 'idle', attributes: {} } }, target: '[data-camera-action="camera-tap"]' },
  { name: 'person', tag: 'nodalia-person-card', config: { entity: 'person.t', tap_action: 'more-info' }, entities: { 'person.t': { state: 'home', attributes: {} } }, target: '[data-person-action="primary"]' },
  { name: 'entity', tag: 'nodalia-entity-card', config: { entity: 'sensor.t', tap_action: 'more-info' }, entities: { 'sensor.t': { state: '21', attributes: {} } }, target: '[data-entity-action="body"]' },
  { name: 'light', tag: 'nodalia-light-card', config: { entity: 'light.t' }, entities: { 'light.t': { state: 'on', attributes: { brightness: 128, supported_color_modes: ['brightness'], color_mode: 'brightness' } } }, target: '[data-light-action="body"]' },
  { name: 'fan', tag: 'nodalia-fan-card', config: { entity: 'fan.t' }, entities: { 'fan.t': { state: 'on', attributes: { percentage: 50 } } }, target: '[data-fan-action="body"]' },
  { name: 'humidifier', tag: 'nodalia-humidifier-card', config: { entity: 'humidifier.t' }, entities: { 'humidifier.t': { state: 'on', attributes: { humidity: 50 } } }, target: '[data-humidifier-action="body"]' },
  { name: 'vacuum', tag: 'nodalia-vacuum-card', config: { entity: 'vacuum.t', tap_action: 'more-info' }, entities: { 'vacuum.t': { state: 'docked', attributes: { battery_level: 50 } } }, target: '[data-vacuum-action="body_tap"]' },
];

// Home Assistant's ha-card renders its content through a <slot>. A slotted child's parent in the
// flat tree is that slot, so `border-radius: inherit` there resolves to 0: the fixture must slot too.
async function useSlottedHaCard(page) {
  await page.route('**/tests/fixtures/browser.html', async route => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({ response, body: html.replace('class extends HTMLElement {}', `class extends HTMLElement {
      constructor(){super();if(this.localName==='ha-card') this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;box-sizing:border-box;position:relative}</style><slot></slot>';}
    }`) });
  });
}

for (const width of [320, 390, 768]) {
  for (const showHeader of [true, false]) {
    test(`Power Flow focus encloses the whole card at ${width}px with header ${showHeader}`, async ({ page }) => {
      await useSlottedHaCard(page);
      await page.goto('/tests/fixtures/browser.html');
      await page.waitForFunction(() => customElements.get('nodalia-power-flow-card'));
      await page.evaluate(({ width, showHeader }) => {
        const element = document.createElement('nodalia-power-flow-card');
        element.setConfig({
          title: 'Flujo', layout: 'compact', show_header: showHeader,
          entities: { grid: { entity: 'sensor.grid' }, home: { entity: 'sensor.home' } },
          tap_action: 'more-info', dashboard_link: '/energy',
          consumption_chips: { day_entity: 'sensor.day' },
          animations: { enabled: false }, haptics: { enabled: false },
        });
        element.hass = window.createHassFixture({ entities: {
          'sensor.grid': { state: '191', attributes: { unit_of_measurement: 'W' } },
          'sensor.home': { state: '191', attributes: { unit_of_measurement: 'W' } },
          'sensor.day': { state: '2.83', attributes: { unit_of_measurement: 'kWh' } },
        } });
        element.style.cssText = `display:block;width:${width}px`;
        document.querySelector('#fixture').append(element);
      }, { width, showHeader });
      const card = page.locator('nodalia-power-flow-card');
      const frame = card.locator('[data-card-action="primary"]');
      await expect(card.locator('.power-flow-card__node--grid')).toBeVisible();
      await page.keyboard.press('Tab');
      await frame.focus();
      const geometry = await frame.evaluate(target => {
        const shell = target.getRootNode().querySelector('ha-card');
        const rect = node => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        };
        return { target: rect(target), shell: rect(shell), focusVisible: target.matches(':focus-visible') };
      });
      expect(geometry.focusVisible).toBe(true);
      expect(geometry.target).toEqual(geometry.shell);
      for (const chip of await card.locator('.power-flow-card__node--grid .power-flow-card__chip').all()) {
        const bounds = await chip.boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(geometry.shell.y + geometry.shell.height - 3);
      }
      await expect(card.locator('.power-flow-card__header')).toHaveCount(showHeader ? 1 : 0);
      await page.evaluate(() => {
        window.focusActions = [];
        document.querySelector('nodalia-power-flow-card').addEventListener('hass-more-info', event => window.focusActions.push(event.detail.entityId));
      });
      await frame.press('Enter');
      expect(await page.evaluate(() => window.focusActions)).toEqual(['sensor.home']);
      await frame.press('Space');
      expect(await page.evaluate(() => window.focusActions)).toEqual(['sensor.home', 'sensor.home']);
      expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
    });
  }
}

for (const card of CARDS) {
  test(`${card.name} keyboard focus frame follows the card corners`, async ({ page }) => {
    await useSlottedHaCard(page);
    await page.goto('/tests/fixtures/browser.html');
    await page.waitForFunction(tag => customElements.get(tag), card.tag);
    const result = await page.evaluate(async ({ card }) => {
      const root = document.documentElement.style;
      root.setProperty('--primary-color', '#ff9800');
      const element = document.createElement(card.tag);
      element.setConfig({ language: 'en', animations: { enabled: false }, haptics: { enabled: false }, ...card.config });
      element.hass = window.createHassFixture({ entities: card.entities });
      element.style.cssText = 'display:block;width:360px';
      document.querySelector('#fixture').append(element);
      await new Promise(resolve => setTimeout(resolve, 300));
      const target = element.shadowRoot.querySelector(card.target);
      const shell = element.shadowRoot.querySelector(card.shell || 'ha-card');
      if (!target || !shell) return { missing: true };
      return { missing: false };
    }, { card });
    expect(result.missing).toBe(false);

    // Keyboard modality first, so :focus-visible applies on every engine.
    await page.keyboard.press('Tab');
    const frame = await page.evaluate(({ card }) => {
      const element = document.querySelector(card.tag);
      const target = element.shadowRoot.querySelector(card.target);
      const shell = element.shadowRoot.querySelector(card.shell || 'ha-card');
      target.focus();
      const layer = (shell.shadowRoot || shell).querySelector('[data-nodalia-card-focus-frame]');
      const style = getComputedStyle(layer);
      const radius = node => getComputedStyle(node).borderTopLeftRadius;
      const framed = style.borderTopStyle === 'solid' && style.borderTopWidth === '2px';
      return { focusVisible: target.matches(':focus-visible'), framed, targetRadius: radius(layer), cardRadius: radius(shell), cardBorder: parseFloat(getComputedStyle(shell).borderTopWidth) };
    }, { card });
    expect(frame.focusVisible).toBe(true);
    expect(frame.framed).toBe(true);
    expect(parseFloat(frame.cardRadius)).toBeGreaterThan(0);
    expect(frame.targetRadius).toBe(frame.cardRadius);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}

test('Power Flow keeps larger grid chips inside its mobile focus frame', async ({ page }) => {
  await useSlottedHaCard(page);
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-power-flow-card'));
  await page.evaluate(() => {
    const element = document.createElement('nodalia-power-flow-card');
    element.setConfig({ entities: { grid: { entity: 'sensor.grid' }, home: { entity: 'sensor.home' } }, tap_action: 'more-info', styles: { chip_height: '32px', icon: { node_size: '72px' } }, animations: { enabled: false } });
    element.hass = window.makeHass({ 'sensor.grid': { state: '191', attributes: { unit_of_measurement: 'W' } }, 'sensor.home': { state: '191', attributes: { unit_of_measurement: 'W' } } });
    element.style.cssText = 'display:block;width:320px';
    document.querySelector('#fixture').append(element);
  });
  const card = page.locator('nodalia-power-flow-card');
  const frame = card.locator('ha-card');
  await page.keyboard.press('Tab'); await frame.focus();
  const bounds = await frame.boundingBox();
  for (const chip of await card.locator('.power-flow-card__node--grid .power-flow-card__chip').all()) {
    const rect = await chip.boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.y + bounds.height - 3);
  }
});
