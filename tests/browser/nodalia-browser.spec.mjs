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

test("HACS entrypoint creates every visual editor without requesting a sidecar", async ({ page }) => {
  const editorChunkRequests = [];
  page.on("request", request => {
    if (/nodalia-cards-editor-[^/]+\.js(?:\?|$)/.test(request.url())) {
      editorChunkRequests.push(request.url());
    }
  });
  const errors = await loadBundle(page);
  expect(await page.evaluate(() => Boolean(window.NodaliaEditorUI))).toBe(true);

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
  expect(editorChunkRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("every published card mounts from its stub configuration", async ({ page }) => {
  const errors = await loadBundle(page);
  const tags = await page.evaluate(() => [...new Set([
    ...(window.customCards || []).map(item => item.type),
    "nodalia-insignia-card",
  ])].filter(Boolean));
  await page.evaluate(() => {
    const states = {
      "sensor.test": { entity_id: "sensor.test", state: "21", attributes: { friendly_name: "Sensor", unit_of_measurement: "°C" } },
      "binary_sensor.test": { entity_id: "binary_sensor.test", state: "off", attributes: { friendly_name: "Binary" } },
      "light.test": { entity_id: "light.test", state: "off", attributes: { friendly_name: "Light" } },
      "fan.test": { entity_id: "fan.test", state: "off", attributes: { friendly_name: "Fan", percentage: 0 } },
      "humidifier.test": { entity_id: "humidifier.test", state: "off", attributes: { friendly_name: "Humidifier" } },
      "cover.test": { entity_id: "cover.test", state: "closed", attributes: { friendly_name: "Cover", current_position: 0 } },
      "climate.test": { entity_id: "climate.test", state: "off", attributes: { friendly_name: "Climate", current_temperature: 21, temperature: 22 } },
      "alarm_control_panel.test": { entity_id: "alarm_control_panel.test", state: "disarmed", attributes: { friendly_name: "Alarm" } },
      "vacuum.test": { entity_id: "vacuum.test", state: "docked", attributes: { friendly_name: "Vacuum" } },
      "media_player.test": { entity_id: "media_player.test", state: "idle", attributes: { friendly_name: "Media" } },
      "person.test": { entity_id: "person.test", state: "home", attributes: { friendly_name: "Person" } },
      "scene.test": { entity_id: "scene.test", state: "scening", attributes: { friendly_name: "Scene" } },
      "weather.test": { entity_id: "weather.test", state: "sunny", attributes: { friendly_name: "Weather", temperature: 21, temperature_unit: "°C" } },
      "calendar.test": { entity_id: "calendar.test", state: "off", attributes: { friendly_name: "Calendar" } },
      "camera.test": { entity_id: "camera.test", state: "idle", attributes: { friendly_name: "Camera", entity_picture: "/local/camera.jpg" } },
      "switch.test": { entity_id: "switch.test", state: "off", attributes: { friendly_name: "Switch" } },
      "select.test": { entity_id: "select.test", state: "Auto", attributes: { friendly_name: "Select", options: ["Auto", "Eco"] } },
    };
    window.stubHass = window.makeHass(states);
  });

  const requestedTag = process.env.NODALIA_BROWSER_CARD_TAG || "";
  const mountTags = requestedTag ? tags.filter(tag => tag === requestedTag) : tags;
  const mounted = [];
  for (const tag of mountTags) {
    try {
      mounted.push(await page.evaluate(async currentTag => {
        const ctor = customElements.get(currentTag);
        const card = document.createElement(currentTag);
        const stub = typeof ctor?.getStubConfig === "function" ? await ctor.getStubConfig(window.stubHass) : {};
        if (currentTag === "nodalia-navigation-bar") {
          stub.layout = { ...(stub.layout || {}), show_desktop: true };
        }
        card.setConfig?.({ type: `custom:${currentTag}`, ...(stub || {}) });
        card.hass = window.stubHass;
        document.querySelector("#fixture").append(card);
        await new Promise(resolve => window.requestAnimationFrame(() => resolve()));
        const result = {
          tag: currentTag,
          shadow: Boolean(card.shadowRoot),
          rendered: Boolean(card.shadowRoot?.innerHTML),
        };
        card.remove();
        return result;
      }, tag));
    } catch (error) {
      throw new Error(`Failed to mount ${tag}: ${error?.message || String(error)}`);
    }
  }

  expect(mounted.length).toBeGreaterThanOrEqual(requestedTag ? 1 : 24);
  expect(mounted.every(item => item.shadow)).toBe(true);
  expect(mounted.filter(item => !item.rendered), JSON.stringify(mounted, null, 2)).toEqual([]);
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

test("Vacuum built-ins ignore strict configured-service security", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const calls = [];
    const hass = window.makeHass({
      "vacuum.test": {
        entity_id: "vacuum.test",
        state: "docked",
        attributes: { friendly_name: "Vacuum", fan_speed: "standard", fan_speed_list: ["standard", "turbo"] },
      },
    });
    hass.callService = async (domain, service, data) => calls.push({ domain, service, data });
    const card = document.createElement("nodalia-vacuum-card");
    card.setConfig({
      entity: "vacuum.test",
      security: { strict_service_actions: true, allowed_services: [], allowed_service_domains: [] },
    });
    card.hass = hass;
    document.querySelector("#fixture").append(card);
    window.vacuumCalls = calls;
  });

  await page.locator("nodalia-vacuum-card").locator('[data-vacuum-action="primary"]').click();
  await expect.poll(() => page.evaluate(() => window.vacuumCalls)).toEqual([
    { domain: "vacuum", service: "start", data: { entity_id: "vacuum.test" } },
  ]);
});

test("Navigation volume updates preserve the mounted media card", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const state = volume => ({
      entity_id: "media_player.test",
      state: "playing",
      attributes: {
        friendly_name: "Media",
        media_title: "Song",
        volume_level: volume,
        supported_features: 1,
      },
    });
    const calls = [];
    const hass = window.makeHass({ "media_player.test": state(0.5) });
    hass.callService = async (domain, service, data) => calls.push({ domain, service, data });
    const card = document.createElement("nodalia-navigation-bar");
    card.setConfig({
      layout: { fixed: false, show_desktop: true },
      routes: [{ icon: "mdi:home", label: "Home", path: "/" }],
      media_player: {
        show: true,
        show_desktop: true,
        players: [{ entity: "media_player.test" }],
      },
    });
    card.hass = hass;
    document.querySelector("#fixture").append(card);
    window.navigationVolumeFixture = { card, calls, state };
  });

  const nav = page.locator("nodalia-navigation-bar");
  await nav.locator('[data-media-toggle="expand"]').click();
  await page.evaluate(() => {
    window.navigationVolumeFixture.mediaNode = window.navigationVolumeFixture.card.shadowRoot.querySelector(".media-player-card");
  });
  await nav.locator('[data-media-control="volume-up"]').click();
  await page.evaluate(() => {
    const fixture = window.navigationVolumeFixture;
    const hass = window.makeHass({ "media_player.test": fixture.state(0.58) });
    hass.callService = async (domain, service, data) => fixture.calls.push({ domain, service, data });
    fixture.card.hass = hass;
  });

  expect(await page.evaluate(() => {
    const fixture = window.navigationVolumeFixture;
    return fixture.mediaNode === fixture.card.shadowRoot.querySelector(".media-player-card");
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.navigationVolumeFixture.calls[0])).toEqual({
    domain: "media_player",
    service: "volume_set",
    data: { entity_id: "media_player.test", volume_level: 0.58 },
  });
});

