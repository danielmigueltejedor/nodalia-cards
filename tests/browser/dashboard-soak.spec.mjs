import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test('a large dashboard retains entrance animations and releases view work after repeated switches', async ({ page }) => {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-light-card'));
  const result = await page.evaluate(async () => {
    const types = ['light', 'fan', 'humidifier', 'vacuum'];
    const states = {};
    for (let i = 0; i < 48; i++) states[`${types[i % 4]}.item${i}`] = { state: 'on', attributes: { friendly_name: `Device ${i}`, brightness: 128, percentage: 50, humidity: 50, temperature: 22, supported_features: 0 } };
    let hass = window.makeHass(states);
    const panels = [[], []];
    for (let i = 0; i < 48; i++) {
      const type = types[i % 4], card = document.createElement(`nodalia-${type}-card`);
      card.setConfig({ entity: `${type}.item${i}`, animations: { enabled: true } });
      card.hass = hass;
      panels[Math.floor(i / 4) % 2].push(card);
    }
    const container = document.querySelector('#fixture');
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    for (let cycle = 0; cycle < 80; cycle++) {
      const slot = Math.floor(cycle / 2) % 24, index = Math.floor(slot / 4) * 8 + (cycle % 2) * 4 + slot % 4, id = `${types[index % 4]}.item${index}`;
      hass = { ...hass, states: { ...hass.states, [id]: { ...hass.states[id], attributes: { ...hass.states[id].attributes, brightness: cycle, percentage: cycle } } } };
      const panel = panels[Math.floor(index / 4) % 2];
      for (const card of panel) card.hass = hass;
      container.replaceChildren(...panel);
      if (cycle % 4 === 0) await frame();
    }
    container.replaceChildren(...panels[0]);
    await frame();
    const animations = panels[0].reduce((count, card) => count + (card.shadowRoot?.getAnimations({ subtree: true }).length || 0), 0);
    container.replaceChildren();
    await new Promise(resolve => setTimeout(resolve, 250));
    const pending = panels.flat().filter(card => card.isConnected || card._resizeFrame || card._panelWork?.timers.size || card._animationWork?.timers.size || card._nodaliaDeferTimers?.size).length;
    return { animations, pending, errors: window.bundleErrors };
  });
  expect(result.animations).toBeGreaterThan(0);
  expect(result.pending).toBe(0);
  expect(result.errors).toEqual([]);
});

test('frequent entity updates do not extend the entrance period indefinitely', async ({ page }) => {
  await page.clock.install();
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-light-card'));
  await page.evaluate(() => {
    const state = { state: 'on', attributes: { friendly_name: 'Light', brightness: 100, supported_color_modes: ['brightness'] } };
    window.soakHass = window.makeHass({ 'light.soak': state });
    const card = document.createElement('nodalia-light-card');
    card.setConfig({ entity: 'light.soak', animations: { enabled: true } });
    card.hass = window.soakHass; document.querySelector('#fixture').append(card); window.soakLight = card;
  });
  for (let i = 0; i < 20; i++) {
    await page.clock.runFor(100);
    await page.evaluate(i => {
      const old = window.soakHass.states['light.soak'];
      window.soakHass = { ...window.soakHass, states: { ...window.soakHass.states, 'light.soak': { ...old, attributes: { ...old.attributes, brightness: 100 + i } } } };
      window.soakLight.hass = window.soakHass;
    }, i);
  }
  expect(await page.evaluate(() => ({ pending: window.soakLight._animateContentOnNextRender, entering: Boolean(window.soakLight.shadowRoot.querySelector('.light-card__content--entering')) }))).toEqual({ pending: false, entering: false });
  const restarted = await page.evaluate(() => {
    const card = window.soakLight;
    card.remove();
    document.querySelector('#fixture').append(card);
    return card._animateContentOnNextRender && Boolean(card._entranceAnimationResetTimer);
  });
  expect(restarted).toBe(true);
  await page.clock.runFor(2000);
  expect(await page.evaluate(() => window.soakLight._animateContentOnNextRender)).toBe(false);
});

