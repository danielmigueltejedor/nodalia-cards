import { expect, test } from '@playwright/test';

// Issue #326: after a routine starts, the card stays in routines mode. A cleaning
// session hides the mode tabs and the routine list, and routines mode hid the
// pause/modes/dock controls too, leaving an empty footer with no way out.
const MAP = '<svg xmlns="http://www.w3.org/2000/svg" width="1640" height="2276"><rect width="1640" height="2276" fill="#335"/></svg>';

async function mountVacuum(page, { slowMap = false, vacuumState = 'docked' } = {}) {
  await page.route('**/api/image_proxy/**', async route => {
    if (slowMap) await new Promise(resolve => setTimeout(resolve, 900));
    await route.fulfill({ contentType: 'image/svg+xml', body: MAP });
  });
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-advance-vacuum-card'));
  await page.evaluate(vacuumState => {
    const rooms = {};
    for (let i = 0; i < 4; i++) {
      const x0 = 20000 + i * 3000;
      rooms[String(16 + i)] = { x0, y0: 24000, x1: x0 + 2500, y1: 30000, number: 16 + i, name: `Room ${i}`, outlines: [[{ x: x0, y: 24000 }, { x: x0 + 2500, y: 24000 }, { x: x0 + 2500, y: 30000 }, { x: x0, y: 30000 }]] };
    }
    window.avStates = {
      'vacuum.robot': { state: vacuumState, attributes: { friendly_name: 'Robot', fan_speed: 'balanced', fan_speed_list: ['quiet', 'balanced', 'turbo'], supported_features: 30524 } },
      'image.map': { state: '2026-10-08T00:00:00Z', attributes: { entity_picture: '/api/image_proxy/image.map?token=t', rooms, calibration_points: [{ vacuum: { x: 25500, y: 25500 }, map: { x: 1052, y: 1652 } }, { vacuum: { x: 35500, y: 25500 }, map: { x: 1852, y: 1652 } }, { vacuum: { x: 25500, y: 35500 }, map: { x: 1052, y: 852 } }] } },
      'button.routine_a': { state: '2026-10-07T09:00:00+00:00', attributes: {} },
      'button.routine_b': { state: '2026-10-07T09:00:00+00:00', attributes: {} },
    };
    window.avCalls = [];
    window.avAssign = () => {
      const hass = window.makeHass(window.avStates);
      hass.callService = async (domain, service, data) => { window.avCalls.push(`${domain}.${service}`); };
      window.avCard.hass = hass;
    };
    window.avSetState = state => { window.avStates['vacuum.robot'] = { ...window.avStates['vacuum.robot'], state }; window.avAssign(); };
    const card = window.avCard = document.createElement('nodalia-advance-vacuum-card');
    card.setConfig({ entity: 'vacuum.robot', map_source: { camera: 'image.map' }, allow_goto_mode: false, language: 'en', routines: [{ label: 'Quick', icon: 'mdi:broom', entity: 'button.routine_a' }, { label: 'Deep', icon: 'mdi:layers', entity: 'button.routine_b' }] });
    window.avAssign();
    const view = document.createElement('div'); view.style.cssText = 'display:block;width:393px';
    view.append(card); document.querySelector('#fixture').append(view);
  }, vacuumState);
  const card = page.locator('nodalia-advance-vacuum-card');
  await expect(card.locator('[data-map-image]')).toHaveJSProperty('naturalWidth', 1640);
  return card;
}

const footerActions = card => card.locator('.advance-vacuum-card__footer [data-control-action]').evaluateAll(nodes => nodes.map(node => node.dataset.controlAction));

test('A routine run keeps pause, modes and dock controls, and routines return when the session ends', async ({ page }) => {
  const card = await mountVacuum(page);
  await card.locator('.advance-vacuum-card__mode-button[data-mode-id="routines"]').click();
  await expect(card.locator('.advance-vacuum-card__routine-button')).toHaveCount(2);
  expect(await footerActions(card)).toEqual([]);
  await card.locator('.advance-vacuum-card__routine-button').first().click();
  await expect.poll(() => page.evaluate(() => window.avCalls)).toEqual(['button.press']);

  await page.evaluate(() => window.avSetState('cleaning'));
  await expect.poll(() => footerActions(card)).toEqual(['toggle_modes', 'primary', 'toggle_dock_panel']);
  await expect(card.locator('[data-control-action="primary"] ha-icon')).toHaveAttribute('icon', 'mdi:pause');
  await card.locator('[data-control-action="primary"]').click();
  await expect.poll(() => page.evaluate(() => window.avCalls.at(-1))).toBe('vacuum.pause');

  await page.evaluate(() => window.avSetState('returning'));
  await expect.poll(() => footerActions(card)).toEqual(['toggle_modes', 'primary', 'toggle_dock_panel']);

  await page.evaluate(() => window.avSetState('docked'));
  await expect(card.locator('.advance-vacuum-card__routine-button')).toHaveCount(2);
  await expect(card.locator('.advance-vacuum-card__mode-button')).not.toHaveCount(0);
  expect(await footerActions(card)).toEqual([]);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Opening the view during a routine session shows its controls on the first render', async ({ page }) => {
  const card = await mountVacuum(page);
  await card.locator('.advance-vacuum-card__mode-button[data-mode-id="routines"]').click();
  await card.locator('.advance-vacuum-card__routine-button').first().click();
  // Reopen: a fresh card restores the remembered routines mode while the robot cleans.
  await page.evaluate(() => {
    window.avSetState('cleaning');
    const view = window.avCard.parentElement; window.avCard.remove();
    const card = window.avCard = document.createElement('nodalia-advance-vacuum-card');
    card.setConfig({ entity: 'vacuum.robot', map_source: { camera: 'image.map' }, allow_goto_mode: false, language: 'en', routines: [{ label: 'Quick', icon: 'mdi:broom', entity: 'button.routine_a' }, { label: 'Deep', icon: 'mdi:layers', entity: 'button.routine_b' }] });
    window.avAssign(); view.append(card);
  });
  expect(await footerActions(card)).toEqual(['toggle_modes', 'primary', 'toggle_dock_panel']);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('The first open fits the map to its image even when the image arrives late', async ({ page }) => {
  const card = await mountVacuum(page, { slowMap: true });
  const ratio = await card.locator('.advance-vacuum-card__map-surface').evaluate(node => { const { width, height } = node.getBoundingClientRect(); return Math.round(width / height * 1000) / 1000; });
  expect(ratio).toBeCloseTo(1640 / 2276, 2);
  await expect(card.locator('.advance-vacuum-card__footer')).toBeVisible();
});