test("Person, Fav and single-scene mode share the Nodalia visual family", async ({ page }) => {
  await loadBundle(page);
  const initial = await page.evaluate(async () => {
    document.documentElement.style.setProperty("--ha-card-background", "#20242b");
    document.documentElement.style.setProperty("--primary-text-color", "#f5f7fb");
    document.documentElement.style.setProperty("--secondary-text-color", "#aeb6c5");
    document.documentElement.style.setProperty("--divider-color", "#414957");
    document.documentElement.style.setProperty("--ha-card-box-shadow", "0 8px 24px rgba(0, 0, 0, 0.2)");
    const states = {
      "person.ada": { entity_id: "person.ada", state: "home", attributes: { friendly_name: "Ada" } },
      "sensor.energy": { entity_id: "sensor.energy", state: "42", attributes: { friendly_name: "Energy", unit_of_measurement: "kWh" } },
      "scene.cinema": { entity_id: "scene.cinema", state: "2026-07-28T12:00:00+00:00", attributes: { friendly_name: "Cinema" } },
      "scene.reading": { entity_id: "scene.reading", state: "2026-07-28T11:00:00+00:00", attributes: { friendly_name: "Reading" } },
    };

    const person = document.createElement("nodalia-person-card");
    person.setConfig({ entity: "person.ada" });
    person.hass = window.makeHass(states);
    document.querySelector("#fixture").append(person);

    const fav = document.createElement("nodalia-fav-card");
    fav.setConfig({ entity: "sensor.energy", styles: { icon: { on_color: "#fec700" } } });
    fav.hass = window.makeHass(states);
    document.querySelector("#fixture").append(fav);

    const sceneCalls = [];
    const sceneHass = window.makeHass(states);
    sceneHass.callService = async (domain, service, data) => sceneCalls.push({ domain, service, data });
    const scenes = document.createElement("nodalia-scenes-card");
    scenes.setConfig({
      layout: "single",
      scenes: [
        { entity: "scene.cinema", color: "#b68cff" },
        { entity: "scene.reading", color: "#71c0ff" },
      ],
    });
    scenes.hass = sceneHass;
    document.querySelector("#fixture").append(scenes);
    window.singleSceneCalls = sceneCalls;

    const scenesCtor = customElements.get("nodalia-scenes-card");
    const editor = await scenesCtor.getConfigElement();
    editor.hass = sceneHass;
    editor.setConfig({ layout: "single", scenes: [{ entity: "scene.cinema" }] });
    document.querySelector("#fixture").append(editor);

    return {
      personSize: person.getCardSize(),
      personGrid: person.getGridOptions(),
      personSingleRow: person.shadowRoot.querySelector("ha-card")?.classList.contains("person-card--single-row"),
      personAvatarWidth: getComputedStyle(person.shadowRoot.querySelector(".person-card__avatar")).width,
      personTitleSize: getComputedStyle(person.shadowRoot.querySelector(".person-card__title")).fontSize,
      personSubtitleSize: getComputedStyle(person.shadowRoot.querySelector(".person-card__state-chip")).fontSize,
      favClass: fav.shadowRoot.querySelector("ha-card")?.className,
      favCardBackground: getComputedStyle(fav.shadowRoot.querySelector("ha-card")).backgroundImage,
      favBubbleBackground: getComputedStyle(fav.shadowRoot.querySelector(".fav-card__icon")).backgroundImage,
      sceneTiles: scenes.shadowRoot.querySelectorAll("[data-scene-entity]").length,
      hasSceneGrid: Boolean(scenes.shadowRoot.querySelector(".scenes-card__grid")),
      singleLabel: scenes.shadowRoot.querySelector(".scenes-card__tile-label")?.textContent,
      editorSingleLabel: editor.shadowRoot.querySelector('option[value="single"]')?.textContent?.trim(),
      editorRows: editor.shadowRoot.querySelectorAll(".scene-editor-card").length,
    };
  });

  expect(initial.personSize).toBe(3);
  expect(initial.personGrid.min_rows).toBe(2);
  expect(initial.personSingleRow).toBe(false);
  expect(initial.personAvatarWidth).toBe("38px");
  expect(initial.personTitleSize).toBe("12px");
  expect(initial.personSubtitleSize).toBe("9px");
  expect(initial.favClass).toContain("is-on");
  expect(initial.favCardBackground).toContain("linear-gradient");
  expect(initial.favBubbleBackground).toContain("radial-gradient");
  expect(initial.sceneTiles).toBe(1);
  expect(initial.hasSceneGrid).toBe(false);
  expect(initial.singleLabel).toBe("Cinema");
  expect(initial.editorSingleLabel).toBe("Single scene");
  expect(initial.editorRows).toBe(1);

  await page.locator("nodalia-scenes-card").locator(".scenes-card--single").click();
  await expect.poll(() => page.evaluate(() => window.singleSceneCalls)).toEqual([
    { domain: "scene", service: "turn_on", data: { entity_id: "scene.cinema" } },
  ]);
});

