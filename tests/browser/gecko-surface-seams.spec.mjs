import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const surfaceSnapshotDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "gecko-surface-seams.spec.mjs-snapshots",
);

function surfaceSnapshotPath(projectName) {
  // Playwright default: {arg}-{projectName}-{platform}.png
  return path.join(
    surfaceSnapshotDir,
    `card-surfaces-${projectName}-${projectName}-${process.platform}.png`,
  );
}

async function loadBundle(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.stack || String(error)));
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForTimeout(500);
  const loaded = await page.evaluate(() => Boolean(customElements.get("nodalia-entity-card")));
  if (!loaded) {
    throw new Error(`Bundle did not register cards: ${errors.join(" | ") || "no page error captured"}`);
  }
  return errors;
}

function isInactivePseudoContent(content) {
  // `content: ""` is an active empty pseudo (computed as '""'). Only none/normal mean unused.
  return !content || content === "none" || content === "normal";
}

async function mountSurfaceFixture(page) {
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary-text-color", "#f4f6fb");
    root.style.setProperty("--secondary-text-color", "#a9b1c3");
    root.style.setProperty("--primary-color", "#71c0ff");
    root.style.setProperty("--divider-color", "rgba(255, 255, 255, 0.12)");
    root.style.setProperty("--ha-card-background", "#1f2430");
    root.style.setProperty("--card-background-color", "#1f2430");
    root.style.setProperty("--ha-card-box-shadow", "0 10px 28px rgba(0, 0, 0, 0.28)");
    root.style.setProperty("--primary-background-color", "#111318");
    root.style.setProperty("--nodalia-surface-soft", "rgba(28, 32, 42, 0.82)");
    root.style.setProperty("--nodalia-user-bar-bg", "rgba(28, 32, 42, 0.82)");
    root.style.setProperty("--nodalia-card-border-radius", "28px");

    const fixture = document.querySelector("#fixture");
    fixture.replaceChildren();
    fixture.style.maxWidth = "920px";
    fixture.style.gridTemplateColumns = "minmax(0, 1fr) 180px";
    fixture.style.alignItems = "start";

    const states = {
      "weather.test": {
        entity_id: "weather.test",
        state: "sunny",
        attributes: {
          friendly_name: "Weather",
          temperature: 16.8,
          temperature_unit: "°C",
          humidity: 81,
          wind_speed: 18.6,
          wind_speed_unit: "km/h",
          attribution: "Test",
          forecast: [
            { datetime: "2026-08-06T04:00:00", condition: "clear-night", temperature: 16.8, precipitation_probability: 0 },
            { datetime: "2026-08-06T05:00:00", condition: "clear-night", temperature: 16.4, precipitation_probability: 0 },
            { datetime: "2026-08-06T06:00:00", condition: "sunny", temperature: 17.1, precipitation_probability: 0 },
          ],
        },
      },
      "calendar.test": {
        entity_id: "calendar.test",
        state: "off",
        attributes: { friendly_name: "Calendar" },
      },
      "switch.salon": {
        entity_id: "switch.salon",
        state: "on",
        attributes: { friendly_name: "Salón" },
      },
      "switch.comedor": {
        entity_id: "switch.comedor",
        state: "off",
        attributes: { friendly_name: "Comedor" },
      },
      "light.apple": {
        entity_id: "light.apple",
        state: "on",
        attributes: { friendly_name: "Apple TV light", icon: "mdi:apple" },
      },
      "vacuum.roborock": {
        entity_id: "vacuum.roborock",
        state: "docked",
        attributes: { friendly_name: "Roborock" },
      },
    };
    const hass = window.makeHass(states);

    const weather = document.createElement("nodalia-weather-card");
    weather.dataset.surfaceId = "weather";
    weather.setConfig({
      entity: "weather.test",
      name: "Tiempo",
      show_forecast: true,
      forecast_type: "hourly",
      animations: { enabled: false },
    });
    weather.hass = hass;

    const calendar = document.createElement("nodalia-calendar-card");
    calendar.dataset.surfaceId = "calendar";
    calendar.setConfig({
      calendars: [{ entity: "calendar.test" }],
      name: "Calendario",
      animations: { enabled: false },
    });
    calendar.hass = hass;

    const nav = document.createElement("nodalia-navigation-bar");
    nav.dataset.surfaceId = "navigation";
    nav.setConfig({
      routes: [
        { path: "/lovelace/home", icon: "mdi:home", label: "Home" },
        { path: "/lovelace/rooms", icon: "mdi:sofa", label: "Rooms" },
        { path: "/lovelace/settings", icon: "mdi:cog", label: "Settings" },
      ],
      layout: { position: "bottom", full_width: false, fixed: false, show_desktop: true },
      animations: { enabled: false },
    });
    nav.hass = hass;

    const entityActive = document.createElement("nodalia-entity-card");
    entityActive.dataset.surfaceId = "entity-active";
    entityActive.setConfig({ entity: "switch.salon", name: "Salón", animations: { enabled: false } });
    entityActive.hass = hass;

    const entityIdle = document.createElement("nodalia-entity-card");
    entityIdle.dataset.surfaceId = "entity-idle";
    entityIdle.setConfig({ entity: "switch.comedor", name: "Comedor", animations: { enabled: false } });
    entityIdle.hass = hass;

    const entityAccent = document.createElement("nodalia-entity-card");
    entityAccent.dataset.surfaceId = "entity-accent";
    entityAccent.setConfig({ entity: "light.apple", name: "Apple", animations: { enabled: false } });
    entityAccent.hass = hass;

    const entityVacuum = document.createElement("nodalia-entity-card");
    entityVacuum.dataset.surfaceId = "entity-vacuum";
    entityVacuum.setConfig({ entity: "vacuum.roborock", name: "Roborock", animations: { enabled: false } });
    entityVacuum.hass = hass;

    const main = document.createElement("div");
    main.style.display = "grid";
    main.style.gap = "16px";
    main.append(weather, calendar, nav);

    const side = document.createElement("div");
    side.style.display = "grid";
    side.style.gap = "12px";
    side.append(entityActive, entityIdle, entityAccent, entityVacuum);

    fixture.append(main, side);
  });
  await page.waitForTimeout(400);
}

