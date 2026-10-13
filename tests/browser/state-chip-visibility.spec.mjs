import { expect, test } from '@playwright/test';

const cards = [
  { domain: 'humidifier', prefix: 'humidifier-card', value: '.humidifier-card__chip[data-humidifier-chip="humidity"]', option: 'show_target_humidity_chip', flags: { show_target_humidity_chip: true, show_mode_chip: true, show_fan_mode_chip: true }, chips: ['On', '50%', 'Auto', 'Quiet'], attributes: { humidity: 50, min_humidity: 0, max_humidity: 100, mode: 'Auto', available_modes: ['Auto', 'Clothes-Dry', 'Shoes-Dry'], supported_features: 1 } },
  { domain: 'fan', prefix: 'fan-card', value: 'span[data-fan-chip="percentage"]', option: 'show_percentage_chip', flags: { show_percentage_chip: true, show_mode_chip: true }, chips: ['On', '50%', 'Auto'], attributes: { percentage: 50, percentage_step: 10, preset_mode: 'Auto', preset_modes: ['Auto', 'Sleep'], supported_features: 9 } },
  { domain: 'cover', prefix: 'fan-card', value: '.fan-card__chip[data-cover-chip="position"]', option: 'show_position_chip', flags: { show_position_chip: true, show_tilt_chip: true }, chips: ['Open', '50%', 'Tilt 30%'], attributes: { current_position: 50, current_tilt_position: 30, supported_features: 255 } },
];

async function mount(page, item, width = 360, mode = 'auto', config = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(domain => customElements.get(`nodalia-${domain}-card`), item.domain);
  await page.evaluate(({ item, width, mode, config }) => {
    const entity = `${item.domain}.test`;
    const settings = { entity, name: 'A long device name for narrow cards', show_state: true, ...item.flags, layout: mode === 'circular' ? 'circular' : 'compact', compact_layout_mode: mode === 'circular' ? 'never' : mode, language: 'en', animations: { enabled: false }, ...(item.domain === 'humidifier' ? { fan_mode_entity: 'select.fan', hidden_modes: ['Clothes-Dry', 'Shoes-Dry'], styles: { icon: { background: 'rgba(255, 255, 255, 0.06)', on_color: '#be38f3' }, slider_color: '#be38f3' } } : {}), ...config };
    const states = { [entity]: { state: item.domain === 'cover' ? 'open' : 'on', attributes: item.attributes }, 'select.fan': { state: 'Quiet', attributes: { options: ['Quiet', 'Boost'] } } };
    const card = document.createElement(`nodalia-${item.domain}-card`);
    card.style.width = `${width}px`; card.setConfig(settings); card.hass = window.makeHass(states);
    document.querySelector('#fixture').append(card);
    window.stateChipCard = card; window.stateChipConfig = settings; window.stateChipStates = states;
  }, { item, width, mode, config });
  return page.locator(`nodalia-${item.domain}-card`);
}

async function expectChipsInsideCard(page, item) {
  const geometry = await page.evaluate(prefix => {
    const root = window.stateChipCard.shadowRoot;
    const surface = root.querySelector('ha-card').getBoundingClientRect();
    const rects = [...root.querySelectorAll(`.${prefix}__chip`)].map(node => {
      const r = node.getBoundingClientRect();
      return { text: node.textContent, left: r.left - surface.left, right: surface.right - r.right, top: r.top - surface.top, bottom: surface.bottom - r.bottom, width: r.width, height: r.height, visibleText: node.clientWidth - parseFloat(getComputedStyle(node).paddingLeft) - parseFloat(getComputedStyle(node).paddingRight) };
    });
    const title = root.querySelector(`.${prefix}__title`).getBoundingClientRect();
    const icon = root.querySelector(`.${prefix}__icon`).getBoundingClientRect();
    return { rects, titleWidth: title.width, titleAfterIcon: title.left - icon.right };
  }, item.prefix);
  expect(geometry.titleWidth).toBeGreaterThan(20);
  expect(geometry.titleAfterIcon).toBeGreaterThanOrEqual(-0.5);
  for (const rect of geometry.rects) {
    for (const edge of ['left', 'right', 'top', 'bottom']) expect(rect[edge], `${rect.text} ${edge}: ${JSON.stringify(rect)}`).toBeGreaterThanOrEqual(-0.5);
    expect(rect.visibleText, rect.text).toBeGreaterThan(10);
    expect(rect.height).toBeGreaterThan(10);
  }
}

