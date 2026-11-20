import { expect, test } from '@playwright/test';

const svg = (width = 2048, height = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#d7dde6"/></svg>`;

const qrevoCalibration = [
  { vacuum: [0, 0], map: [0, 0] },
  { vacuum: [32000, 0], map: [1600, 0] },
  { vacuum: [0, 24000], map: [0, 1200] },
];

function qrevoRooms() {
  const rooms = {};
  for (let index = 0; index < 11; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x0 = 2000 + column * 7500;
    const y0 = 1500 + row * 7000;
    rooms[String(index + 1)] = {
      number: index + 1,
      name: `Room ${index + 1}`,
      x0,
      y0,
      x1: x0 + 5000,
      y1: y0 + 4500,
    };
  }
  return rooms;
}

async function markerInsideMap(marker, map, region) {
  const markerBox = await marker.boundingBox();
  const mapBox = await map.boundingBox();
  expect(markerBox).toBeTruthy();
  expect(mapBox).toBeTruthy();
  const centerX = markerBox.x + markerBox.width / 2;
  const centerY = markerBox.y + markerBox.height / 2;
  expect(centerX).toBeGreaterThan(mapBox.x + 1);
  expect(centerX).toBeLessThan(mapBox.x + mapBox.width - 1);
  expect(centerY).toBeGreaterThan(mapBox.y + 1);
  expect(centerY).toBeLessThan(mapBox.y + mapBox.height - 1);
  if (region) {
    const ratioX = (centerX - mapBox.x) / mapBox.width;
    const ratioY = (centerY - mapBox.y) / mapBox.height;
    expect(ratioX).toBeGreaterThan(region.minX);
    expect(ratioX).toBeLessThan(region.maxX);
    expect(ratioY).toBeGreaterThan(region.minY);
    expect(ratioY).toBeLessThan(region.maxY);
  }
  return { centerX, centerY, mapBox };
}

async function mount(page, {
  room = { id: 'far', label: 'Far room', outline: [[1350, 200], [1850, 200], [1850, 700], [1350, 700]] },
  roomSegments,
  calibrationSource = {},
  includeCalibrationSource = true,
  mapAttributes = {},
  viewport = null,
} = {}) {
  if (viewport) await page.setViewportSize(viewport);
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-advance-vacuum-card'));
  await page.evaluate(({ room, roomSegments, calibrationSource, includeCalibrationSource, mapAttributes }) => {
    const card = document.createElement('nodalia-advance-vacuum-card');
    const config = {
      entity: 'vacuum.one',
      animations: { enabled: false },
      map_source: { camera: 'image.map' },
      room_tracking: { auto_detect: false },
    };
    if (includeCalibrationSource) config.calibration_source = calibrationSource;
    if (roomSegments !== null) config.room_segments = roomSegments || [room];
    card.setConfig(config);
    window.markerHass = window.makeHass({
      'vacuum.one': { state: 'docked', attributes: { friendly_name: 'Vacuum' } },
      'image.map': { state: 'ready', attributes: { entity_picture: '/room-marker-map.svg', ...mapAttributes } },
    });
    card.hass = window.markerHass;
    document.querySelector('#fixture').append(card);
    window.markerCard = card;
  }, { room, roomSegments: roomSegments === undefined ? undefined : roomSegments, calibrationSource, includeCalibrationSource, mapAttributes });
  const card = page.locator('nodalia-advance-vacuum-card');
  await card.locator('[data-mode-id="rooms"]').click();
  return card;
}

test('room markers stay inside the map on an iPhone-sized first load, including a slow image', async ({ page }) => {
  let releaseImage = () => {};
  let heldImage = Promise.resolve();
  await page.route('**/room-marker-map.svg*', async route => {
    await heldImage;
    await route.fulfill({ contentType: 'image/svg+xml', body: svg() });
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    heldImage = new Promise(resolve => { releaseImage = resolve; });
    try {
      const card = await mount(page, { viewport: { width: 390, height: 844 } });
      const mapMarker = card.locator('.advance-vacuum-card__room-marker[data-room-id="far"]');
      const fallback = card.locator('.advance-vacuum-card__room-chip[data-room-id="far"]');
      await expect(mapMarker).toHaveCount(0);
      await expect(fallback).toHaveCount(0);
      releaseImage();
      await expect(mapMarker).toBeVisible();
      await expect(fallback).toHaveCount(0);
      await markerInsideMap(mapMarker, card.locator('.advance-vacuum-card__map-surface'), {
        minX: 0.55, maxX: 0.95, minY: 0.15, maxY: 0.8,
      });
      expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
    } finally {
      releaseImage();
    }
  }
});

test('a non-square map keeps the button inside its room', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({
    contentType: 'image/svg+xml', body: svg(800, 600),
  }));
  const card = await mount(page, {
    room: { id: 'corner', label: 'Study', outline: [[40, 360], [220, 360], [220, 540], [40, 540]] },
  });
  const marker = card.locator('.advance-vacuum-card__room-marker[data-room-id="corner"]');
  await expect(marker).toBeVisible();
  await markerInsideMap(marker, card.locator('.advance-vacuum-card__map-surface'), {
    minX: 0.02, maxX: 0.4, minY: 0.5, maxY: 0.98,
  });
  expect(await page.evaluate(() => window.markerCard._mapImageWidth)).toBe(800);
  expect(await page.evaluate(() => window.markerCard._mapImageHeight)).toBe(600);
});

