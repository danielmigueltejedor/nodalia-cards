import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function mountAlarm(page, { width = 360, language = 'es', config = {} } = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-alarm-panel-card'));
  await page.evaluate(({ width, language, config }) => {
    const fixture = document.querySelector('#fixture');
    fixture.style.width = `${width}px`;
    fixture.style.maxWidth = 'none';
    const card = document.createElement('nodalia-alarm-panel-card');
    card.setConfig({
      entity: 'alarm_control_panel.casa', name: 'Alarma', code: '1234',
      show_code_input: false, wrong_code_feedback_ms: 2000,
      styles: { state_tints: { armed_home: '#ed719e', armed_away: '#aa7942', armed_vacation: '#fecb3e' } },
      grid_options: { columns: 12, rows: 'auto' }, animations: { enabled: false }, ...config,
    });
    const hass = window.makeHass({
      'alarm_control_panel.casa': {
        state: 'disarmed', attributes: { supported_features: 63, code_format: 'number' },
      },
    });
    hass.language = language;
    hass.locale.language = language;
    window.alarmLabelCalls = [];
    hass.callService = (...args) => { window.alarmLabelCalls.push(args); return Promise.resolve(); };
    card.hass = hass;
    fixture.append(card);
    window.alarmLabelCard = card;
  }, { width, language, config });
  return page.locator('nodalia-alarm-panel-card');
}

test('Alarm keeps translated arm and disarm labels with hidden PIN in automatic compact layout', async ({ page }) => {
  const card = await mountAlarm(page);
  await expect.poll(() => page.evaluate(() => window.alarmLabelCard._isCompactLayout)).toBe(true);
  const away = card.locator('[data-alarm-action="alarm_arm_away"]');
  await expect(away.locator('.alarm-card__action-label')).toHaveText('Ausente');
  await expect(away.locator('.alarm-card__action-label')).toBeVisible();
  await expect(card.locator('input')).toHaveCount(0);
  await away.click();
  expect(await page.evaluate(() => window.alarmLabelCalls)).toEqual([
    ['alarm_control_panel', 'alarm_arm_away', { entity_id: 'alarm_control_panel.casa', code: '1234' }],
  ]);
  await page.evaluate(() => {
    const card = window.alarmLabelCard;
    card._hass.states['alarm_control_panel.casa'].state = 'armed_away';
    card.hass = card._hass;
  });
  const disarm = card.locator('[data-alarm-action="alarm_disarm"]');
  await expect(disarm.locator('.alarm-card__action-label')).toHaveText('Desarmar');
  await expect(disarm.locator('.alarm-card__action-label')).toBeVisible();
  await disarm.click();
  expect(await page.evaluate(() => window.alarmLabelCalls[1])).toEqual(
    ['alarm_control_panel', 'alarm_disarm', { entity_id: 'alarm_control_panel.casa', code: '1234' }],
  );
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Alarm labels stay visible after resizing and when compact density is forced', async ({ page }) => {
  const card = await mountAlarm(page, { width: 720 });
  for (const width of [720, 320, 180, 720]) {
    await page.evaluate(width => document.querySelector('#fixture').style.width = `${width}px`, width);
    await expect.poll(() => page.evaluate(() => window.alarmLabelCard._cardWidth)).toBe(width);
    await expect(card.locator('.alarm-card__action-label')).toHaveText(['Casa', 'Ausente', 'Noche']);
    for (const label of await card.locator('.alarm-card__action-label').all()) await expect(label).toBeVisible();
  }
  await page.evaluate(() => {
    const card = window.alarmLabelCard;
    card.setConfig({ ...card._config, compact_layout_mode: 'always' });
    document.querySelector('#fixture').style.width = '360px';
  });
  await expect.poll(() => page.evaluate(() => window.alarmLabelCard._isCompactLayout)).toBe(true);
  await expect(card.locator('.alarm-card__action-label')).toHaveText(['Casa', 'Ausente', 'Noche']);
});

test('Alarm fits all enabled mode labels in narrow cards across all supported languages', async ({ page }) => {
  const languages = ['de', 'el', 'en', 'es', 'fr', 'it', 'nl', 'no', 'pt', 'ro', 'ru', 'zh'];
  const card = await mountAlarm(page, { width: 180, config: { show_arm_vacation: true, show_custom_bypass: true } });
  for (const language of languages) {
    const labels = JSON.parse(readFileSync(new URL(`../../i18n/runtime/${language}.json`, import.meta.url))).alarmPanel.actions;
    await page.evaluate(language => {
      const card = window.alarmLabelCard;
      card._hass.language = language;
      card._hass.locale.language = language;
      card.hass = card._hass;
    }, language);
    await expect(card.locator('.alarm-card__action-label')).toHaveText([
      labels.arm_home, labels.arm_away, labels.arm_night, labels.arm_vacation, labels.arm_custom_bypass,
    ]);
    const geometry = await card.evaluate(host => {
      const surface = host.shadowRoot.querySelector('ha-card').getBoundingClientRect();
      return [...host.shadowRoot.querySelectorAll('.alarm-card__action')].every(button => {
        const box = button.getBoundingClientRect();
        const label = button.querySelector('.alarm-card__action-label');
        const text = label.getBoundingClientRect();
        return box.left >= surface.left && box.right <= surface.right + 1
          && box.height >= 40 && text.left >= box.left && text.right <= box.right + 1
          && label.scrollWidth <= label.clientWidth + 1 && text.height > 0;
      });
    });
    expect(geometry, language).toBe(true);
  }
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('Alarm applies edited compact density without needing a resize', async ({ page }) => {
  const card = await mountAlarm(page, { width: 360 });
  await expect.poll(() => page.evaluate(() => window.alarmLabelCard._isCompactLayout)).toBe(true);
  for (const [mode, compact] of [['never', false], ['always', true], ['never', false], ['auto', true]]) {
    await page.evaluate(mode => {
      const card = window.alarmLabelCard;
      card.setConfig({ ...card._config, compact_layout_mode: mode });
    }, mode);
    await expect.poll(() => page.evaluate(() => window.alarmLabelCard._isCompactLayout)).toBe(compact);
    await expect(card.locator('.alarm-card__action-label')).toHaveText(['Casa', 'Ausente', 'Noche']);
  }
});
