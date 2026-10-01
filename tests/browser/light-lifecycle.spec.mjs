import { expect, test } from '@playwright/test';
test.use({ hasTouch: true });

async function mount(page, config = {}, states = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-light-card'));
  await page.evaluate(({ config, states }) => {
    window.lightCalls = []; window.lightHaptics = [];
    window.lightStates = {
      'light.one': { state: 'on', attributes: { friendly_name: 'Light', brightness: 128, hs_color: [42, 60], supported_color_modes: ['hs', 'color_temp'], min_color_temp_kelvin: 2200, max_color_temp_kelvin: 6500 } },
      'light.two': { state: 'on', attributes: { friendly_name: 'Second', brightness: 64, hs_color: [210, 70], supported_color_modes: ['hs', 'color_temp'] } }, ...states,
    };
    window.lightHass = window.createHassFixture({ entities: window.lightStates, overrides: { callService(...args) { window.lightCalls.push(args); return Promise.resolve(); } } });
    const card = document.createElement('nodalia-light-card');
    card.setConfig({ entity: 'light.one', compact_layout_mode: 'never', language: 'en', animations: { enabled: false }, ...config });
    card.hass = window.lightHass; card.addEventListener('haptic', event => window.lightHaptics.push(event.detail));
    document.querySelector('#fixture').append(card); window.lightCard = card;
  }, { config, states });
  return page.locator('nodalia-light-card');
}

