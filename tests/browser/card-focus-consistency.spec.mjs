import { expect, test } from '@playwright/test';
import registry from '../../src/cards/registry.json' with { type: 'json' };

const states = {
  'sensor.test': { state: '21', attributes: { unit_of_measurement: '°C' } },
  'binary_sensor.test': { state: 'off' },
  'light.test': { state: 'off' },
  'fan.test': { state: 'off', attributes: { percentage: 0 } },
  'humidifier.test': { state: 'off', attributes: { humidity: 50 } },
  'cover.test': { state: 'closed', attributes: { current_position: 0, supported_features: 15 } },
  'climate.test': { state: 'off', attributes: { current_temperature: 21, temperature: 22, hvac_modes: ['off', 'heat'], supported_features: 1 } },
  'alarm_control_panel.test': { state: 'disarmed', attributes: { supported_features: 3 } },
  'lock.test': { state: 'locked', attributes: { supported_features: 2 } },
  'vacuum.test': { state: 'docked', attributes: { supported_features: 8191 } },
  'media_player.test': { state: 'idle', attributes: { supported_features: 2048 } },
  'person.test': { state: 'home' },
  'scene.test': { state: 'scening' },
  'weather.test': { state: 'sunny', attributes: { temperature: 21, temperature_unit: '°C' } },
  'calendar.test': { state: 'off' },
  'camera.test': { state: 'idle' },
  'switch.test': { state: 'off' },
  'sensor.news': { state: '1', attributes: { items: [{ title: 'News', summary: 'Today', url: 'https://example.com/news', source: 'Source' }] } },
};

for (const { tag } of registry) {
  test(`${tag} frames its complete surface for keyboard focus and clears it for pointer input`, async ({ page }) => {
    await page.route('**/tests/fixtures/browser.html', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('class extends HTMLElement {}', `class extends HTMLElement {
        constructor(){super();if(this.localName==='ha-card') this.attachShadow({mode:'open'}).innerHTML='<style>:host{display:block;box-sizing:border-box;position:relative}</style><slot></slot>';}
      }`) });
    });
    await page.goto('/tests/fixtures/browser.html');
    await page.waitForFunction(tag => customElements.get(tag), tag);
    await page.evaluate(async ({ tag, states }) => {
      document.documentElement.style.setProperty('--primary-color', '#ff9800');
      const hass = window.makeHass(states);
      const ctor = customElements.get(tag);
      const config = await ctor.getStubConfig(hass);
      if (tag === 'nodalia-scenes-card') config.scenes = [{ entity: 'scene.test' }];
      if (tag === 'nodalia-navigation-bar') config.layout = { ...config.layout, show_desktop: true };
      const card = document.createElement(tag);
      card.setConfig({ ...config, tap_action: 'more-info', animations: { enabled: false }, haptics: { enabled: false } });
      card.hass = hass;
      document.querySelector('#fixture').append(card);
      window.focusCard = card;
    }, { tag, states });
    const card = page.locator(tag);
    await expect.poll(() => card.evaluate(card => typeof card._cardWidth !== 'number' || card._cardWidth > 0)).toBe(true);
    await expect.poll(() => card.evaluate(card => [...card.shadowRoot.querySelectorAll('button:not(:disabled),a[href],summary,input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
      .filter(node => !node.closest('[aria-hidden="true"],[inert]') && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0).length)).toBeGreaterThan(0);
    await page.keyboard.press('Tab');
    const frame = await card.evaluate(card => {
      const target = [...card.shadowRoot.querySelectorAll('button:not(:disabled),a[href],summary,input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')]
        .find(node => !node.closest('[aria-hidden="true"],[inert]') && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0);
      target.focus();
      window.focusTarget = target;
      const shell = target.closest('ha-card,.insignia-card,.media-player-card') || card.shadowRoot.querySelector('ha-card,.insignia-card,.media-player-card');
      window.focusShell = shell;
      window.focusShellSelector = shell.matches('.media-player-card') ? '.media-player-card' : shell.matches('.insignia-card') ? '.insignia-card' : 'ha-card';
      return { focused: card.shadowRoot.activeElement === target, style: getComputedStyle((shell.shadowRoot || shell).querySelector('[data-nodalia-card-focus-frame]')).borderTopStyle, width: getComputedStyle((shell.shadowRoot || shell).querySelector('[data-nodalia-card-focus-frame]')).borderTopWidth, display: getComputedStyle((shell.shadowRoot || shell).querySelector('[data-nodalia-card-focus-frame]')).display, count: (shell.shadowRoot || shell).querySelectorAll('[data-nodalia-card-focus-frame]').length };
    });
    expect(frame.focused).toBe(true);
    expect(frame.style).toBe('solid');
    expect(frame.width).toBe('2px');
    expect(frame.display).toBe('block');
    expect(frame.count).toBe(1);
    // Switching modality must remove the frame without triggering an unrelated card action.
    await card.evaluate(() => window.focusTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 0 })));
    expect(await card.evaluate(card => (() => { const shell = card.shadowRoot.querySelector(window.focusShellSelector); return (shell.shadowRoot || shell).querySelectorAll('[data-nodalia-card-focus-frame]').length; })())).toBe(0);
    await page.keyboard.press('Tab');
    await card.evaluate(() => window.focusTarget.isConnected ? window.focusTarget.focus() : window.focusCard.shadowRoot.querySelector('button,[tabindex="0"]').focus());
    expect(await card.evaluate(card => (() => { const shell = card.shadowRoot.querySelector(window.focusShellSelector); return (shell.shadowRoot || shell).querySelectorAll('[data-nodalia-card-focus-frame]').length; })())).toBe(1);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}