test("pointer taps do not leave a focus outline while keyboard focus remains visible", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const unrelatedButton = document.createElement("button");
    unrelatedButton.id = "unrelated-button";
    unrelatedButton.textContent = "Outside Nodalia";
    document.querySelector("#fixture").append(unrelatedButton);

    const card = document.createElement("nodalia-entity-card");
    card.setConfig({ entity: "sensor.test", tap_action: "more-info" });
    card.hass = window.makeHass({
      "sensor.test": {
        entity_id: "sensor.test",
        state: "2.70",
        attributes: { friendly_name: "Consumo hoy", unit_of_measurement: "kWh" },
      },
    });
    document.querySelector("#fixture").append(card);
  });

  const unrelatedButton = page.locator("#unrelated-button");
  await unrelatedButton.click();
  expect(await unrelatedButton.evaluate(element => ({
    marker: element.hasAttribute("data-nodalia-pointer-focus"),
    inlineOutline: element.style.getPropertyValue("outline"),
  }))).toEqual({ marker: false, inlineOutline: "" });

  const surface = page.locator("nodalia-entity-card").locator('ha-card[data-entity-action="body"]');
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    await surface.tap();
  } else {
    await surface.click();
  }
  const afterTap = await surface.evaluate(element => ({
    marker: element.hasAttribute("data-nodalia-pointer-focus"),
    outline: getComputedStyle(element).outlineStyle,
  }));
  expect(afterTap).toEqual({ marker: true, outline: "none" });

  await surface.press("Enter");
  const afterKeyboard = await surface.evaluate(element => ({
    marker: element.hasAttribute("data-nodalia-pointer-focus"),
    inlineOutline: element.style.getPropertyValue("outline"),
    focusVisible: element.matches(":focus-visible"),
  }));
  expect(afterKeyboard.marker).toBe(false);
  expect(afterKeyboard.inlineOutline).toBe("");
  expect(afterKeyboard.focusVisible).toBe(true);
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

