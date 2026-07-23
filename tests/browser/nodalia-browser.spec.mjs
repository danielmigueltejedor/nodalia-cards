import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function loadBundle(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.stack || String(error)));
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForTimeout(500);
  const loaded = await page.evaluate(() => Boolean(customElements.get("nodalia-entity-card")));
  if (!loaded) {
    const compileError = await page.evaluate(async () => {
      const source = await fetch("/nodalia-cards.js").then(response => response.text());
      try { new Function(source); return ""; } catch (error) { return error.stack || String(error); }
    });
    const browserErrors = await page.evaluate(() => window.bundleErrors || []);
    throw new Error(`Bundle did not register cards: ${[...errors, ...browserErrors, compileError].filter(Boolean).join(" | ") || "no page error captured"}`);
  }
  return errors;
}

test("editor infrastructure is lazy and every visual editor can be created", async ({ page }) => {
  const errors = await loadBundle(page);
  expect(await page.evaluate(() => Boolean(window.NodaliaEditorUI))).toBe(false);

  const result = await page.evaluate(async () => {
    const states = {
      "sensor.test": { entity_id: "sensor.test", state: "21", attributes: { friendly_name: "Test", unit_of_measurement: "°C" } },
      "person.test": { entity_id: "person.test", state: "home", attributes: { friendly_name: "Person" } },
      "camera.test": { entity_id: "camera.test", state: "idle", attributes: { friendly_name: "Camera", entity_picture: "/local/camera.jpg" } },
      "weather.test": { entity_id: "weather.test", state: "sunny", attributes: { friendly_name: "Weather", temperature: 21, temperature_unit: "°C" } },
      "light.test": { entity_id: "light.test", state: "off", attributes: { friendly_name: "Light" } },
      "media_player.test": { entity_id: "media_player.test", state: "idle", attributes: { friendly_name: "Media" } },
    };
    const hass = window.makeHass(states);
    const tags = [...new Set([
      ...(window.customCards || []).map(item => item.type),
      "nodalia-insignia-card",
    ])].filter(Boolean);
    const created = [];
    const stalled = [];
    for (const tag of tags) {
      const ctor = customElements.get(tag);
      if (!ctor?.getConfigElement) continue;
      const editor = await Promise.race([
        ctor.getConfigElement(),
        new Promise(resolve => window.setTimeout(() => resolve(null), 2_000)),
      ]);
      if (!editor) {
        stalled.push(tag);
        continue;
      }
      editor.hass = hass;
      const stub = typeof ctor.getStubConfig === "function" ? await ctor.getStubConfig(hass) : {};
      editor.setConfig?.({ type: `custom:${tag}`, ...(stub || {}) });
      document.querySelector("#fixture").append(editor);
      created.push({ tag, editor: editor.tagName.toLowerCase(), shadow: Boolean(editor.shadowRoot) });
      editor.remove();
    }
    return { created, stalled, editorLoaded: Boolean(window.NodaliaEditorUI) };
  });

  expect(result.editorLoaded).toBe(true);
  expect(result.created.length).toBeGreaterThanOrEqual(24);
  expect(result.stalled).toEqual([]);
  expect(result.created.every(item => item.shadow)).toBe(true);
  expect(errors).toEqual([]);
});

test("Notifications keeps a new external-alert draft in the visual editor", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(async () => {
    const ctor = customElements.get("nodalia-notifications-card");
    const editor = await ctor.getConfigElement();
    editor.hass = window.makeHass({});
    editor.setConfig({ type: "custom:nodalia-notifications-card" });
    document.querySelector("#fixture").append(editor);
  });
  const editor = page.locator("nodalia-notifications-card-editor");
  await editor.locator('[data-editor-action="add-external-alert"]').click();
  await expect(editor.locator('[data-editor-action="remove-external-alert"]')).toHaveCount(1);
});

