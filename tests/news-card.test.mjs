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
      coerceNewsAttributeList,
      extractRawItemsFromState,
      getNewsSourceHealth,
      mergeNewsItemHistory,
      restoreNewsHistoryItem,
      getNewsHistoryStorageKey,
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
  assert.match(source, /function coerceNewsAttributeList\(/);
  assert.doesNotMatch(source, /innerHTML = .*item\.title/);
});

test("coerceNewsAttributeList accepts native arrays and JSON strings", () => {
  const native = [{ title: "Native" }];
  assert.deepEqual(helpers.coerceNewsAttributeList(native), native);
  const parsed = helpers.coerceNewsAttributeList('[{"title":"Template headline","summary":"From JSON"}]');
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].title, "Template headline");
  assert.equal(parsed[0].summary, "From JSON");
  assert.equal(helpers.coerceNewsAttributeList("not-json").length, 0);
  assert.equal(helpers.coerceNewsAttributeList('{"title":"Object not list"}').length, 1);
  assert.equal(helpers.coerceNewsAttributeList("").length, 0);
});

test("template sensor JSON string attributes render through entity config", () => {
  const templatePayload = JSON.stringify([
    {
      headline: "Template sensor story",
      description: "Rendered from a Home Assistant template attribute.",
      publisher: "Template Feed",
      published_at: "2026-06-12T11:30:00+02:00",
      link: "https://example.com/template-story",
    },
  ]);
  const hass = {
    states: {
      "sensor.news_template": {
        state: "ok",
        attributes: {
          items: templatePayload,
        },
      },
    },
  };
  const items = helpers.getNewsItemsForConfig(hass, {
    entity: "sensor.news_template",
    max_items: 5,
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Template sensor story");
  assert.equal(items[0].source, "Template Feed");
  assert.equal(items[0].url, "https://example.com/template-story");
});

test("invalid JSON string attribute falls back to next news attribute key", () => {
  const hass = {
    states: {
      "sensor.news_template": {
        state: "ok",
        attributes: {
          items: "{ broken json",
          articles: JSON.stringify([{ title: "Fallback article", source: "Articles attr" }]),
        },
      },
    },
  };
  const items = helpers.getNewsItemsForConfig(hass, {
    entity: "sensor.news_template",
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Fallback article");
});

test("extractRawItemsFromState supports headlines JSON from template sensors", () => {
  const state = {
    attributes: {
      headlines: JSON.stringify([
        { name: "Headline via name key", source: "Evening edition" },
      ]),
    },
  };
  const raw = helpers.extractRawItemsFromState(state);
  assert.equal(raw.length, 1);
  assert.equal(raw[0].name, "Headline via name key");
});

const nodaliaNewsFixture = [
  {
    title: "Home Assistant estrena un nuevo sistema de dashboards para hogares conectados",
    summary: "La plataforma sigue reforzando su enfoque como centro visual y operativo para viviendas inteligentes.",
    source: "Nodalia Daily",
    published: "2026-06-12T02:20:00.202282+02:00",
    url: "https://www.home-assistant.io/blog/",
    image: "https://www.home-assistant.io/images/blog/2024-06/dashboard-chapter-1/social.png",
    category: "Domótica",
  },
  {
    title: "La energía inteligente gana protagonismo en los hogares europeos",
    summary: "Los sistemas de monitorización y automatización permiten ajustar consumos, climatización y hábitos familiares.",
    source: "Energy Brief",
    published: "2026-06-12T00:20:00.202349+02:00",
    url: "https://www.home-assistant.io/integrations/energy/",
    image: "https://www.home-assistant.io/images/blog/2021-08-energy/social.png",
    category: "Energía",
  },
];

test("native items array from sensor renders even when hass.connected is false", () => {
  const hass = {
    connected: false,
    states: {
      "sensor.nodalia_news_test": {
        state: "2026-06-12",
        attributes: {
          friendly_name: "Nodalia News Test",
          items: nodaliaNewsFixture,
        },
      },
    },
  };
  const health = helpers.getNewsSourceHealth(hass, { entity: "sensor.nodalia_news_test" });
  assert.equal(health.loading, false);
  assert.equal(health.unavailable, false);
  const items = helpers.getNewsItemsForConfig(hass, {
    entity: "sensor.nodalia_news_test",
    max_items: 5,
  });
  assert.equal(items.length, 2);
  assert.match(items[0].title, /Home Assistant estrena/);
});

test("unknown entity state with items is not treated as unavailable", () => {
  const hass = {
    connected: false,
    states: {
      "sensor.nodalia_news_test": {
        state: "unknown",
        attributes: { items: nodaliaNewsFixture },
      },
    },
  };
  const health = helpers.getNewsSourceHealth(hass, { entity: "sensor.nodalia_news_test" });
  assert.equal(health.loading, false);
  assert.equal(health.unavailable, false);
});

test("magazine layout uses swipe carousel markup in source", () => {
  const source = read("nodalia-news-card.js");
  assert.match(source, /data-news-carousel/);
  assert.match(source, /news-card__carousel-track/);
  assert.match(source, /_navigateMagazine\(/);
  assert.match(source, /MAGAZINE_SWIPE_THRESHOLD_PX/);
});

test("mergeNewsItemHistory accumulates unique articles up to max_items", () => {
  const source = { entity: "sensor.nodalia_news_real", name: "Feed" };
  const first = helpers.normalizeNewsItem({
    title: "First",
    published: "2026-06-12T10:00:00Z",
    url: "https://example.com/first",
  }, source);
  const second = helpers.normalizeNewsItem({
    title: "Second",
    published: "2026-06-11T10:00:00Z",
    url: "https://example.com/second",
  }, source);
  const third = helpers.normalizeNewsItem({
    title: "Third",
    published: "2026-06-10T10:00:00Z",
    url: "https://example.com/third",
  }, source);
  const merged = helpers.mergeNewsItemHistory([first], [second], 3);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, "First");
  const capped = helpers.mergeNewsItemHistory(merged, [third], 2);
  assert.equal(capped.length, 2);
  assert.equal(capped[0].title, "First");
  assert.equal(capped[1].title, "Second");
});

test("mergeNewsItemHistory dedupes repeated sensor payloads", () => {
  const item = helpers.normalizeNewsItem({
    title: "Same story",
    url: "https://example.com/same",
    published: "2026-06-12T08:00:00Z",
  }, { entity: "sensor.news" });
  const merged = helpers.mergeNewsItemHistory([item], [item], 8);
  assert.equal(merged.length, 1);
});

test("getNewsHistoryStorageKey scopes storage per entity", () => {
  const left = helpers.getNewsHistoryStorageKey({ entity: "sensor.a" });
  const right = helpers.getNewsHistoryStorageKey({ entity: "sensor.b" });
  assert.notEqual(left, right);
  assert.match(left, /sensor\.a/);
});