test('Light cancels brightness, temperature and hue drags without commands across pointers, touches and entity changes', async ({ page, browserName }) => {
  await mount(page);
  const cancellations = await page.evaluate(browserName => {
    const card = window.lightCard; const results = [];
    for (const mode of ['brightness', 'temperature', 'color']) {
      card._activeControlMode = mode; card._render();
      const slider = card.shadowRoot.querySelector(`input[data-light-control="${mode}"]`); const rect = slider.getBoundingClientRect();
      card._startSliderDrag(slider, rect.left + rect.width * .8, null, 7);
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, clientX: rect.right }));
      results.push({ drag: card._activeSliderDrag, draft: card._draftBrightness.size + card._draftTemperature.size + card._draftHue.size, calls: window.lightCalls.length, listeners: card._dragWindowListenersAttached });
    }
    const slider = card.shadowRoot.querySelector('input[type="range"]'); const rect = slider.getBoundingClientRect();
    card._startSliderDrag(slider, rect.left, null, null);
    // WebKit exposes native TouchEvent but cannot construct a populated TouchList.
    const cancel = browserName === 'chromium'
      ? new TouchEvent('touchcancel', { changedTouches: [new Touch({ identifier: 1, target: slider, clientX: rect.right, clientY: rect.top })] })
      : new TouchEvent('touchcancel');
    card._onWindowTouchEnd(cancel);
    results.push({ drag: card._activeSliderDrag, draft: card._draftBrightness.size + card._draftTemperature.size + card._draftHue.size, calls: window.lightCalls.length, listeners: card._dragWindowListenersAttached });
    card._startSliderDrag(card.shadowRoot.querySelector('input[type="range"]'), rect.left, null, 8);
    card.setConfig({ entity: 'light.two', animations: { enabled: false } }); card.hass = window.lightHass;
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 8, clientX: rect.right }));
    return results;
  }, browserName);
  expect(cancellations).toEqual(Array.from({ length: 4 }, () => ({ drag: null, draft: 0, calls: 0, listeners: false })));
  expect(await page.evaluate(() => window.lightCalls)).toEqual([]); expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Light turn-on queue and turn-off UI finish at their original deadlines and confirmation flushes once', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T10:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-01T10:00:01Z'));
  await mount(page, {}, { 'light.one': { state: 'off', attributes: { brightness: 128, hs_color: [42, 60], supported_color_modes: ['hs', 'color_temp'] } } });
  await page.evaluate(() => { window.lightCard._toggleLight(); window.lightCard._commitBrightness(75); window.lightCard._commitColorPreset([0, 0]); });
  expect(await page.evaluate(() => window.lightCalls)).toEqual([['light', 'turn_on', { entity_id: 'light.one' }]]);
  await page.clock.fastForward(3000); await page.evaluate(() => window.lightCard.hass = { ...window.lightHass }); await page.clock.fastForward(199);
  expect(await page.evaluate(() => window.lightCard._optimisticTurnOn)).not.toBe(null); await page.clock.fastForward(1);
  expect(await page.evaluate(() => window.lightCard._optimisticTurnOn)).toBe(null);
  expect(await page.evaluate(() => window.lightCalls.at(-1))).toEqual(['light', 'turn_on', { entity_id: 'light.one', brightness_pct: 75, hs_color: [0, 0] }]);
  await page.clock.fastForward(1000); expect(await page.evaluate(() => window.lightCalls.length)).toBe(2);
  await page.evaluate(() => { window.lightStates['light.one'].state = 'on'; window.lightCard.hass = window.createHassFixture({ entities: window.lightStates, overrides: { callService: window.lightHass.callService } }); window.lightCard._toggleLight(); });
  await page.clock.fastForward(3199); expect(await page.evaluate(() => window.lightCard._optimisticTurnOff)).not.toBe(null); await page.clock.fastForward(1);
  expect(await page.evaluate(() => window.lightCard._optimisticTurnOff)).toBe(null); expect(await page.evaluate(() => window.lightCard._getState().state)).toBe('on');
  await page.evaluate(() => { window.lightStates['light.one'].state = 'off'; window.lightCard.hass = window.createHassFixture({ entities: window.lightStates, overrides: { callService: window.lightHass.callService } }); window.lightCard._toggleLight(); window.lightCard._commitBrightness(60); window.lightStates['light.one'].state = 'on'; window.lightCard.hass = window.createHassFixture({ entities: window.lightStates, overrides: { callService: window.lightHass.callService } }); });
  const count = await page.evaluate(() => window.lightCalls.length); await page.evaluate(() => window.lightCard.hass = { ...window.lightCard._hass }); expect(await page.evaluate(() => window.lightCalls.length)).toBe(count);
  expect(await page.evaluate(() => window.lightCalls.at(-1))).toEqual(['light', 'turn_on', { entity_id: 'light.one', brightness_pct: 60 }]);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Light settle and mode transitions own timers and frames and discard work on entity changes or detach', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T10:00:00Z') }); await page.clock.pauseAt(new Date('2026-10-01T10:00:01Z'));
  await mount(page, { animations: { enabled: true, mode_switch_duration: 200 } });
  await page.evaluate(() => { const card = window.lightCard; const remembered = { ...card._getActualState(), attributes: { ...card._getActualState().attributes } }; delete window.lightStates['light.one'].attributes.hs_color; card.hass = window.createHassFixture({ entities: window.lightStates, overrides: { callService: window.lightHass.callService } }); card._startOptimisticVisualSettle(card._getActualState(), remembered); });
  await page.clock.fastForward(419); expect(await page.evaluate(() => window.lightCard._optimisticVisualSettle)).not.toBe(null); await page.clock.fastForward(1); expect(await page.evaluate(() => window.lightCard._optimisticVisualSettle)).toBe(null);
  await page.evaluate(() => window.lightCard._startModeSwitchTransition('temperature')); await page.clock.fastForward(100); expect(await page.evaluate(() => window.lightCard._activeControlMode)).toBe('temperature');
  await page.evaluate(() => { window.lightCard.setConfig({ entity: 'light.two', animations: { enabled: false } }); window.lightCard.hass = window.lightHass; });
  await page.clock.fastForward(500); expect(await page.evaluate(() => ({ mode: window.lightCard._activeControlMode, transition: window.lightCard._modeTransition, frames: window.lightCard._modeFrames.size }))).toEqual({ mode: 'brightness', transition: null, frames: 0 });
  const cleanup = await page.evaluate(() => { const card = window.lightCard; card.setConfig({ entity: 'light.one', animations: { enabled: true } }); card.hass = window.lightHass; card._scheduleModeFrame(() => { window.staleLightFrame = true; }, card._modeGeneration); const original = window.NodaliaUtils.scheduleDeferTimer; window.NodaliaUtils.scheduleDeferTimer = undefined; card._triggerButtonBounce(card.shadowRoot.querySelector('button')); window.NodaliaUtils.scheduleDeferTimer = original; const timers = card._panelWork.timers.size; card._suppressNextLightTap = true; card.remove(); return { timers, remainingTimers: card._panelWork.timers.size, frames: card._modeFrames.size, tap: card._suppressNextLightTap, resize: card._resizeFrame, settle: card._optimisticVisualSettleTimer }; });
  expect(cleanup.timers).toBeGreaterThan(0); expect({ ...cleanup, timers: 0 }).toEqual({ timers: 0, remainingTimers: 0, frames: 0, tap: false, resize: 0, settle: 0 }); await page.clock.fastForward(5000); expect(await page.evaluate(() => Boolean(window.staleLightFrame))).toBe(false); expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Light guards malformed memory/colors, refreshes temperature limits and retains keyboard targets and disabled haptics', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const card = await mount(page, { tap_action: 'service', tap_service: 'light.turn_on', tap_service_data: { brightness_pct: 0, flag: false }, tap_service_target: { area_id: 'living' }, security: { allowed_services: ['light.turn_on'] }, haptics: { scrolls: { brightness: false, temperature: false, color: false } } });
  await card.locator('ha-card[data-light-action="body"]').press('Enter'); expect(await page.evaluate(() => window.lightCalls.at(-1))).toEqual(['light', 'turn_on', { brightness_pct: 0, flag: false }, { area_id: 'living' }]);
  const malformed = await page.evaluate(() => { const card = window.lightCard; const memory = []; for (const value of ['null', '[]', '{"light.one":{"attributes":[]}}', '{"light.one":{"attributes":{"brightness":0},"last_changed":3}}']) { localStorage.setItem('nodalia-light-card:last-visual-state:v1', value); memory.push(card._getStoredLightSnapshot('light.one')); } const state = { ...card._getActualState(), attributes: { hs_color: [null, 0], rgb_color: [null, 0, 0] } }; window.lightHaptics = []; for (const mode of ['brightness', 'temperature', 'color']) card._hapticOnSliderStep(mode, 70); return { memory, hue: card._getCurrentHue(state), saturation: card._getCurrentSaturation(state), haptics: window.lightHaptics }; });
  expect(malformed.memory.slice(0, 3)).toEqual([null, null, null]); expect(malformed.memory[3].attributes.brightness).toBe(0); expect(typeof malformed.memory[3].last_changed).toBe('string'); expect(malformed.hue).toBe(42); expect(malformed.saturation).toBe(75); expect(malformed.haptics).toEqual([]);
  await page.evaluate(() => { window.lightCard._activeControlMode = 'temperature'; window.lightCard._render(); window.lightStates['light.one'].attributes.min_color_temp_kelvin = 3000; window.lightStates['light.one'].attributes.max_color_temp_kelvin = 5000; window.lightCard.hass = window.createHassFixture({ entities: window.lightStates, overrides: { callService: window.lightHass.callService } }); });
  await expect(card.locator('input[data-light-control="temperature"]')).toHaveAttribute('min', '3000'); await expect(card.locator('input[data-light-control="temperature"]')).toHaveAttribute('max', '5000');
  await page.evaluate(() => { window.lightCard._hass.callService = () => Promise.reject(new Error('offline')); window.lightCard._setLightState({ brightness_pct: 0 }); window.lightCard._callConfiguredService('light.turn_on'); });
  await page.evaluate(() => { window.lightCard._hass.callService = () => { throw new Error('offline'); }; window.lightCard._setLightOff(); }); expect(errors).toEqual([]); expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
