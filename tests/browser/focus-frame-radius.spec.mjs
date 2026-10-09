import { expect, test } from '@playwright/test';

// A card's keyboard focus frame lives on an inner element when the card body is a wrapper (gauge,
// power flow, insignia) or a full-bleed preview (camera feed). Those elements were square, so the
// frame was clipped by the card's rounded corners. Every frame must follow the card radius.
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
    await page.keyboard.press('Shift');
    const frame = await page.evaluate(({ card }) => {
      const element = document.querySelector(card.tag);
      const target = element.shadowRoot.querySelector(card.target);
      const shell = element.shadowRoot.querySelector(card.shell || 'ha-card');
      target.focus();
      const style = getComputedStyle(target);
      const radius = node => getComputedStyle(node).borderTopLeftRadius;
      const framed = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
      return { focusVisible: target.matches(':focus-visible'), framed, targetRadius: radius(target), cardRadius: radius(shell) };
    }, { card });
    expect(frame.focusVisible).toBe(true);
    expect(frame.framed).toBe(true);
    expect(parseFloat(frame.cardRadius)).toBeGreaterThan(0);
    expect(frame.targetRadius).toBe(frame.cardRadius);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}
