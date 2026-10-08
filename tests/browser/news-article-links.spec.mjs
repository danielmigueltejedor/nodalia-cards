import { expect, test } from '@playwright/test';

// Issue #325: "Read more" and the article surface must open that item's own URL with
// mouse, touch and keyboard. The magazine carousel used to capture the pointer on
// pointerdown, which retargeted a plain mouse click to the carousel viewport.
const item = (index, url = `https://news.example/article-${index}.html`) => ({
  title: `Headline ${index}`, summary: index % 2 ? `Summary ${index}` : '', source: 'Source',
  published: '2026-10-08T08:36:13+02:00', published_ts: 1791441373 - index * 100,
  received_at: '2026-10-08T10:29:20+02:00', received_ts: 1791448160 - index,
  url, feed_url: 'https://news.example/feed', image: index === 2 ? '' : `https://news.example/img-${index}.jpg`, category: 'General',
});

async function mountNews(page, { layout, items = [0, 1, 2, 3].map(index => item(index)) } = {}) {
  await page.route('https://news.example/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' }));
  await page.goto('/tests/fixtures/browser.html');
  await page.waitForFunction(() => customElements.get('nodalia-news-card'));
  await page.evaluate(({ layout, items }) => {
    window.openedUrls = [];
    window.open = (url, target, features) => { window.openedUrls.push([url, target, features]); return null; };
    const card = document.createElement('nodalia-news-card');
    // Reporter configuration; the default layout is the magazine carousel.
    card.setConfig({ title: 'Últimas noticias', entity: 'sensor.nodalia_news_real', max_items: 8, remember_items: false, grid_options: { columns: 12, rows: 'auto' }, ...(layout ? { layout: { mode: layout } } : {}) });
    card.hass = window.makeHass({ 'sensor.nodalia_news_real': { state: String(items.length), attributes: { items, total_items: items.length } } });
    document.querySelector('#fixture').append(card);
  }, { layout, items });
  const card = page.locator('nodalia-news-card');
  await expect(card.locator('.news-card__article').first()).toBeVisible();
  return card;
}

const opened = page => page.evaluate(() => window.openedUrls.map(([url]) => url));

async function press(page, locator, isMobile) {
  let box = null;
  await expect.poll(async () => (box = await locator.boundingBox()) !== null).toBe(true);
  const x = box.x + Math.min(box.width / 2, 24), y = box.y + box.height / 2;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

for (const layout of [undefined, 'list', 'compact']) {
  test(`News ${layout || 'magazine (default)'}: Read more and the article open that item's URL once`, async ({ page, isMobile }) => {
    const card = await mountNews(page, { layout });
    const visible = card.locator('.news-card__article[data-news-action="open"]:visible').first();
    const url = await visible.getAttribute('data-news-url');
    await press(page, visible.locator('.news-card__read-more'), isMobile);
    await expect.poll(() => opened(page)).toEqual([url]);
    await press(page, visible.locator('.news-card__headline'), isMobile);
    await expect.poll(() => opened(page)).toEqual([url, url]);
    await visible.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => opened(page)).toEqual([url, url, url]);
    // Opened safely in a new tab without leaking the dashboard window.
    expect(await page.evaluate(() => window.openedUrls[0].slice(1))).toEqual(['_blank', 'noopener,noreferrer']);
    expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
  });
}

test('News magazine: each slide opens its own URL and a horizontal swipe navigates without opening', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Drag is driven with mouse pointer events.');
  const card = await mountNews(page);
  await card.locator('[data-news-action="next"]').click();
  const second = card.locator('.news-card__article[data-news-url="https://news.example/article-1.html"]');
  await expect(second).toBeInViewport();
  await press(page, second.locator('.news-card__read-more'), false);
  await expect.poll(() => opened(page)).toEqual(['https://news.example/article-1.html']);

  // Drag back to the first article; the release must not open the article under the pointer.
  const box = await second.boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3 + 160, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(card.locator('.news-card__article[data-news-url="https://news.example/article-0.html"]')).toBeInViewport();
  await page.waitForTimeout(400);
  expect(await opened(page)).toEqual(['https://news.example/article-1.html']);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test('News items without a usable URL are not interactive and never navigate', async ({ page, isMobile }) => {
  const card = await mountNews(page, { layout: 'list', items: [item(0, ''), item(1, 'javascript:alert(1)'), item(2)] });
  await expect(card.locator('.news-card__article[data-news-action="open"]')).toHaveCount(1);
  await expect(card.locator('.news-card__read-more')).toHaveCount(1);
  for (const title of ['Headline 0', 'Headline 1']) await press(page, card.locator('.news-card__headline', { hasText: title }), isMobile);
  await page.waitForTimeout(300);
  expect(await opened(page)).toEqual([]);
  await press(page, card.locator('.news-card__read-more'), isMobile);
  await expect.poll(() => opened(page)).toEqual(['https://news.example/article-2.html']);
});