test('failed images retain selectable room chips, not misplaced map buttons', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({ status: 404 }));
  const card = await mount(page);
  await expect(card.locator('.advance-vacuum-card__room-marker[data-room-id="far"]')).toHaveCount(0);
  const fallback = card.locator('.advance-vacuum-card__room-chip[data-room-id="far"]');
  await expect(fallback).toBeVisible();
  const mapBox = await card.locator('.advance-vacuum-card__map-surface').boundingBox();
  const chipBox = await fallback.boundingBox();
  expect(chipBox.y).toBeGreaterThan(mapBox.y + mapBox.height - 1);
  await fallback.click();
  await expect(fallback).toHaveClass(/is-selected/);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('calibration arriving after map load restores room markers inside the map', async ({ page }) => {
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
  const marker = card.locator('.advance-vacuum-card__room-marker[data-room-id="far"]');
  await expect(marker).toBeVisible();
  await expect(card.locator('.advance-vacuum-card__room-chip[data-room-id="far"]')).toHaveCount(0);
  await markerInsideMap(marker, card.locator('.advance-vacuum-card__map-surface'), {
    minX: 0.6, maxX: 0.95, minY: 0.15, maxY: 0.55,
  });
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('v3.0.7-alpha.1 no longer lists every Qrevo room when map metadata and calibration are already on the image entity', async ({ page }) => {
  let releaseImage = () => {};
  const heldImage = new Promise(resolve => { releaseImage = resolve; });
  await page.route('**/room-marker-map.svg*', async route => {
    await heldImage;
    await route.fulfill({ contentType: 'image/svg+xml', body: svg(400, 300) });
  });
  try {
    const card = await mount(page, {
      viewport: { width: 390, height: 844 },
      includeCalibrationSource: false,
      roomSegments: null,
      mapAttributes: {
        image: { width: 1600, height: 1200 },
        calibration_points: qrevoCalibration,
        rooms: qrevoRooms(),
      },
    });
    const map = card.locator('.advance-vacuum-card__map-surface');
    await expect(card.locator('.advance-vacuum-card__room-chip')).toHaveCount(0);
    await expect(card.locator('.advance-vacuum-card__room-marker')).toHaveCount(11);
    const centers = [];
    for (let index = 1; index <= 11; index += 1) {
      const column = (index - 1) % 4;
      const row = Math.floor((index - 1) / 4);
      const marker = card.locator(`.advance-vacuum-card__room-marker[data-room-id="${index}"]`);
      const placed = await markerInsideMap(marker, map, {
        minX: (2000 + column * 7500) / 32000 - 0.04,
        maxX: (7000 + column * 7500) / 32000 + 0.08,
        minY: (1500 + row * 7000) / 24000 - 0.04,
        maxY: (6000 + row * 7000) / 24000 + 0.1,
      });
      centers.push(placed);
    }
    const sameCorner = centers.every(item => {
      const ratioX = (item.centerX - item.mapBox.x) / item.mapBox.width;
      const ratioY = (item.centerY - item.mapBox.y) / item.mapBox.height;
      return ratioX > 0.85 && ratioY > 0.85;
    });
    expect(sameCorner).toBe(false);
    releaseImage();
    await expect(card.locator('.advance-vacuum-card__room-marker')).toHaveCount(11);
    await expect(card.locator('.advance-vacuum-card__room-chip')).toHaveCount(0);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  } finally {
    releaseImage();
  }
});

test('reported map dimensions that arrive after the bitmap move rooms onto the map', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({
    contentType: 'image/svg+xml', body: svg(400, 300),
  }));
  const card = await mount(page, {
    includeCalibrationSource: false,
    roomSegments: null,
    mapAttributes: { calibration_points: qrevoCalibration, rooms: qrevoRooms() },
  });
  await expect.poll(() => page.evaluate(() => window.markerCard._mapImageDimensionsReady)).toBe(true);
  await expect(card.locator('.advance-vacuum-card__room-chip')).toHaveCount(10);
  await expect(card.locator('.advance-vacuum-card__room-marker')).toHaveCount(1);
  await page.evaluate(() => {
    const attributes = window.markerHass.states['image.map'].attributes;
    attributes.image = { width: 1600, height: 1200 };
    window.markerCard.hass = { ...window.markerHass };
  });
  await expect(card.locator('.advance-vacuum-card__room-chip')).toHaveCount(0);
  await expect(card.locator('.advance-vacuum-card__room-marker')).toHaveCount(11);
  const marker = card.locator('.advance-vacuum-card__room-marker[data-room-id="1"]');
  await expect(marker).toBeVisible();
  await markerInsideMap(marker, card.locator('.advance-vacuum-card__map-surface'), {
    minX: 0.02, maxX: 0.35, minY: 0.02, maxY: 0.4,
  });
});

