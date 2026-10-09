import { expect, test } from '@playwright/test';

// Helper-entity discovery scans the whole HA catalog. It is cached until the catalog (ids,
// friendly names, registry identity) changes, and a cached card must always agree with a
// card that discovers from scratch on the same HA snapshot.
async function mount(page) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-vacuum-card') && customElements.get('nodalia-advance-vacuum-card'));
  await page.evaluate(() => {
    const base = () => {
      const entities = {
        'vacuum.robot': { state: 'docked', attributes: { friendly_name: 'Robot' } },
        'vacuum.robot_pro': { state: 'docked', attributes: { friendly_name: 'Robot Pro' } },
        'sensor.robot_status': { state: 'idle', attributes: { friendly_name: 'Robot status' } },
        'sensor.robot_battery': { state: '80', attributes: { friendly_name: 'Robot battery' } },
        'select.robot_fan_speed': { state: 'a', attributes: { friendly_name: 'Robot fan speed' } },
        'select.robot_mop_mode': { state: 'a', attributes: { friendly_name: 'Robot mop mode' } },
        'button.robot_start_cleaning': { state: 'unknown', attributes: { friendly_name: 'Robot start cleaning' } },
        'sensor.unrelated': { state: '1', attributes: { friendly_name: 'Other' } },
      };
      for (let i = 0; i < 60; i++) entities[`sensor.noise_${i}`] = { state: String(i), attributes: { friendly_name: `Noise ${i}` } };
      return entities;
    };
    window.disc = { entities: base(), registry: {} };
    window.disc.hass = () => {
      const hass = window.createHassFixture({ entities: window.disc.entities });
      hass.entities = structuredClone(window.disc.registry);
      return hass;
    };
    const config = { entity: 'vacuum.robot', language: 'en', animations: { enabled: false } };
    window.disc.make = () => {
      const vacuum = document.createElement('nodalia-vacuum-card');
      vacuum.setConfig({ ...config });
      const advance = document.createElement('nodalia-advance-vacuum-card');
      advance.setConfig({ ...config, allow_goto_mode: false });
      return { vacuum, advance };
    };
    window.disc.snapshot = (cards, hass) => {
      cards.vacuum.hass = hass; cards.advance.hass = hass;
      const related = cards.vacuum._getRelatedEntityCache();
      return {
        vacuum: { state: related?.state, error: related?.error, battery: related?.battery, roomMapping: related?.roomMapping, suctionSelect: related?.suctionSelect, mopSelect: related?.mopSelect },
        selects: cards.advance._listRelatedEntitiesByPatterns('select', ['fan_speed', 'mop']),
        button: cards.advance._guessGlobalEntityByPatterns(['button'], ['start', 'clean']),
        tracking: (({ roomIds, activityIds }) => ({ roomIds, activityIds }))(cards.advance._getRelatedVacuumEntityIds(hass)),
      };
    };
    window.disc.cards = window.disc.make();
    document.querySelector('#fixture').append(window.disc.cards.vacuum, window.disc.cards.advance);
  });
}

const mutations = {
  'only state values change': () => { window.disc.entities['sensor.robot_battery'] = { state: '79', attributes: { friendly_name: 'Robot battery' } }; window.disc.entities['sensor.noise_1'] = { state: 'x', attributes: { friendly_name: 'Noise 1' } }; },
  'a matching helper is added': () => { window.disc.entities['sensor.robot_error_code'] = { state: '0', attributes: { friendly_name: 'Robot error' } }; window.disc.entities['select.robot_fan_power'] = { state: 'a', attributes: { friendly_name: 'Robot fan power' } }; },
  'a matching helper is removed': () => { delete window.disc.entities['select.robot_mop_mode']; delete window.disc.entities['button.robot_start_cleaning']; },
  'a helper is renamed so it no longer matches': () => { window.disc.entities['sensor.robot_battery'] = { state: '80', attributes: { friendly_name: 'Something else' } }; window.disc.entities['sensor.battery_other'] = { state: '1', attributes: { friendly_name: 'Other battery' } }; },
  'a helper is renamed so it matches': () => { window.disc.entities['sensor.generic_rooms'] = { state: '1', attributes: { friendly_name: 'Robot rooms' } }; },
  'a registry device ties an unrelated helper to the robot': () => { window.disc.registry['vacuum.robot'] = { device_id: 'dev1' }; window.disc.registry['sensor.unrelated'] = { device_id: 'dev1' }; window.disc.entities['select.generic_suction'] = { state: 'a', attributes: { friendly_name: 'Suction level' } }; window.disc.registry['select.generic_suction'] = { device_id: 'dev1' }; },
  'a registry entry moves to another device': () => { window.disc.registry['select.generic_suction'] = { device_id: 'dev2' }; },
  'a sibling vacuum that owns the helper appears': () => { window.disc.entities['vacuum.robot_pro_max'] = { state: 'docked', attributes: { friendly_name: 'Robot Pro Max' } }; window.disc.entities['sensor.robot_pro_max_status'] = { state: 'idle', attributes: { friendly_name: 'Robot Pro Max status' } }; },
};

test('cached discovery agrees with a fresh scan after every catalog change', async ({ page }) => {
  await mount(page);
  const results = [];
  for (const [name, mutate] of Object.entries(mutations)) {
    const outcome = await page.evaluate(({ name, mutateSource }) => {
      new Function(`return ${mutateSource}`)()();
      const hass = window.disc.hass();
      const cached = window.disc.snapshot(window.disc.cards, hass);
      const fresh = window.disc.make();
      const oracle = window.disc.snapshot(fresh, hass);
      return { name, same: JSON.stringify(cached) === JSON.stringify(oracle), cached, oracle };
    }, { name, mutateSource: mutate.toString() });
    results.push(outcome);
  }
  expect(results.filter(r => !r.same)).toEqual([]);
  // The mutations really move the discovery result, so a stale cache could not pass unnoticed.
  expect(new Set(results.map(r => JSON.stringify(r.oracle))).size).toBeGreaterThanOrEqual(5);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('unrelated state updates reuse the discovery result', async ({ page }) => {
  await mount(page);
  const outcome = await page.evaluate(() => {
    const first = window.disc.hass();
    window.disc.cards.vacuum.hass = first; window.disc.cards.advance.hass = first;
    const vacuumBefore = window.disc.cards.vacuum._getRelatedEntityCache();
    const trackingBefore = window.disc.cards.advance._getRelatedVacuumEntityIds(first);
    const selectsBefore = window.disc.cards.advance._listRelatedEntitiesByPatterns('select', ['fan_speed']);
    let reused = true;
    for (let n = 0; n < 20; n++) {
      window.disc.entities['sensor.noise_0'] = { state: String(n), attributes: { friendly_name: 'Noise 0' } };
      window.disc.entities['sensor.robot_battery'] = { state: String(50 + n), attributes: { friendly_name: 'Robot battery' } };
      const next = window.disc.hass();
      window.disc.cards.vacuum.hass = next; window.disc.cards.advance.hass = next;
      reused = reused
        && window.disc.cards.vacuum._getRelatedEntityCache() === vacuumBefore
        && window.disc.cards.advance._getRelatedVacuumEntityIds(next) === trackingBefore
        && JSON.stringify(window.disc.cards.advance._listRelatedEntitiesByPatterns('select', ['fan_speed'])) === JSON.stringify(selectsBefore);
    }
    return { reused, battery: vacuumBefore?.battery, selects: selectsBefore };
  });
  expect(outcome).toEqual({ reused: true, battery: 'sensor.robot_battery', selects: ['select.robot_fan_speed'] });
});
