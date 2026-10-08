import { expect, test } from '@playwright/test';

// The reporter's Insignia: a temperature sensor with a multi-line gradient background.
// Choosing a manual tint in the visual editor must recolor the card, and a gradient
// background must survive (it was discarded for its line breaks and could not be
// color-mixed with the tint).
const GRADIENT = 'radial-gradient(circle at 12% 10%, color-mix(in srgb, #ff6b6b 22%,\ntransparent), transparent 55%),\n\nlinear-gradient(120deg, color-mix(in srgb, #ff6b6b 18%, transparent),\ntransparent 70%),\n\nvar(--ha-card-background)\n';

async function mountInsignia(page, styles = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-insignia-card'));
  await page.evaluate(async styles => {
    document.documentElement.style.setProperty('--ha-card-background', 'rgb(28, 28, 28)');
    document.documentElement.style.setProperty('--divider-color', 'rgb(60, 60, 60)');
    const hass = window.makeHass({ 'sensor.average': { state: '22.4', attributes: { friendly_name: 'Average temperature', unit_of_measurement: '°C', device_class: 'temperature' } } });
    const config = Object.freeze({ type: 'custom:nodalia-insignia-card', entity: 'sensor.average', name: 'Average temperature', use_entity_icon: true, show_name: false, styles: { icon: { on_color: '#ff6b6b' }, ...styles } });
    const card = document.createElement('nodalia-insignia-card'); card.setConfig(config); card.hass = hass;
    const editor = await customElements.get('nodalia-insignia-card').getConfigElement();
    editor.hass = hass; editor.setConfig(config);
    // Home Assistant's dialog: freeze the emitted object and hand it back to card and editor.
    editor.addEventListener('config-changed', event => { const next = Object.freeze(event.detail.config); window.lastConfig = next; card.setConfig(next); editor.setConfig(next); });
    document.querySelector('#fixture').append(editor, card);
    window.insignia = card;
  }, styles);
  return page.locator('nodalia-insignia-card');
}

const background = card => card.locator('.insignia-card').evaluate(node => getComputedStyle(node).backgroundImage);

test('Choosing a manual tint in the editor recolors the card', async ({ page }) => {
  const card = await mountInsignia(page);
  const before = await background(card);
  const editor = page.locator('nodalia-insignia-card-editor');
  await editor.locator('[data-editor-toggle="styles"]').click();
  await expect(editor.locator('[data-field="tint_auto"]')).toBeChecked();
  await editor.locator('input[type="color"][data-field="styles.tint.color"]').evaluate(input => {
    input.value = '#0000ff';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  });
  await expect.poll(() => page.evaluate(() => window.lastConfig?.tint_auto)).toBe(false);
  expect(await page.evaluate(() => window.lastConfig.styles.tint.color.toLowerCase())).toBe('#0000ff');
  await expect(editor.locator('[data-field="tint_auto"]')).not.toBeChecked();
  const after = await background(card);
  expect(after).not.toBe(before);
  // The tint layer is now blue (srgb 0 0 1 at a low alpha).
  expect(after).toMatch(/color\(srgb 0 0 1 \/ 0\.18\)|rgba\(0, 0, 255, 0\.18\)/);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('A multi-line gradient background keeps its layers under the tint', async ({ page }) => {
  const card = await mountInsignia(page, { card: { background: GRADIENT } });
  const layers = await background(card);
  expect(layers).toContain('radial-gradient');
  expect((layers.match(/linear-gradient/g) || []).length).toBe(2);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Over a solid background the tint is a translucent layer above the base color', async ({ page }) => {
  const card = await mountInsignia(page);
  // An 18%/10% tint layer over an opaque color equals the former color-mix result.
  const surface = await card.locator('.insignia-card').evaluate(node => {
    const style = getComputedStyle(node);
    return { image: style.backgroundImage, color: style.backgroundColor };
  });
  expect(surface.image.startsWith('linear-gradient(135deg')).toBe(true);
  expect(surface.color).toBe('rgb(28, 28, 28)');
});