test('a hidden large dashboard resumes after twelve simulated hours and changing states', async ({ page }) => {
  test.setTimeout(120_000);
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  if (process.env.NODALIA_SOAK_BASELINE) await page.route('**/nodalia-cards.js', route => route.fulfill({ path: resolve(process.env.NODALIA_SOAK_BASELINE), contentType: 'text/javascript' }));
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-light-card'));
  await page.evaluate(disableAnimations => {
    const types = ['light', 'fan', 'humidifier', 'vacuum'];
    const states = {};
    for (let i = 0; i < 48; i++) {
      const type = types[i % 4];
      states[`${type}.idle${i}`] = { state: 'on', attributes: { friendly_name: `Device ${i}`, brightness: 128, percentage: 50, humidity: 50, temperature: 22, supported_features: 0 } };
    }
    window.idleHass = window.makeHass(states);
    window.idlePanels = [[], []];
    for (let i = 0; i < 48; i++) {
      const type = types[i % 4], card = document.createElement(`nodalia-${type}-card`);
      card.setConfig({ entity: `${type}.idle${i}`, animations: { enabled: !disableAnimations } });
      card.hass = window.idleHass;
      window.idlePanels[Math.floor(i / 4) % 2].push(card);
    }
    window.idleContainer = document.querySelector('#fixture');
    window.idleContainer.replaceChildren(...window.idlePanels[0]);
    window.measureIdleSwitches = async () => {
      const samples = [];
      for (let i = 0; i < 3; i++) {
        const begin = performance.now();
        window.idleContainer.replaceChildren(...window.idlePanels[i % 2]);
        const mount = performance.now() - begin;
        let previous = performance.now(), gaps = [];
        const end = previous + 350;
        while (performance.now() < end) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const now = performance.now(); gaps.push(now - previous); previous = now;
        }
        samples.push({ mount, frames: gaps.length, maxGap: Math.max(...gaps) });
      }
      return samples;
    };
  }, Boolean(process.env.NODALIA_IDLE_NO_ANIMATIONS));
  let wallStart = Date.now();
  const framesBefore = await page.evaluate(() => window.measureIdleSwitches());
  const wallBefore = Date.now() - wallStart;
  await page.evaluate(() => {
    window.idleContainer.replaceChildren(...window.idlePanels[0]);
    window.idleStart = Date.now();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const stepMs = process.env.NODALIA_IDLE_STEP_MS === undefined ? 10 * 60 * 1000 : Number(process.env.NODALIA_IDLE_STEP_MS);
  for (let step = 0; step < 72; step++) {
    if (stepMs) await page.clock.fastForward(stepMs);
    if (process.env.NODALIA_IDLE_NO_UPDATES) continue;
    await page.evaluate(step => {
      const i = (step % 24), index = Math.floor(i / 4) * 8 + i % 4;
      const type = ['light', 'fan', 'humidifier', 'vacuum'][index % 4], id = `${type}.idle${index}`;
      const previous = window.idleHass.states[id];
      window.idleHass = { ...window.idleHass, states: { ...window.idleHass.states, [id]: { ...previous, attributes: { ...previous.attributes, brightness: 30 + step % 200, percentage: step % 100 } } } };
      for (const card of window.idlePanels[0]) card.hass = window.idleHass;
    }, step);
  }
  const resumed = await page.evaluate(() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
    return { elapsed: Date.now() - window.idleStart, hidden: document.hidden, errors: window.bundleErrors };
  });
  expect(resumed.elapsed).toBeGreaterThanOrEqual(72 * stepMs);
  expect(resumed.hidden).toBe(false);
  expect(resumed.errors).toEqual([]);
  wallStart = Date.now();
  const framesAfter = await page.evaluate(() => window.measureIdleSwitches());
  const wallAfter = Date.now() - wallStart;
  console.log('Simulated idle frame samples:', JSON.stringify({ before: framesBefore, after: framesAfter, wallBefore, wallAfter }));
  for (let i = 0; i < 8; i++) {
    await page.evaluate(i => {
      const panel = window.idlePanels[i % 2];
      for (const card of panel) card.hass = window.idleHass;
      window.idleContainer.replaceChildren(...panel);
    }, i);
    await page.clock.runFor(100);
    const state = await page.evaluate(() => ({ cards: window.idleContainer.children.length, animated: [...window.idleContainer.children].reduce((sum, card) => sum + (card.shadowRoot?.getAnimations({ subtree: true }).length || 0), 0), errors: window.bundleErrors }));
    expect(state.cards).toBe(24);
    if (!process.env.NODALIA_IDLE_NO_ANIMATIONS) expect(state.animated).toBeGreaterThan(0);
    expect(state.errors).toEqual([]);
  }
  await page.evaluate(() => window.idleContainer.replaceChildren());
  await page.clock.runFor(1000);
  const pending = await page.evaluate(() => window.idlePanels.flat().filter(card => card.isConnected || card._resizeFrame || card._panelWork?.timers.size || card._animationWork?.timers.size || card._nodaliaDeferTimers?.size).length);
  expect(pending).toBe(0);
});

test('clock-only control for accelerated frame measurements', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-01T08:00:00Z') });
  await page.goto('/tests/fixtures/browser.html');
  const sample = () => page.evaluate(async () => {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      let previous = performance.now(); const end = previous + 350; const gaps = [];
      while (performance.now() < end) { await new Promise(resolve => requestAnimationFrame(resolve)); const now = performance.now(); gaps.push(now - previous); previous = now; }
      samples.push({ frames: gaps.length, maxGap: Math.max(...gaps) });
    }
    return samples;
  });
  const before = await sample();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  for (let step = 0; step < 72; step++) await page.clock.fastForward(10 * 60 * 1000);
  await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
  const after = await sample();
  console.log('Clock-only frame samples:', JSON.stringify({ before, after }));
  expect(before.every(item => item.frames > 0)).toBe(true);
  expect(after.every(item => item.frames > 0)).toBe(true);
});