test("Room Summary cover and climate controls expose accessible names", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const card = document.createElement("nodalia-room-summary-card");
    card.setConfig({
      name: "Office",
      covers: ["cover.blind"],
      climate: "climate.office",
    });
    card.hass = window.makeHass({
      "cover.blind": { entity_id: "cover.blind", state: "open", attributes: { friendly_name: "Blind", current_position: 60 } },
      "climate.office": { entity_id: "climate.office", state: "heat", attributes: { friendly_name: "Office climate", current_temperature: 21, temperature: 22, unit_of_measurement: "°C" } },
    });
    document.querySelector("#fixture").append(card);
  });

  const card = page.locator("nodalia-room-summary-card");
  await card.locator('[data-room-action="nav:covers"]').click();
  const coverControls = card.locator('.room-hub__panel--covers button');
  await expect(coverControls).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await expect(coverControls.nth(index)).toHaveAttribute("aria-label", /\S+/);
  }

  await card.locator('[data-room-action="nav:climate"]').click();
  const climateControls = card.locator('.room-hub__panel--climate button');
  await expect(climateControls).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(climateControls.nth(index)).toHaveAttribute("aria-label", /\S+/);
  }

  const results = await new AxeBuilder({ page })
    .include("nodalia-room-summary-card")
    .disableRules(["color-contrast"])
    .analyze();
  const serious = results.violations.filter(item => ["serious", "critical"].includes(item.impact));
  expect(serious).toEqual([]);
});