async function readCardSurface(page, surfaceId) {
  return page.evaluate(id => {
    const host = document.querySelector(`[data-surface-id="${id}"]`);
    const root = host?.shadowRoot;
    const card = root?.querySelector("ha-card");
    if (!card) {
      return null;
    }
    const style = getComputedStyle(card);
    const before = getComputedStyle(card, "::before");
    const after = getComputedStyle(card, "::after");
    const styleText = root.querySelector("style")?.textContent || "";
    const haCardBlock = styleText.match(/ha-card(?:\.navbar-card)?\s*\{[\s\S]*?\n\s*\}/)?.[0] || "";
    return {
      tag: card.tagName.toLowerCase(),
      className: String(card.className || ""),
      borderRadius: style.borderRadius,
      overflow: style.overflow,
      isolation: style.isolation,
      backgroundImage: style.backgroundImage,
      beforeContent: before.content,
      afterContent: after.content,
      beforeBorderRadius: before.borderRadius,
      haCardBlock,
      hasAbsoluteBeforeRule: /ha-card(?:\.navbar-card)?::before\s*\{[\s\S]*?position:\s*absolute/.test(styleText),
      hasAbsoluteAfterRule: /ha-card(?:\.navbar-card)?::after\s*\{[\s\S]*?position:\s*absolute/.test(styleText),
    };
  }, surfaceId);
}

test.describe("Gecko-safe card surfaces", () => {
  test("Weather, Calendar, Navigation and Entity variants share one surface paint", async ({ page }, testInfo) => {
    const errors = await loadBundle(page);
    await mountSurfaceFixture(page);

    const weather = await readCardSurface(page, "weather");
    const calendar = await readCardSurface(page, "calendar");
    const nav = await readCardSurface(page, "navigation");
    const entityActive = await readCardSurface(page, "entity-active");
    const entityIdle = await readCardSurface(page, "entity-idle");
    const entityAccent = await readCardSurface(page, "entity-accent");
    const entityVacuum = await readCardSurface(page, "entity-vacuum");

    for (const [id, surface] of Object.entries({
      weather,
      calendar,
      navigation: nav,
      "entity-active": entityActive,
      "entity-idle": entityIdle,
      "entity-accent": entityAccent,
      "entity-vacuum": entityVacuum,
    })) {
      expect(surface, `${id} should render ha-card`).not.toBeNull();
      expect(surface.isolation, id).not.toBe("isolate");
      const hasBackgroundGradient = /gradient/i.test(surface.backgroundImage || "");
      const hasOverlayWash = !isInactivePseudoContent(surface.beforeContent);
      expect(hasBackgroundGradient || hasOverlayWash, `${id} needs a surface wash`).toBe(true);
      expect(surface.haCardBlock, id).not.toMatch(/isolation:\s*isolate/);
      expect(surface.beforeBorderRadius || "", id).not.toMatch(/inherit|28px|999px/);
    }

    expect(isInactivePseudoContent(weather.beforeContent)).toBe(true);
    expect(isInactivePseudoContent(nav.beforeContent)).toBe(true);
    expect(isInactivePseudoContent(calendar.beforeContent)).toBe(false);
    expect(isInactivePseudoContent(entityActive.beforeContent)).toBe(false);
    expect(calendar.hasAbsoluteBeforeRule).toBe(true);
    expect(entityActive.hasAbsoluteBeforeRule).toBe(true);
    expect(calendar.haCardBlock).toMatch(/--nodalia-calendar-surface-base/);
    expect(entityActive.haCardBlock).toMatch(/--nodalia-entity-surface-base/);

    // Visual baselines for Chromium/WebKit. Firefox still exercises the same
    // computed-style contracts above; PNG generation needs a mapped framebuffer.
    // Skip screenshots when the OS baseline is missing (CI is Linux; local may be Darwin).
    if (testInfo.project.name !== "firefox" && fs.existsSync(surfaceSnapshotPath(testInfo.project.name))) {
      await expect(page.locator("#fixture")).toHaveScreenshot(`card-surfaces-${testInfo.project.name}.png`, {
        animations: "disabled",
        caret: "hide",
        maxDiffPixelRatio: 0.03,
      });
    }
    expect(errors).toEqual([]);
  });

  test("surface geometry stays aligned at fractional viewport sizes", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "webkit-iphone", "Mobile project already covers a different DPR.");
    await page.setViewportSize({ width: 1107, height: 1403 });
    const errors = await loadBundle(page);
    await mountSurfaceFixture(page);

    const surfaces = await page.evaluate(() => {
      return [...document.querySelectorAll("[data-surface-id]")].map(host => {
        const card = host.shadowRoot?.querySelector("ha-card");
        if (!card) {
          return null;
        }
        const rect = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        const before = getComputedStyle(card, "::before");
        return {
          id: host.dataset.surfaceId,
          width: rect.width,
          height: rect.height,
          radius: style.borderRadius,
          beforeContent: before.content,
          backgroundImage: style.backgroundImage,
          isolation: style.isolation,
        };
      }).filter(Boolean);
    });

    expect(surfaces.length).toBeGreaterThanOrEqual(6);
    for (const surface of surfaces) {
      expect(surface.width, surface.id).toBeGreaterThan(40);
      expect(surface.height, surface.id).toBeGreaterThan(16);
      expect(surface.isolation, surface.id).not.toBe("isolate");
      const hasBackgroundGradient = /gradient/i.test(surface.backgroundImage || "");
      const hasOverlayWash = !isInactivePseudoContent(surface.beforeContent);
      expect(hasBackgroundGradient || hasOverlayWash, `${surface.id} needs a surface wash`).toBe(true);
    }
    expect(errors).toEqual([]);
  });
});
