import { expect, test } from '@playwright/test';

async function mountLock(page, config = {}, { connect = true } = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-lock-card'));
  await page.evaluate(({ config, connect }) => {
    window.calls = [];
    window.lockStates = { 'lock.front': { state: 'locked', attributes: { friendly_name: 'Front Door' } }, 'sensor.noise': { state: '0' } };
    const assign = () => { const hass = window.makeHass(window.lockStates); hass.callService = async (domain, service, data) => { window.calls.push([domain, service, data]); }; window.card.hass = hass; };
    window.assignLockHass = assign;
    window.card = document.createElement('nodalia-lock-card');
    // HA order: config and hass before the card is attached to the view.
    window.card.setConfig({ entity: 'lock.front', ...config }); assign();
    window.animationStarts = [];
    window.card.shadowRoot.addEventListener('animationstart', event => window.animationStarts.push(event.animationName));
    if (connect) document.querySelector('#fixture').append(window.card);
  }, { config, connect });
  return page.locator('nodalia-lock-card');
}
const entranceNames = ['lock-bloom', 'lock-fade-up', 'lock-rise'];
const entranceStarts = page => page.evaluate(names => window.animationStarts.filter(name => names.includes(name)).length, entranceNames);

test('Lock plays one entrance per mount and HA updates never replay it', async ({ page }) => {
  const card = await mountLock(page);
  await expect(card.locator('ha-card')).toHaveClass(/is-entering/);
  await expect.poll(() => entranceStarts(page)).toBe(3);
  // Unrelated and related HA updates while the entrance runs keep the same nodes and animations.
  await page.evaluate(() => {
    window.lockStates['sensor.noise'] = { state: '1' }; window.assignLockHass();
    window.lockStates['lock.front'] = { ...window.lockStates['lock.front'], attributes: { friendly_name: 'Front Door', battery_level: 80 } }; window.assignLockHass();
  });
  await expect(card.locator('ha-card')).not.toHaveClass(/is-entering/, { timeout: 2000 });
  expect(await page.evaluate(() => window.card.animationWork.timers.size)).toBe(0);
  for (let i = 2; i < 30; i++) await page.evaluate(i => { window.lockStates['sensor.noise'] = { state: String(i) }; window.assignLockHass(); }, i);
  await page.evaluate(() => { window.lockStates['lock.front'] = { ...window.lockStates['lock.front'], state: 'unlocked' }; window.assignLockHass(); });
  await page.waitForTimeout(300);
  expect(await entranceStarts(page)).toBe(3);
  await expect(card.locator('ha-card')).not.toHaveClass(/is-entering/);
  // A remount is a new appearance; detaching releases the pending deadline.
  await page.evaluate(() => { window.card.remove(); document.querySelector('#fixture').append(window.card); });
  await expect(card.locator('ha-card')).toHaveClass(/is-entering/);
  await expect.poll(() => entranceStarts(page)).toBe(6);
  expect(await page.evaluate(() => { window.card.remove(); return [window.card.animationWork.timers.size, window.card.animationWork.cancels.size]; })).toEqual([0, 0]);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.card.shadowRoot.querySelector('ha-card').classList.contains('is-entering'))).toBe(true);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Lock entrance honours the configured duration and is skipped when animations are disabled', async ({ page }) => {
  const card = await mountLock(page, { animations: { content_duration: 900 } });
  const timing = await card.locator('.icon').evaluate(node => node.getAnimations().map(animation => [animation.animationName, Math.round(animation.effect.getComputedTiming().duration)]));
  expect(timing).toEqual([['lock-bloom', 828]]);
  await page.evaluate(() => window.card.setConfig({ entity: 'lock.front', animations: { enabled: false } }));
  const disabled = await page.evaluate(() => {
    const root = window.card.shadowRoot;
    window.lockStates['lock.front'] = { ...window.lockStates['lock.front'], state: 'unlocking' }; window.assignLockHass();
    return {
      entering: root.querySelector('ha-card').classList.contains('is-entering'),
      animations: root.querySelector('ha-card').getAnimations({ subtree: true }).length,
      stateFeedback: window.card.animationWork.cancels.size,
      timers: window.card.animationWork.timers.size,
    };
  });
  expect(disabled).toEqual({ entering: false, animations: 0, stateFeedback: 0, timers: 0 });
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Lock entrance collapses to an instant change with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const card = await mountLock(page);
  const durations = await card.locator('ha-card').evaluate(node => node.getAnimations({ subtree: true }).map(animation => animation.effect.getComputedTiming().duration));
  expect(durations.length).toBeGreaterThan(0);
  expect(durations.every(duration => duration <= 1)).toBe(true);
  await expect(card.locator('.header > div')).toHaveCSS('opacity', '1');
});