test("Room Summary fires hold_action and suppresses the following tap", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const card = document.createElement("nodalia-room-summary-card");
    card.setConfig({
      type: "custom:nodalia-room-summary-card",
      name: "Office",
      temperature: "sensor.test",
      tap_action: { action: "navigate", navigation_path: "/tap" },
      hold_action: { action: "navigate", navigation_path: "/hold" },
    });
    card.hass = window.makeHass({
      "sensor.test": { entity_id: "sensor.test", state: "21", attributes: { unit_of_measurement: "°C" } },
    });
    window.roomActions = [];
    card.addEventListener("hass-navigate", event => window.roomActions.push(event.detail.path));
    document.querySelector("#fixture").append(card);
  });
  const primary = page.locator("nodalia-room-summary-card").locator(".room-hub__room-icon");
  await primary.dispatchEvent("pointerdown", { pointerId: 7, pointerType: "touch", button: 0, clientX: 10, clientY: 10 });
  await page.waitForTimeout(560);
  await primary.dispatchEvent("pointerup", { pointerId: 7, pointerType: "touch", button: 0, clientX: 10, clientY: 10 });
  await primary.click();
  await expect.poll(() => page.evaluate(() => window.roomActions)).toEqual(["/hold"]);
});

test("primary surfaces activate by keyboard and dialogs restore focus", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const person = document.createElement("nodalia-person-card");
    person.setConfig({ entity: "person.test", tap_action: "more-info" });
    person.hass = window.makeHass({
      "person.test": { entity_id: "person.test", state: "home", attributes: { friendly_name: "Ada" } },
    });
    window.personActions = 0;
    person.addEventListener("hass-more-info", () => { window.personActions += 1; });
    document.querySelector("#fixture").append(person);

    const camera = document.createElement("nodalia-camera-card");
    camera.setConfig({ entity: "camera.test", tap_action: "toggle" });
    camera.hass = window.makeHass({
      "camera.test": { entity_id: "camera.test", state: "idle", attributes: { friendly_name: "Door" } },
    });
    document.querySelector("#fixture").append(camera);
  });

  const personAction = page.locator("nodalia-person-card").locator('[data-person-action="primary"]');
  await personAction.focus();
  await personAction.press("Enter");
  await expect.poll(() => page.evaluate(() => window.personActions)).toBe(1);

  const cameraAction = page.locator("nodalia-camera-card").locator('[data-camera-action="expand"]').first();
  await cameraAction.focus();
  await cameraAction.click();
  const close = page.locator("nodalia-camera-card").locator(".camera-card__expanded-close");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("nodalia-camera-card").locator('.camera-card__expanded[role="dialog"]')).toHaveCount(0);
  await expect(cameraAction).toBeFocused();
});

test("Entity select bubble remains visible after its bounce animation", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const card = document.createElement("nodalia-entity-card");
    card.setConfig({
      entity: "select.mode",
      tap_action: "more-info",
      animations: { enabled: true, content_duration: 180, button_bounce_duration: 180 },
    });
    card.hass = window.makeHass({
      "select.mode": {
        entity_id: "select.mode",
        state: "Auto",
        attributes: { friendly_name: "Mode", options: ["Auto", "Eco"] },
      },
    });
    document.querySelector("#fixture").append(card);
  });
  const bubble = page.locator("nodalia-entity-card").locator(".entity-card__icon");
  await expect(bubble).toBeVisible();
  await page.waitForTimeout(260);
  await bubble.click();
  await page.waitForTimeout(260);
  await expect(bubble).toBeVisible();
  const visual = await bubble.evaluate(element => ({
    opacity: getComputedStyle(element).opacity,
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    pressing: element.classList.contains("is-pressing"),
  }));
  expect(Number(visual.opacity)).toBeGreaterThan(0.99);
  expect(visual.width).toBeGreaterThan(20);
  expect(visual.height).toBeGreaterThan(20);
  expect(visual.pressing).toBe(false);
});

test("representative interactive cards have no serious axe violations", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const person = document.createElement("nodalia-person-card");
    person.setConfig({ entity: "person.test", tap_action: "more-info" });
    person.hass = window.makeHass({
      "person.test": { entity_id: "person.test", state: "home", attributes: { friendly_name: "Ada" } },
    });
    document.querySelector("#fixture").append(person);
  });
  const results = await new AxeBuilder({ page })
    .include("nodalia-person-card")
    .disableRules(["color-contrast"])
    .analyze();
  const serious = results.violations.filter(item => ["serious", "critical"].includes(item.impact));
  expect(serious).toEqual([]);
});