for (const item of cards) {
  for (const width of [184, 360, 720]) {
    for (const mode of ['auto', 'always', 'never', 'circular']) {
      test(`${item.domain} enabled chips remain visible at ${width}px (${mode})`, async ({ page }) => {
        const card = await mount(page, item, width, mode);
        for (const text of item.chips) await expect(card.locator(`.${item.prefix}__chip`).filter({ hasText: new RegExp(`^${text}$`) })).toBeVisible();
        await expect(card.locator(`.${item.prefix}__chip`)).toHaveCount(item.chips.length);
        await expectChipsInsideCard(page, item);
        await page.evaluate(() => { window.stateChipCard.style.width = '184px'; });
        await expect(card.locator(item.value)).toBeVisible();
        await expectChipsInsideCard(page, item);
      });
    }
  }

  test(`${item.domain} disabled chips stay hidden independently of compact mode`, async ({ page }) => {
    const flags = Object.fromEntries(Object.keys(item.flags).map(key => [key, false]));
    const card = await mount(page, item, 360, 'always', { ...flags, show_state: false });
    await expect(card.locator(`.${item.prefix}__chip`)).toHaveCount(0);
    await page.evaluate(flags => window.stateChipCard.setConfig({ ...window.stateChipConfig, compact_layout_mode: 'never', ...flags, show_state: false }), flags);
    await expect(card.locator(`.${item.prefix}__chip`)).toHaveCount(0);
  });

  test(`${item.domain} editor restores its value chip in a compact card`, async ({ page }) => {
    const card = await mount(page, item);
    await page.evaluate(async item => {
      const editor = await customElements.get(`nodalia-${item.domain}-card`).getConfigElement();
      editor.setConfig(window.stateChipConfig); editor.hass = window.makeHass(window.stateChipStates);
      editor.addEventListener('config-changed', event => { window.stateChipSaved = event.detail.config; window.stateChipCard.setConfig(event.detail.config); });
      document.querySelector('#fixture').append(editor);
    }, item);
    const editor = page.locator(`nodalia-${item.domain}-card-editor`);
    const label = editor.locator(`label:has(input[data-field="${item.option}"])`);
    await label.click();
    await expect(card.locator(item.value)).toHaveCount(0);
    expect(await page.evaluate(option => window.stateChipSaved[option], item.option)).toBe(false);
    await label.click();
    await expect(card.locator(item.value)).toBeVisible();
    await expectChipsInsideCard(page, item);
  });
}

for (const item of cards.slice(0, 2)) {
  test(`${item.domain} enabled value chip does not depend on slider visibility`, async ({ page }) => {
    const card = await mount(page, item, 360, 'always', { show_slider: false });
    await expect(card.locator(item.value)).toHaveText('50%');
    await expect(card.locator('input[type="range"]')).toHaveCount(0);
  });
}

for (const item of cards.slice(0, 2)) {
  test(`${item.domain} compact chip follows reported value updates`, async ({ page }) => {
    const card = await mount(page, item, 184, 'auto');
    await expect(card.locator(item.value)).toHaveText('50%');
    await page.evaluate(domain => {
      const entity = `${domain}.test`;
      const old = window.stateChipStates[entity];
      window.stateChipStates = { ...window.stateChipStates, [entity]: { ...old, attributes: { ...old.attributes, [domain === 'fan' ? 'percentage' : 'humidity']: 65 } } };
      window.stateChipCard.hass = window.makeHass(window.stateChipStates);
    }, item.domain);
    await expect(card.locator(item.value)).toHaveText('65%');
    await expectChipsInsideCard(page, item);
  });
}

test('Humidifier target humidity appears with the reported default configuration', async ({ page }) => {
  const item = cards[0];
  const card = await mount(page, item);
  await page.evaluate(() => {
    window.stateChipCard.setConfig({
      entity: 'humidifier.test', name: 'Deshumidificador',
      hidden_modes: ['Clothes-Dry', 'Shoes-Dry'],
      styles: { icon: { background: 'rgba(255, 255, 255, 0.06)', on_color: '#be38f3' }, slider_color: '#be38f3' },
      grid_options: { columns: 12, rows: 'auto' }, animations: { enabled: false },
    });
  });
  await expect(card.locator(item.value)).toHaveText('50%');
  await expect(card.locator('.humidifier-card__chip--state')).toHaveCount(0);
  await expectChipsInsideCard(page, item);
});