test('Lock unlock gestures work while the entrance is running', async ({ page }) => {
  const card = await mountLock(page);
  await expect(card.locator('ha-card')).toHaveClass(/is-entering/);
  const thumb = await card.locator('[data-handle]').boundingBox();
  const track = await card.locator('[role=slider]').boundingBox();
  await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
  await page.mouse.down();
  await page.mouse.move(thumb.x + thumb.width / 2 + track.width, thumb.y + thumb.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.calls)).toEqual([['lock', 'unlock', { entity_id: 'lock.front' }]]);
  // Keyboard unlock after a fresh mount (entrance running again).
  await page.evaluate(() => { window.calls = []; window.card.remove(); window.card.setConfig({ entity: 'lock.front' }); window.assignLockHass(); document.querySelector('#fixture').append(window.card); });
  await expect(card.locator('ha-card')).toHaveClass(/is-entering/);
  const slider = card.locator('[role=slider]');
  await slider.focus();
  for (let i = 0; i < 10; i++) await slider.press('ArrowRight');
  await slider.press('Enter');
  expect(await page.evaluate(() => window.calls)).toEqual([['lock', 'unlock', { entity_id: 'lock.front' }]]);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Lock animation settings default for legacy YAML and are bounded', async ({ page }) => {
  await mountLock(page, {}, { connect: false });
  const normalized = await page.evaluate(() => [
    {}, { animations: null }, { animations: { content_duration: 'abc' } }, { animations: { content_duration: 20 } },
    { animations: { content_duration: '650' } }, { animations: { enabled: false, content_duration: 99999 } },
  ].map(extra => window.__NODALIA_LOCK__.normalizeConfig({ entity: 'lock.front', ...extra }).animations));
  expect(normalized).toEqual([
    { enabled: true, content_duration: 420 }, { enabled: true, content_duration: 420 }, { enabled: true, content_duration: 420 },
    { enabled: true, content_duration: 140 }, { enabled: true, content_duration: 650 }, { enabled: false, content_duration: 1800 },
  ]);
});

test('Lock editor exposes an Animations section that persists into the config', async ({ page }) => {
  await mountLock(page, {}, { connect: false });
  await page.evaluate(async () => {
    const editor = await customElements.get('nodalia-lock-card').getConfigElement();
    editor.hass = window.makeHass(window.lockStates); editor.setConfig({ entity: 'lock.front', name: 'Front' });
    window.lockEditorChanges = [];
    editor.addEventListener('config-changed', event => window.lockEditorChanges.push(event.detail.config));
    document.querySelector('#fixture').append(editor);
  });
  const editor = page.locator('nodalia-lock-card-editor');
  const toggle = editor.locator('[data-editor-toggle="animations"]');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(editor.locator('[data-field="animations.enabled"]')).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(toggle).toBeFocused();
  const enabled = editor.locator('[data-field="animations.enabled"]');
  const duration = editor.locator('[data-field="animations.content_duration"]');
  await expect(enabled).toBeChecked();
  await expect(duration).toHaveValue('420');
  await enabled.focus(); await enabled.press('Space');
  await duration.fill('600'); await duration.blur();
  expect(await page.evaluate(() => window.lockEditorChanges.at(-1))).toEqual({ entity: 'lock.front', name: 'Front', animations: { enabled: false, content_duration: 600 } });
  await duration.fill(''); await duration.blur();
  expect(await page.evaluate(() => window.lockEditorChanges.at(-1))).toEqual({ entity: 'lock.front', name: 'Front', animations: { enabled: false } });
  // A saved config reopens with its values; the card accepts every emitted config.
  await page.evaluate(() => { const editor = document.querySelector('nodalia-lock-card-editor'); editor.setConfig({ entity: 'lock.front', animations: { enabled: false, content_duration: 750 } }); });
  await expect(editor.locator('[data-field="animations.enabled"]')).not.toBeChecked();
  await expect(editor.locator('[data-field="animations.content_duration"]')).toHaveValue('750');
  expect(await page.evaluate(() => window.lockEditorChanges.every(config => { try { window.card.setConfig(config); return true; } catch { return false; } }))).toBe(true);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
