import { expect, test } from '@playwright/test';

const svg = (width = 2048, height = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="gray"/></svg>`;

async function mount(page, { room = { id: 'far', label: 'Far room', outline: [[1350, 200], [1850, 200], [1850, 700], [1350, 700]] }, calibrationSource = {} } = {}) {
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-advance-vacuum-card'));
  await page.evaluate(({ room, calibrationSource }) => {
    const card = document.createElement('nodalia-advance-vacuum-card');
    card.setConfig({
      entity: 'vacuum.one',
      animations: { enabled: false },
      map_source: { camera: 'image.map' },
      calibration_source: calibrationSource,
      room_tracking: { auto_detect: false },
      room_segments: [room],
    });
    window.markerHass = window.makeHass({
      'vacuum.one': { state: 'docked', attributes: { friendly_name: 'Vacuum' } },
      'image.map': { state: 'ready', attributes: { entity_picture: '/room-marker-map.svg' } },
    });
    card.hass = window.markerHass;
    document.querySelector('#fixture').append(card);
    window.markerCard = card;
  }, { room, calibrationSource });
  const card = page.locator('nodalia-advance-vacuum-card');
  await card.locator('[data-mode-id="rooms"]').click();
  return card;
}

test('room markers never clamp to the bottom right on first load or reload', async ({ page }) => {
  let releaseImage = () => {};
  let heldImage = Promise.resolve();
  await page.route('**/room-marker-map.svg*', async route => {
    await heldImage;
    await route.fulfill({ contentType: 'image/svg+xml', body: svg() });
  });
  // Coordinates extend beyond the temporary 1024px placeholder image width.
  for (let attempt = 0; attempt < 2; attempt++) {
    heldImage = new Promise(resolve => { releaseImage = resolve; });
    try {
      const card = await mount(page);
      const mapMarker = card.locator('.advance-vacuum-card__room-marker[data-room-id="far"]');
      const fallback = card.locator('.advance-vacuum-card__room-chip[data-room-id="far"]');
      await expect(mapMarker).toHaveCount(0);
      await expect(fallback).toBeVisible();
      releaseImage();
      await expect(mapMarker).toBeVisible();
      await expect(fallback).toHaveCount(0);
      const position = await mapMarker.evaluate(node => ({
        left: Number.parseFloat(node.style.left),
        top: Number.parseFloat(node.style.top),
      }));
      expect(position.left).toBeGreaterThan(50);
      expect(position.left).toBeLessThan(95);
      expect(position.top).toBeGreaterThan(10);
      expect(position.top).toBeLessThan(90);
      expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
    } finally {
      releaseImage();
    }
  }
});

test('failed images retain selectable room chips, not misplaced map buttons', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({ status: 404 }));
  const card = await mount(page);
  await expect(card.locator('.advance-vacuum-card__room-marker[data-room-id="far"]')).toHaveCount(0);
  const fallback = card.locator('.advance-vacuum-card__room-chip[data-room-id="far"]');
  await expect(fallback).toBeVisible();
  await fallback.click();
  await expect(fallback).toHaveClass(/is-selected/);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('calibration arriving after map load restores room markers without clamping invalid coordinates', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({
    contentType: 'image/svg+xml', body: svg(1024, 1024),
  }));
  const card = await mount(page, { calibrationSource: { camera: true } });
  await expect.poll(() => page.evaluate(() => window.markerCard._mapImageDimensionsReady)).toBe(true);
  await expect(card.locator('.advance-vacuum-card__room-marker[data-room-id="far"]')).toHaveCount(0);
  await expect(card.locator('.advance-vacuum-card__room-chip[data-room-id="far"]')).toBeVisible();
  await page.evaluate(() => {
    window.markerHass.states['image.map'] = {
      ...window.markerHass.states['image.map'],
      attributes: {
        ...window.markerHass.states['image.map'].attributes,
        calibration_points: [
          { vacuum: [0, 0], map: [0, 0] },
          { vacuum: [2048, 0], map: [1024, 0] },
          { vacuum: [0, 2048], map: [0, 1024] },
        ],
      },
    };
    window.markerCard.hass = { ...window.markerHass };
  });
  await expect(card.locator('.advance-vacuum-card__room-marker[data-room-id="far"]')).toBeVisible();
  await expect(card.locator('.advance-vacuum-card__room-chip[data-room-id="far"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