test('polygons and explicit centers both place a button inside the map', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({
    contentType: 'image/svg+xml', body: svg(1024, 1024),
  }));
  const card = await mount(page, {
    roomSegments: [
      { id: 'left', label: 'Kitchen', outline: [[80, 80], [420, 80], [420, 420], [80, 420]] },
      { id: 'point', label: 'Hall', icon: 'mdi:broom', position: [760, 760] },
    ],
  });
  const kitchen = card.locator('.advance-vacuum-card__room-marker[data-room-id="left"]');
  const hall = card.locator('.advance-vacuum-card__room-marker[data-room-id="point"]');
  await expect(kitchen).toBeVisible();
  await expect(hall).toBeVisible();
  await expect(card.locator('.advance-vacuum-card__room-chip')).toHaveCount(0);
  const map = card.locator('.advance-vacuum-card__map-surface');
  await markerInsideMap(kitchen, map, { minX: 0.05, maxX: 0.48, minY: 0.05, maxY: 0.48 });
  await markerInsideMap(hall, map, { minX: 0.6, maxX: 0.9, minY: 0.6, maxY: 0.9 });
  await kitchen.click();
  await hall.click();
  await expect(kitchen).toHaveClass(/is-selected/);
  await expect(hall).toHaveClass(/is-selected/);
});

test('resize, zoom and pan keep the button in the room region', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({
    contentType: 'image/svg+xml', body: svg(1024, 1024),
  }));
  const card = await mount(page, {
    room: { id: 'mid', label: 'Living', outline: [[180, 180], [420, 180], [420, 420], [180, 420]] },
  });
  const marker = card.locator('.advance-vacuum-card__room-marker[data-room-id="mid"]');
  const map = card.locator('.advance-vacuum-card__map-surface');
  await expect(marker).toBeVisible();
  const initial = await markerInsideMap(marker, map, { minX: 0.12, maxX: 0.5, minY: 0.12, maxY: 0.5 });
  const initialRatio = (initial.centerX - initial.mapBox.x) / initial.mapBox.width;
  await page.evaluate(() => { document.querySelector('#fixture').style.width = '280px'; });
  const narrowed = await markerInsideMap(marker, map, { minX: 0.12, maxX: 0.5, minY: 0.12, maxY: 0.5 });
  expect(Math.abs(((narrowed.centerX - narrowed.mapBox.x) / narrowed.mapBox.width) - initialRatio)).toBeLessThan(0.08);
  await page.evaluate(() => {
    window.markerCard._setMapTransform(1.6, { x: 0, y: 0 });
    window.markerCard._render();
  });
  const zoomed = await markerInsideMap(marker, map);
  expect((zoomed.centerX - zoomed.mapBox.x) / zoomed.mapBox.width).toBeGreaterThan(initialRatio + 0.05);
  await page.evaluate(() => {
    window.markerCard._setMapTransform(1.4, { x: -70, y: -40 });
    window.markerCard._render();
  });
  const panned = await markerInsideMap(marker, map);
  expect(panned.centerX).toBeLessThan(zoomed.centerX);
});

test('a full Home Assistant reload keeps room buttons on the map', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({
    contentType: 'image/svg+xml', body: svg(1024, 1024),
  }));
  const card = await mount(page, {
    room: { id: 'mid', label: 'Living', outline: [[180, 180], [420, 180], [420, 420], [180, 420]] },
  });
  const marker = card.locator('.advance-vacuum-card__room-marker[data-room-id="mid"]');
  await expect(marker).toBeVisible();
  await page.evaluate(() => {
    window.markerCard.hass = { ...window.markerHass, connection: { reloaded: true }, user: { id: 'reloaded', is_admin: true } };
  });
  await card.locator('[data-mode-id="rooms"]').click();
  await expect(marker).toBeVisible();
  await expect(card.locator('.advance-vacuum-card__room-chip')).toHaveCount(0);
  await markerInsideMap(marker, card.locator('.advance-vacuum-card__map-surface'), {
    minX: 0.12, maxX: 0.5, minY: 0.12, maxY: 0.5,
  });
});

test('genuinely invalid coordinates stay in the recovery list', async ({ page }) => {
  await page.route('**/room-marker-map.svg*', route => route.fulfill({
    contentType: 'image/svg+xml', body: svg(1024, 1024),
  }));
  const card = await mount(page, {
    includeCalibrationSource: false,
    room: { id: 'lost', label: 'Lost', outline: [[900000, 900000], [900100, 900000], [900100, 900100], [900000, 900100]] },
  });
  await expect.poll(() => page.evaluate(() => window.markerCard._mapImageDimensionsReady)).toBe(true);
  await expect(card.locator('.advance-vacuum-card__room-marker[data-room-id="lost"]')).toHaveCount(0);
  const fallback = card.locator('.advance-vacuum-card__room-chip[data-room-id="lost"]');
  await expect(fallback).toBeVisible();
  const mapBox = await card.locator('.advance-vacuum-card__map-surface').boundingBox();
  const chipBox = await fallback.boundingBox();
  expect(chipBox.y).toBeGreaterThan(mapBox.y + mapBox.height - 1);
});
