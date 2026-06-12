import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadNewsHelpers() {
  const source = read("nodalia-news-card.js");
  const helperSource = `${source.split("class NodaliaNewsCard")[0]}
    globalThis.__newsHelpers = {
      normalizeNewsItem,
      normalizeConfig,
      resolveSourceEntries,
      collectNormalizedItems,
      applyNewsFilters,
      getNewsItemsForConfig,
      isSafeHttpUrl,
      parsePublishedMs,
      parseHideOlderThanMs,
      buildNewsRenderStamp,
    };
  `;
  const sandbox = {
    URL,
    window: null,
    customElements: { define() {}, get() {} },
    HTMLElement: class {},
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read("nodalia-utils.js"), sandbox);
  vm.runInContext(helperSource, sandbox);
  return sandbox.__newsHelpers;
}

const helpers = loadNewsHelpers();

const sampleHass = {
  states: {
    "sensor.news_general": {
      state: "ok",
      attributes: {
        items: [
          {
            headline: "Alpha headline",
            description: "Alpha summary",
            publisher: "General Feed",
            published_at: "2026-06-12T10:00:00+02:00",
            link: "https://example.com/alpha",
            image_url: "https://example.com/alpha.jpg",
            section: "Tech",
          },
        ],
      },
    },
    "sensor.news_extra": {
      state: "ok",
      attributes: {
        articles: [
          {
            title: "Beta headline",
            summary: "Beta summary",
            source: "Extra Feed",
            date: "2026-06-11T08:00:00+02:00",
            url: "javascript:alert(1)",
          },
        ],
      },
    },
  },
};

test("news card registers custom element and bundle entry", () => {
  const source = read("nodalia-news-card.js");
  assert.match(source, /customElements\.define\(CARD_TAG, NodaliaNewsCard\)/);
  assert.match(source, /registerCustomCard\(\{[\s\S]*type: CARD_TAG/);
  assert.match(read("scripts/build-bundle.mjs"), /nodalia-news-card\.js/);
});

test("simple entity config resolves items", () => {
  const items = helpers.getNewsItemsForConfig(sampleHass, {
    entity: "sensor.news_general",
    max_items: 5,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Alpha headline");
  assert.equal(items[0].source, "General Feed");
});

test("multiple sources merge and sort by published date", () => {
  const items = helpers.getNewsItemsForConfig(sampleHass, {
    sources: [
      { entity: "sensor.news_general", name: "General" },
      { entity: "sensor.news_extra", name: "Extra" },
    ],
    max_items: 5,
  });
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Alpha headline");
  assert.equal(items[1].title, "Beta headline");
});

test("item normalization supports alternative keys and blocks unsafe urls", () => {
  const item = helpers.normalizeNewsItem(
    {
      headline: "Story",
      excerpt: "Body",
      author: "Writer",
      datetime: "2026-06-12T09:00:00Z",
      link: "javascript:alert(1)",
      thumbnail: "https://example.com/p.jpg",
    },
    { entity: "sensor.test", name: "Test" },
  );
  assert.equal(item.title, "Story");
  assert.equal(item.summary, "Body");
  assert.equal(item.source, "Writer");
  assert.equal(item.url, "");
  assert.equal(item.hasUrl, false);
  assert.equal(item.image, "https://example.com/p.jpg");
});

test("filters apply max_items, max_per_source, keywords, and age safely", () => {
  const now = Date.parse("2026-06-12T12:00:00Z");
  const items = helpers.getNewsItemsForConfig(sampleHass, {
    sources: [
      { entity: "sensor.news_general", name: "General" },
      { entity: "sensor.news_extra", name: "Extra" },
    ],
    max_items: 1,
    filters: {
      hide_older_than: "48h",
      max_per_source: 1,
      include_keywords: ["alpha"],
      exclude_keywords: ["blocked"],
    },
  }, now);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Alpha headline");

  const invalidDateItems = helpers.applyNewsFilters([
    helpers.normalizeNewsItem({ title: "No date", summary: "alpha" }, { entity: "a" }),
    helpers.normalizeNewsItem({
      title: "Old",
      summary: "alpha",
      published: "not-a-date",
    }, { entity: "a" }),
  ], {
    filters: { hide_older_than: "24h" },
  }, now);
  assert.equal(invalidDateItems.length, 2);
});

test("isSafeHttpUrl blocks javascript urls", () => {
  assert.equal(helpers.isSafeHttpUrl("https://example.com"), true);
  assert.equal(helpers.isSafeHttpUrl("http://example.com/path"), true);
  assert.equal(helpers.isSafeHttpUrl("javascript:alert(1)"), false);
  assert.equal(helpers.isSafeHttpUrl(""), false);
});

test("normalizeConfig does not mutate the original config object", () => {
  const original = {
    entity: "sensor.news",
    layout: { mode: "list", show_images: false },
    filters: { include_keywords: ["home"] },
  };
  const clone = structuredClone(original);
  helpers.normalizeConfig(original);
  assert.deepEqual(original, clone);
});

test("render signature stamp changes when item title changes", () => {
  const left = helpers.buildNewsRenderStamp([
    helpers.normalizeNewsItem({ title: "One" }, { entity: "a" }),
  ]);
  const right = helpers.buildNewsRenderStamp([
    helpers.normalizeNewsItem({ title: "Two" }, { entity: "a" }),
  ]);
  assert.notEqual(left, right);
});

test("news card uses safe window.open hardening in source", () => {
  const source = read("nodalia-news-card.js");
  assert.match(source, /window\.open\([^)]*"noopener,noreferrer"\)/);
  assert.match(source, /function isSafeHttpUrl\(/);
  assert.doesNotMatch(source, /innerHTML = .*item\.title/);
});
