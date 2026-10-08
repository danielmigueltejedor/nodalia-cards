import { expect, test } from "@playwright/test";

test("News magazine tap opens that article and a swipe does not", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-news-card"));
  await page.evaluate(() => {
    window.openedArticles = [];
    window.open = (url) => {
      window.openedArticles.push(String(url));
      return null;
    };
    const card = document.createElement("nodalia-news-card");
    card.setConfig({
      entity: "sensor.news",
      remember_items: false,
      max_items: 8,
      title: "Últimas noticias",
    });
    card.hass = window.makeHass({
      "sensor.news": {
        state: "ready",
        attributes: {
          items: [
            { title: "Alpha", summary: "First", published: "2026-10-08T00:00:00Z", url: "https://example.com/alpha" },
            { title: "Beta", summary: "Second", published: "2026-10-07T00:00:00Z", url: "https://example.com/beta" },
            { title: "No link", summary: "Missing", published: "2026-10-06T00:00:00Z" },
          ],
        },
      },
    });
    document.querySelector("#fixture").append(card);
    window.newsArticleCard = card;
  });

  const card = page.locator("nodalia-news-card");
  const readMore = card.locator(".news-card__carousel-slide.is-active .news-card__read-more");
  await expect(readMore).toHaveText("Read more");
  await readMore.click();
  await expect.poll(() => page.evaluate(() => window.openedArticles)).toEqual(["https://example.com/alpha"]);

  const viewport = card.locator(".news-card__carousel-viewport");
  const box = await viewport.boundingBox();
  if (!box) throw new Error("magazine viewport has no box");
  await page.mouse.move(box.x + box.width - 24, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 24, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(card.locator(".news-card__carousel-slide.is-active")).toContainText("Beta");
  await expect.poll(() => page.evaluate(() => window.openedArticles)).toEqual(["https://example.com/alpha"]);

  await page.waitForFunction(() => window.newsArticleCard._suppressArticleTap === false);
  await card.locator(".news-card__carousel-slide.is-active .news-card__headline").click();
  await expect.poll(() => page.evaluate(() => window.openedArticles)).toEqual([
    "https://example.com/alpha",
    "https://example.com/beta",
  ]);

  await card.locator('[data-news-action="next"]').click();
  await expect(card.locator(".news-card__carousel-slide.is-active")).toContainText("No link");
  await expect(card.locator(".news-card__carousel-slide.is-active .news-card__read-more")).toHaveCount(0);
  await card.locator(".news-card__carousel-slide.is-active .news-card__headline").click();
  await expect.poll(() => page.evaluate(() => window.openedArticles)).toEqual([
    "https://example.com/alpha",
    "https://example.com/beta",
  ]);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