test('card frame follows keyboard focus inside a native HA control shadow root', async ({ page }) => {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-fav-card'));
  await page.evaluate(() => {
    customElements.define('nodalia-focus-native-control', class extends HTMLElement {
      constructor() { super(); this.attachShadow({ mode: 'open' }).innerHTML = '<button>Control</button>'; }
    });
    const card = document.createElement('nodalia-fav-card');
    card.setConfig({ entity: 'sensor.one', tap_action: 'more-info' });
    card.hass = window.makeHass({ 'sensor.one': { state: '1' } });
    document.querySelector('#fixture').append(card);
    window.nativeFocusCard = card;
  });
  await expect.poll(() => page.evaluate(() => window.nativeFocusCard._cardWidth)).toBeGreaterThan(0);
  await page.evaluate(() => {
    const card = window.nativeFocusCard;
    const control = document.createElement('nodalia-focus-native-control');
    card.shadowRoot.querySelector('ha-card').append(control);
    window.nativeFocusButton = control.shadowRoot.querySelector('button');
    window.nativeFocusShell = card.shadowRoot.querySelector('ha-card');
  });
  await page.keyboard.press('Tab');
  await page.evaluate(() => window.nativeFocusButton.focus());
  expect(await page.evaluate(() => window.nativeFocusCard.hasAttribute('data-nodalia-keyboard-focus'))).toBe(true);
  expect(await page.evaluate(() => (window.nativeFocusShell.shadowRoot || window.nativeFocusShell).querySelectorAll('[data-nodalia-card-focus-frame]').length)).toBe(1);
  await page.evaluate(() => window.nativeFocusButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true, button: 0 })));
  expect(await page.evaluate(() => (window.nativeFocusShell.shadowRoot || window.nativeFocusShell).querySelectorAll('[data-nodalia-card-focus-frame]').length)).toBe(0);
  await page.keyboard.press('Tab');
  await page.evaluate(() => window.nativeFocusButton.focus());
  expect(await page.evaluate(() => (window.nativeFocusShell.shadowRoot || window.nativeFocusShell).querySelectorAll('[data-nodalia-card-focus-frame]').length)).toBe(1);
});

test('Scenes, Weather and Calendar expose working keyboard actions on their card surfaces', async ({ page }) => {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-scenes-card'));
  await page.evaluate(states => {
    window.keyboardCalls = []; window.weatherKeyboardActions = [];
    const hass = window.makeHass(states);
    hass.callService = (...args) => { window.keyboardCalls.push(args); return Promise.resolve(); };
    for (const [tag, config] of [
      ['nodalia-scenes-card', { layout: 'single', scenes: [{ entity: 'scene.test' }] }],
      ['nodalia-weather-card', { entity: 'weather.test', tap_action: 'more-info' }],
      ['nodalia-calendar-card', { calendars: [{ entity: 'calendar.test' }] }],
    ]) {
      const card = document.createElement(tag);
      card.setConfig({ ...config, animations: { enabled: false }, haptics: { enabled: false } });
      card.hass = hass;
      card.addEventListener('hass-more-info', event => window.weatherKeyboardActions.push(event.detail.entityId));
      document.querySelector('#fixture').append(card);
    }
  }, states);
  const scene = page.locator('nodalia-scenes-card').locator('ha-card');
  await scene.focus(); await scene.press('Enter'); await scene.press('Space');
  expect(await page.evaluate(() => window.keyboardCalls)).toEqual([
    ['scene', 'turn_on', { entity_id: 'scene.test' }], ['scene', 'turn_on', { entity_id: 'scene.test' }],
  ]);
  await expect(scene).toBeFocused();
  const weather = page.locator('nodalia-weather-card').locator('ha-card');
  await weather.focus(); await weather.press('Enter');
  expect(await page.evaluate(() => window.weatherKeyboardActions)).toEqual(['weather.test']);
  const calendar = page.locator('nodalia-calendar-card');
  const body = calendar.locator('ha-card'); await body.focus(); await body.press('Space');
  await expect(calendar.locator('[role="dialog"]')).toBeVisible();
  await expect(calendar.locator('[data-action="close-expanded"]')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(body).toBeFocused();
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
