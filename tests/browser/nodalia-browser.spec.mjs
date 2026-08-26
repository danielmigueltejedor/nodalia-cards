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

test("device and Climate layout variants render and keep their native controls", async ({ page }) => {
  const errors = await loadBundle(page);
  const result = await page.evaluate(async () => {
    const states = {
      "fan.test": {
        entity_id: "fan.test",
        state: "on",
        attributes: { friendly_name: "Fan", percentage: 40, percentage_step: 5, supported_features: 11, preset_modes: ["Auto"] },
      },
      "humidifier.test": {
        entity_id: "humidifier.test",
        state: "on",
        attributes: { friendly_name: "Humidifier", humidity: 55, min_humidity: 30, max_humidity: 80, supported_features: 1, available_modes: ["auto"] },
      },
      "cover.test": {
        entity_id: "cover.test",
        state: "open",
        attributes: { friendly_name: "Cover", current_position: 45, supported_features: 143 },
      },
      "climate.test": {
        entity_id: "climate.test",
        state: "heat",
        attributes: {
          friendly_name: "Climate",
          current_temperature: 20,
          temperature: 21,
          min_temp: 10,
          max_temp: 30,
          target_temp_step: 0.5,
          supported_features: 1,
          hvac_modes: ["off", "heat", "cool"],
        },
      },
    };
    const calls = [];
    const hass = window.makeHass(states);
    hass.callService = async (domain, service, data) => calls.push({ domain, service, data });
    const configs = [
      ["nodalia-fan-card", { entity: "fan.test", layout: "circular", animations: { enabled: false } }],
      ["nodalia-humidifier-card", { entity: "humidifier.test", layout: "circular", animations: { enabled: false } }],
      ["nodalia-cover-card", { entity: "cover.test", layout: "circular", animations: { enabled: false } }],
      ["nodalia-climate-card", { entity: "climate.test", layout: "compact", animations: { enabled: false } }],
    ];
    const cards = {};
    for (const [tag, config] of configs) {
      const card = document.createElement(tag);
      card.setConfig(config);
      card.hass = hass;
      document.querySelector("#fixture").append(card);
      cards[tag] = card;
    }
    const fanCompact = document.createElement("nodalia-fan-card");
    fanCompact.setConfig({ entity: "fan.test", layout: "compact", animations: { enabled: false } });
    fanCompact.hass = hass;
    document.querySelector("#fixture").append(fanCompact);
    const climateCircular = document.createElement("nodalia-climate-card");
    climateCircular.setConfig({ entity: "climate.test", layout: "circular", animations: { enabled: false } });
    climateCircular.hass = hass;
    document.querySelector("#fixture").append(climateCircular);
    await new Promise(resolve => requestAnimationFrame(() => resolve()));

    cards["nodalia-fan-card"].shadowRoot.querySelector('[data-fan-action="increase-percentage"]')?.click();
    cards["nodalia-humidifier-card"].shadowRoot.querySelector('[data-humidifier-action="increase-humidity"]')?.click();
    cards["nodalia-cover-card"].shadowRoot.querySelector('[data-cover-action="increase-position"]')?.click();
    cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card__circular-power")?.click();
    cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card__circular-power")?.click();
    cards["nodalia-cover-card"].shadowRoot.querySelector('[data-cover-action="icon"]')?.click();
    const climateSlider = cards["nodalia-climate-card"].shadowRoot.querySelector('[data-climate-compact-field="temperature"]');
    if (climateSlider) {
      climateSlider.value = "22";
      climateSlider.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      climateSlider.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }

    const editorLayouts = {};
    for (const [tag, config] of configs) {
      const editor = await customElements.get(tag).getConfigElement();
      editor.hass = hass;
      editor.setConfig(config);
      document.querySelector("#fixture").append(editor);
      const selector = editor.shadowRoot.querySelector('select[data-field="layout"]');
      editorLayouts[tag] = { exists: Boolean(selector), value: selector?.value || "" };
    }
    await new Promise(resolve => window.setTimeout(resolve, 30));

    const compactClimate = cards["nodalia-climate-card"];
    compactClimate._engineOverride = { available: true, until: "" };
    compactClimate._lastRenderSignature = "";
    compactClimate._render();
    await new Promise(resolve => requestAnimationFrame(() => resolve()));

    const visual = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        borderRadius: style.borderRadius,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        padding: style.padding,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter,
        strokeWidth: style.strokeWidth,
      };
    };
    const fanCompactRoot = fanCompact.shadowRoot;
    const climateCompactRoot = cards["nodalia-climate-card"].shadowRoot;
    const climateCircularRoot = climateCircular.shadowRoot;
    const compactMetrics = {
      fanCard: visual(fanCompactRoot.querySelector("ha-card")),
      climateCard: visual(climateCompactRoot.querySelector("ha-card")),
      fanContentPadding: getComputedStyle(fanCompactRoot.querySelector("ha-card")).padding,
      climateContentPadding: getComputedStyle(climateCompactRoot.querySelector(".climate-card__content")).padding,
      fanIcon: visual(fanCompactRoot.querySelector(".fan-card__icon")),
      climateIcon: visual(climateCompactRoot.querySelector(".climate-card__icon")),
      fanTitle: visual(fanCompactRoot.querySelector(".fan-card__title")),
      climateTitle: visual(climateCompactRoot.querySelector(".climate-card__title")),
      fanChip: visual(fanCompactRoot.querySelector(".fan-card__chip")),
      climateChip: visual(climateCompactRoot.querySelector(".climate-card__chip")),
      fanSliderWrap: visual(fanCompactRoot.querySelector(".fan-card__slider-wrap")),
      climateSliderWrap: visual(climateCompactRoot.querySelector(".climate-card__compact-slider-shell")),
      fanSliderTrack: visual(fanCompactRoot.querySelector(".fan-card__slider-track")),
      climateSliderTrack: visual(climateCompactRoot.querySelector(".climate-card__compact-slider-track")),
      fanControl: visual(fanCompactRoot.querySelector(".fan-card__control")),
      climateControl: visual(climateCompactRoot.querySelector(".climate-card__compact-step")),
      climateOverride: visual(climateCompactRoot.querySelector(".climate-card__override-chip")),
      climateOverrideBoxSizing: getComputedStyle(climateCompactRoot.querySelector(".climate-card__override-chip")).boxSizing,
      climateOverrideLabelOverflow: getComputedStyle(climateCompactRoot.querySelector(".climate-card__override-chip-label")).textOverflow,
    };
    const climateDial = climateCircularRoot.querySelector(".climate-card__dial");
    const circularMetrics = {
      climate: {
        card: visual(climateCircularRoot.querySelector("ha-card")),
        icon: visual(climateCircularRoot.querySelector(".climate-card__icon")),
        title: visual(climateCircularRoot.querySelector(".climate-card__title")),
        dial: visual(climateDial),
        track: visual(climateCircularRoot.querySelector(".climate-card__dial-track")),
        thumb: visual(climateCircularRoot.querySelector(".climate-card__dial-thumb")),
        primary: visual(climateCircularRoot.querySelector(".climate-card__target")),
      },
      fan: {
        card: visual(cards["nodalia-fan-card"].shadowRoot.querySelector("ha-card")),
        icon: visual(cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card__icon")),
        title: visual(cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card__title")),
        dial: visual(cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card__circular-dial")),
        track: visual(cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card__circular-track")),
        thumb: visual(cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card__circular-thumb")),
        primary: visual(cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card__circular-center strong")),
      },
      humidifier: {
        card: visual(cards["nodalia-humidifier-card"].shadowRoot.querySelector("ha-card")),
        icon: visual(cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card__icon")),
        title: visual(cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card__title")),
        dial: visual(cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card__circular-dial")),
        track: visual(cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card__circular-track")),
        thumb: visual(cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card__circular-thumb")),
        primary: visual(cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card__circular-center strong")),
      },
      cover: {
        card: visual(cards["nodalia-cover-card"].shadowRoot.querySelector("ha-card")),
        icon: visual(cards["nodalia-cover-card"].shadowRoot.querySelector(".fan-card__icon")),
        title: visual(cards["nodalia-cover-card"].shadowRoot.querySelector(".fan-card__title")),
        dial: visual(cards["nodalia-cover-card"].shadowRoot.querySelector(".fan-card__circular-dial")),
        track: visual(cards["nodalia-cover-card"].shadowRoot.querySelector(".fan-card__circular-track")),
        thumb: visual(cards["nodalia-cover-card"].shadowRoot.querySelector(".fan-card__circular-thumb")),
        primary: visual(cards["nodalia-cover-card"].shadowRoot.querySelector(".fan-card__circular-center strong")),
      },
    };

    return {
      fanCircular: Boolean(cards["nodalia-fan-card"].shadowRoot.querySelector(".fan-card--circular .fan-card__circular-dial")),
      humidifierCircular: Boolean(cards["nodalia-humidifier-card"].shadowRoot.querySelector(".humidifier-card--circular .humidifier-card__circular-dial")),
      coverCircular: Boolean(cards["nodalia-cover-card"].shadowRoot.querySelector(".fan-card--circular .fan-card__circular-dial")),
      climateCompact: Boolean(cards["nodalia-climate-card"].shadowRoot.querySelector(".climate-card--layout-compact .climate-card__compact-slider")),
      climateHasCircularDial: Boolean(cards["nodalia-climate-card"].shadowRoot.querySelector(".climate-card__dial")),
      editorLayouts,
      compactMetrics,
      circularMetrics,
      calls,
    };
  });

  expect(result.fanCircular).toBe(true);
  expect(result.humidifierCircular).toBe(true);
  expect(result.coverCircular).toBe(true);
  expect(result.climateCompact).toBe(true);
  expect(result.climateHasCircularDial).toBe(false);
  expect(Object.values(result.editorLayouts).every(item => item.exists)).toBe(true);
  expect(result.editorLayouts["nodalia-climate-card"].value).toBe("compact");
  expect(result.compactMetrics.climateCard.borderRadius).toBe(result.compactMetrics.fanCard.borderRadius);
  expect(result.compactMetrics.climateContentPadding).toBe(result.compactMetrics.fanContentPadding);
  for (const part of ["Icon", "Title", "Chip", "SliderWrap", "SliderTrack", "Control"]) {
    const heightDelta = Math.abs(
      result.compactMetrics[`climate${part}`].height - result.compactMetrics[`fan${part}`].height,
    );
    expect(heightDelta, part).toBeLessThanOrEqual(0.5);
  }
  expect(result.compactMetrics.climateTitle.fontSize).toBe(result.compactMetrics.fanTitle.fontSize);
  expect(result.compactMetrics.climateChip.fontSize).toBe(result.compactMetrics.fanChip.fontSize);
  expect(result.compactMetrics.climateOverride.height).toBe(36);
  expect(result.compactMetrics.climateOverrideBoxSizing).toBe("border-box");
  expect(result.compactMetrics.climateOverrideLabelOverflow).toBe("ellipsis");
  for (const name of ["fan", "humidifier", "cover"]) {
    const actual = result.circularMetrics[name];
    const climate = result.circularMetrics.climate;
    expect(actual.card.borderRadius, `${name} card radius`).toBe(climate.card.borderRadius);
    expect(actual.icon.width, `${name} icon`).toBe(climate.icon.width);
    expect(actual.title.fontSize, `${name} title`).toBe(climate.title.fontSize);
    expect(actual.dial.width, `${name} dial`).toBe(climate.dial.width);
    expect(actual.dial.borderRadius, `${name} dial radius`).toBe(climate.dial.borderRadius);
    expect(actual.dial.backdropFilter, `${name} dial glass`).toBe(climate.dial.backdropFilter);
    expect(actual.track.strokeWidth, `${name} ring`).toBe(climate.track.strokeWidth);
    expect(actual.thumb.width, `${name} thumb`).toBe(climate.thumb.width);
    expect(
      Math.abs(Number.parseFloat(actual.primary.fontSize) - Number.parseFloat(climate.primary.fontSize)),
      `${name} primary`,
    ).toBeLessThanOrEqual(3);
    expect(actual.primary.fontWeight, `${name} primary weight`).toBe(climate.primary.fontWeight);
  }
  expect(result.calls).toEqual(expect.arrayContaining([
    expect.objectContaining({ domain: "fan", service: "set_percentage" }),
    expect.objectContaining({ domain: "humidifier", service: "set_humidity" }),
    expect.objectContaining({ domain: "cover", service: "set_cover_position" }),
    expect.objectContaining({ domain: "climate", service: "set_temperature" }),
    expect.objectContaining({ domain: "fan", service: "turn_off" }),
    expect.objectContaining({ domain: "humidifier", service: "turn_off" }),
    expect.objectContaining({ domain: "cover", service: "close_cover" }),
  ]));
  expect(errors).toEqual([]);
});

test("entity-first picker receives relevant Nodalia card suggestions", async ({ page }) => {
  const errors = await loadBundle(page);
  const suggestions = await page.evaluate(() => {
    const states = {
      "light.kitchen": { entity_id: "light.kitchen", state: "off", attributes: { friendly_name: "Kitchen" } },
      "person.marco": { entity_id: "person.marco", state: "home", attributes: { friendly_name: "Marco" } },
      "sensor.power": { entity_id: "sensor.power", state: "125", attributes: { friendly_name: "Power", unit_of_measurement: "W" } },
      "sensor.news": { entity_id: "sensor.news", state: "2", attributes: { friendly_name: "News", items: [{ title: "One" }] } },
      "vacuum.robot": { entity_id: "vacuum.robot", state: "docked", attributes: { friendly_name: "Robot" } },
      "scene.relax": { entity_id: "scene.relax", state: "scening", attributes: { friendly_name: "Relax" } },
      "calendar.family": { entity_id: "calendar.family", state: "off", attributes: { friendly_name: "Family" } },
      "media_player.living_room": { entity_id: "media_player.living_room", state: "idle", attributes: { friendly_name: "Living room" } },
    };
    const hass = window.makeHass(states);
    const forEntity = entityId => (window.customCards || []).flatMap(card => {
      if (typeof card.getEntitySuggestion !== "function") return [];
      const result = card.getEntitySuggestion(hass, entityId);
      return result ? (Array.isArray(result) ? result : [result]) : [];
    });
    return Object.fromEntries(Object.keys(states).map(entityId => [entityId, forEntity(entityId)]));
  });

  const types = entityId => suggestions[entityId].map(item => item.config.type);
  expect(types("light.kitchen")).toEqual(expect.arrayContaining([
    "custom:nodalia-light-card",
    "custom:nodalia-entity-card",
  ]));
  expect(types("person.marco")).toEqual(expect.arrayContaining([
    "custom:nodalia-person-card",
    "custom:nodalia-entity-card",
  ]));
  expect(types("sensor.power")).toEqual(expect.arrayContaining([
    "custom:nodalia-circular-gauge-card",
    "custom:nodalia-graph-card",
    "custom:nodalia-entity-card",
  ]));
  expect(types("sensor.power")).not.toContain("custom:nodalia-news-card");
  expect(types("sensor.news")).toContain("custom:nodalia-news-card");
  expect(types("vacuum.robot")).toEqual(expect.arrayContaining([
    "custom:nodalia-vacuum-card",
    "custom:nodalia-advance-vacuum-card",
    "custom:nodalia-entity-card",
  ]));
  expect(suggestions["scene.relax"].find(item => item.config.type === "custom:nodalia-scenes-card")?.config).toMatchObject({
    layout: "single",
    scenes: [{ entity: "scene.relax" }],
  });
  expect(suggestions["calendar.family"].find(item => item.config.type === "custom:nodalia-calendar-card")?.config).toMatchObject({
    calendars: [{ entity: "calendar.family" }],
  });
  expect(suggestions["media_player.living_room"].find(item => item.config.type === "custom:nodalia-media-player")?.config).toMatchObject({
    players: [{ entity: "media_player.living_room", label: "Living room" }],
  });
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

test("Advanced Vacuum keeps its platform selector compact and contextual", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(async () => {
    const states = {
      "vacuum.test": {
        entity_id: "vacuum.test",
        state: "docked",
        attributes: { friendly_name: "Vacuum" },
      },
      "camera.test_map": {
        entity_id: "camera.test_map",
        state: "idle",
        attributes: { friendly_name: "Vacuum map" },
      },
    };
    const ctor = customElements.get("nodalia-advance-vacuum-card");
    const editor = await ctor.getConfigElement();
    editor.hass = window.makeHass(states);
    editor.setConfig({
      type: "custom:nodalia-advance-vacuum-card",
      entity: "vacuum.test",
      vacuum_platform: "Roborock",
      map_source: { camera: "camera.test_map" },
    });
    editor.addEventListener("config-changed", event => editor.setConfig(event.detail.config));
    document.querySelector("#fixture").append(editor);
  });

  const editor = page.locator("nodalia-advance-vacuum-card-editor");
  const platform = editor.locator('select[data-field="vacuum_platform"]');
  await expect(platform).toBeVisible();
  await expect(editor.locator('input[data-field="vacuum_mqtt_topic"]')).toHaveCount(0);

  const compactLayout = await platform.evaluate(select => {
    const field = select.closest(".editor-field");
    const grid = field?.parentElement;
    const style = getComputedStyle(select);
    return {
      height: select.getBoundingClientRect().height,
      widthRatio: field && grid ? field.getBoundingClientRect().width / grid.getBoundingClientRect().width : 0,
      backgroundImage: style.backgroundImage,
    };
  });
  expect(compactLayout.height).toBe(40);
  expect(compactLayout.widthRatio).toBeGreaterThan(0.95);
  expect(compactLayout.backgroundImage).not.toBe("none");

  await platform.selectOption("Hypfer/Valetudo");
  await expect(editor.locator('input[data-field="vacuum_mqtt_topic"]')).toBeVisible();
  await expect(editor.locator('select[data-field="vacuum_platform"]')).toHaveValue("Hypfer/Valetudo");
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
  expect(await personAction.evaluate(element => ({
    tagName: element.tagName,
    borderRadius: getComputedStyle(element).borderRadius,
    outlineOffset: getComputedStyle(element).outlineOffset,
  }))).toEqual({
    tagName: "HA-CARD",
    borderRadius: "28px",
    outlineOffset: "-3px",
  });
  await personAction.press("Enter");
  await expect.poll(() => page.evaluate(() => window.personActions)).toBe(1);

  const cameraAction = page.locator("nodalia-camera-card").locator('[data-camera-action="camera-tap"]').first();
  await cameraAction.focus();
  await cameraAction.click();
  const close = page.locator("nodalia-camera-card").locator(".camera-card__expanded-close");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("nodalia-camera-card").locator('.camera-card__expanded[role="dialog"]')).toHaveCount(0);
  await expect(cameraAction).toBeFocused();
});

test("Camera preview respects navigate tap actions through Home Assistant SPA navigation", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const camera = document.createElement("nodalia-camera-card");
    camera.setConfig({
      entity: "camera.porch",
      cameras: ["camera.porch", "camera.driveway"],
      camera_tap_actions: [
        {
          camera: "camera.driveway",
          tap_action: "navigate",
          navigation_path: "/lovelace/home/",
        },
      ],
    });
    const hass = window.makeHass({
      "camera.porch": { entity_id: "camera.porch", state: "idle", attributes: { friendly_name: "Porch" } },
      "camera.driveway": { entity_id: "camera.driveway", state: "idle", attributes: { friendly_name: "Driveway" } },
    });
    window.cameraNativeActions = [];
    hass.navigate = path => window.cameraNativeActions.push(path);
    camera.hass = hass;
    document.querySelector("#fixture").append(camera);
  });

  const previewAction = page.locator("nodalia-camera-card").locator('.camera-card__preview-open[data-camera-action="camera-tap"]').nth(1);
  await previewAction.click();
  await expect.poll(() => page.evaluate(() => window.cameraNativeActions)).toEqual(["/lovelace/home/"]);
  await expect(page.locator("nodalia-camera-card").locator('.camera-card__expanded[role="dialog"]')).toHaveCount(0);

  await page.locator("nodalia-camera-card").locator('.camera-card__preview-open[data-camera-action="camera-tap"]').first().click();
  await expect.poll(() => page.locator("nodalia-camera-card").evaluate(card => card._expandedEntityId)).toBe("camera.porch");
  await expect(page.locator("nodalia-camera-card").locator('.camera-card__expanded[role="dialog"]')).toHaveCount(1);
});

test("Camera legacy auto tap keeps opening Home Assistant more-info", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const camera = document.createElement("nodalia-camera-card");
    camera.setConfig({
      entity: "camera.porch",
      tap_action: "auto",
    });
    camera.hass = window.makeHass({
      "camera.porch": { entity_id: "camera.porch", state: "idle", attributes: { friendly_name: "Porch" } },
    });
    window.cameraMoreInfoActions = [];
    camera.addEventListener("hass-more-info", event => window.cameraMoreInfoActions.push(event.detail.entityId));
    document.querySelector("#fixture").append(camera);
  });

  await page.locator("nodalia-camera-card").locator('[data-camera-action="camera-tap"]').click();
  await expect.poll(() => page.evaluate(() => window.cameraMoreInfoActions)).toEqual(["camera.porch"]);
  await expect(page.locator("nodalia-camera-card").locator('.camera-card__expanded[role="dialog"]')).toHaveCount(0);
});

test("Camera editor exposes an independent tap action for every configured camera", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const editor = document.createElement("nodalia-camera-card-editor");
    editor.setConfig({
      entity: "camera.porch",
      cameras: ["camera.porch", "camera.driveway"],
      camera_tap_actions: [
        { camera: "camera.driveway", tap_action: "navigate", navigation_path: "/lovelace/driveway" },
      ],
    });
    editor.hass = window.makeHass({
      "camera.porch": { entity_id: "camera.porch", state: "idle", attributes: { friendly_name: "Porch" } },
      "camera.driveway": { entity_id: "camera.driveway", state: "idle", attributes: { friendly_name: "Driveway" } },
    });
    document.querySelector("#fixture").append(editor);
  });

  const editor = page.locator("nodalia-camera-card-editor");
  await expect(editor.locator('select[data-field="camera_tap_actions.0.tap_action"]')).toHaveValue("toggle");
  await expect(editor.locator('select[data-field="camera_tap_actions.1.tap_action"]')).toHaveValue("navigate");
  await expect(editor.locator('input[data-field="camera_tap_actions.1.navigation_path"]')).toHaveValue("/lovelace/driveway");
  await expect(editor.locator('select[data-field="tap_action"]')).toHaveCount(0);
});

test("Camera editor does not freeze inherited global tap actions on unrelated saves", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const editor = document.createElement("nodalia-camera-card-editor");
    editor.setConfig({
      entity: "camera.porch",
      cameras: ["camera.porch", "camera.driveway"],
      tap_action: { action: "navigate", navigation_path: "/lovelace/cameras" },
    });
    editor.hass = window.makeHass({
      "camera.porch": { entity_id: "camera.porch", state: "idle", attributes: { friendly_name: "Porch" } },
      "camera.driveway": { entity_id: "camera.driveway", state: "idle", attributes: { friendly_name: "Driveway" } },
    });
    window.cameraEditorConfigs = [];
    editor.addEventListener("config-changed", event => {
      window.cameraEditorConfigs.push(JSON.parse(JSON.stringify(event.detail.config)));
    });
    document.querySelector("#fixture").append(editor);
  });

  const editor = page.locator("nodalia-camera-card-editor");
  await expect(editor.locator('select[data-field="camera_tap_actions.0.tap_action"]')).toHaveValue("navigate");
  await editor.locator('input[data-field="show_name"]').check({ force: true });
  const saved = await page.evaluate(() => window.cameraEditorConfigs.at(-1));
  expect(saved.tap_action).toBe("navigate");
  expect(saved.navigation_path).toBe("/lovelace/cameras");
  expect(saved.camera_tap_actions).toBeUndefined();
});

test("Person supports native Lovelace tap hold double-tap and service actions", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const states = {
      "person.test": { entity_id: "person.test", state: "home", attributes: { friendly_name: "John" } },
    };
    const person = document.createElement("nodalia-person-card");
    person.setConfig({
      entity: "person.test",
      tap_action: "navigate",
      navigation_path: "#marcomap",
      hold_action: { action: "navigate", navigation_path: "/lovelace/person-hold" },
      double_tap_action: { action: "navigate", navigation_path: "/lovelace/person-double" },
    });
    person.hass = window.makeHass(states);
    window.personNativeActions = [];
    window.addEventListener("location-changed", () => {
      window.personNativeActions.push(`${window.location.pathname}${window.location.hash}`);
    });
    document.querySelector("#fixture").append(person);

    const serviceCalls = [];
    const serviceHass = window.makeHass(states);
    serviceHass.callService = async (domain, service, data, target) => {
      serviceCalls.push({ domain, service, data, target });
    };
    const servicePerson = document.createElement("nodalia-person-card");
    servicePerson.setConfig({
      entity: "person.test",
      tap_action: {
        action: "perform-action",
        perform_action: "script.person_action",
        data: { source: "person-card" },
        target: { entity_id: "script.person_action" },
      },
      security: { allowed_services: ["script.person_action"] },
    });
    servicePerson.hass = serviceHass;
    servicePerson.dataset.testPersonService = "true";
    document.querySelector("#fixture").append(servicePerson);
    window.personServiceCalls = serviceCalls;
  });

  const action = page.locator("nodalia-person-card").first().locator('[data-person-action="primary"]');
  await action.click();
  await expect.poll(() => page.evaluate(() => window.personNativeActions)).toEqual([
    "/tests/fixtures/browser.html#marcomap",
  ]);
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#marcomap");

  await action.dblclick();
  await expect.poll(() => page.evaluate(() => window.personNativeActions)).toEqual([
    "/tests/fixtures/browser.html#marcomap",
    "/lovelace/person-double",
  ]);

  await action.dispatchEvent("pointerdown", { pointerId: 11, pointerType: "touch", button: 0, clientX: 10, clientY: 10 });
  await page.waitForTimeout(560);
  await action.dispatchEvent("pointerup", { pointerId: 11, pointerType: "touch", button: 0, clientX: 10, clientY: 10 });
  await action.click();
  await expect.poll(() => page.evaluate(() => window.personNativeActions)).toEqual([
    "/tests/fixtures/browser.html#marcomap",
    "/lovelace/person-double",
    "/lovelace/person-hold",
  ]);

  await page.locator('nodalia-person-card[data-test-person-service="true"]').locator('[data-person-action="primary"]').click();
  await expect.poll(() => page.evaluate(() => window.personServiceCalls)).toEqual([{
    domain: "script",
    service: "person_action",
    data: { source: "person-card" },
    target: { entity_id: "script.person_action" },
  }]);
});

test("Person visual editor exposes tap hold and double-tap configuration", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(async () => {
    const states = {
      "person.test": { entity_id: "person.test", state: "home", attributes: { friendly_name: "John" } },
    };
    const ctor = customElements.get("nodalia-person-card");
    const editor = await ctor.getConfigElement();
    editor.hass = window.makeHass(states);
    editor.setConfig({
      entity: "person.test",
      tap_action: { action: "navigate", navigation_path: "#bubblecard_john" },
      hold_action: { action: "perform-action", perform_action: "script.person_hold" },
      double_tap_action: { action: "url", url_path: "https://example.com/person" },
      security: { allowed_services: ["script.person_hold"] },
    });
    document.querySelector("#fixture").append(editor);
  });

  const editor = page.locator("nodalia-person-card-editor");
  await editor.locator('[data-editor-toggle="tap_actions"]').click();
  await expect(editor.locator('select[data-field="tap_action"]')).toHaveValue("navigate");
  await expect(editor.locator('input[data-field="navigation_path"]')).toHaveValue("#bubblecard_john");
  await expect(editor.locator('select[data-field="hold_action"]')).toHaveValue("service");
  await expect(editor.locator('input[data-field="hold_service"]')).toHaveValue("script.person_hold");
  await expect(editor.locator('select[data-field="double_tap_action"]')).toHaveValue("url");
  await expect(editor.locator('input[data-field="double_tap_url"]')).toHaveValue("https://example.com/person");
  await expect(editor.locator('input[data-field="security.allowed_services"]')).toHaveValue("script.person_hold");
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

test("Entity inherits its Home Assistant icon by default while manual icons win", async ({ page }) => {
  await loadBundle(page);
  const icons = await page.evaluate(() => {
    const hass = window.makeHass({
      "switch.dynamic": {
        entity_id: "switch.dynamic",
        state: "off",
        attributes: { friendly_name: "Dynamic" },
      },
      "switch.custom": {
        entity_id: "switch.custom",
        state: "on",
        attributes: { friendly_name: "Custom", icon: "mdi:floor-lamp" },
      },
    });
    const mount = config => {
      const card = document.createElement("nodalia-entity-card");
      card.setConfig(config);
      card.hass = hass;
      document.querySelector("#fixture").append(card);
      return card.shadowRoot.querySelector(".entity-card__icon ha-icon")?.getAttribute("icon");
    };
    return {
      dynamic: mount({ entity: "switch.dynamic" }),
      entityDefined: mount({ entity: "switch.custom" }),
      manual: mount({ entity: "switch.custom", icon: "mdi:star" }),
    };
  });

  expect(icons).toEqual({
    dynamic: "mdi:toggle-switch-variant-off",
    entityDefined: "mdi:floor-lamp",
    manual: "mdi:star",
  });
});

test("Fav inherits its Home Assistant icon by default while manual icons win", async ({ page }) => {
  await loadBundle(page);
  const icons = await page.evaluate(() => {
    const hass = window.makeHass({
      "light.dynamic": {
        entity_id: "light.dynamic",
        state: "off",
        attributes: { friendly_name: "Dynamic" },
      },
      "light.custom": {
        entity_id: "light.custom",
        state: "on",
        attributes: { friendly_name: "Custom", icon: "mdi:floor-lamp" },
      },
    });
    const mount = config => {
      const card = document.createElement("nodalia-fav-card");
      card.setConfig(config);
      card.hass = hass;
      document.querySelector("#fixture").append(card);
      return card.shadowRoot.querySelector(".fav-card__icon ha-icon")?.getAttribute("icon");
    };
    return {
      dynamic: mount({ entity: "light.dynamic" }),
      entityDefined: mount({ entity: "light.custom" }),
      manual: mount({ entity: "light.custom", icon: "mdi:heart" }),
    };
  });

  expect(icons).toEqual({
    dynamic: "mdi:lightbulb-off",
    entityDefined: "mdi:floor-lamp",
    manual: "mdi:heart",
  });
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

test("Navigation keeps media controls on the selected entity when visible players change", async ({ page }) => {
  await loadBundle(page);
  await page.evaluate(() => {
    const playerState = (entityId, state) => ({
      entity_id: entityId,
      state,
      attributes: {
        friendly_name: entityId.split(".")[1],
        media_title: `${entityId} track`,
        volume_level: 0.5,
        supported_features: 1,
      },
    });
    const initialStates = {
      "media_player.kitchen": playerState("media_player.kitchen", "playing"),
      "media_player.living_room": playerState("media_player.living_room", "playing"),
      "media_player.bedroom": playerState("media_player.bedroom", "playing"),
    };
    const calls = [];
    const card = document.createElement("nodalia-navigation-bar");
    card.setConfig({
      layout: { fixed: false, show_desktop: true },
      routes: [{ icon: "mdi:home", label: "Home", path: "/" }],
      media_player: {
        show_desktop: true,
        players: [
          { entity: "media_player.kitchen", browse_path: "/media-browser/browser" },
          { entity: "media_player.living_room", browse_path: "/media-browser/browser" },
          { entity: "media_player.bedroom", browse_path: "/media-browser/browser" },
        ],
      },
    });
    const makeHass = states => {
      const hass = window.makeHass(states);
      hass.callService = async (domain, service, data) => calls.push({ domain, service, data });
      return hass;
    };
    card.hass = makeHass(initialStates);
    document.querySelector("#fixture").append(card);
    window.navigationIdentityFixture = { card, calls, initialStates, makeHass, playerState };
  });

  const nav = page.locator("nodalia-navigation-bar");
  await nav.locator('[data-media-toggle="expand"]').click();
  await nav.locator('[data-media-index="1"]').click();
  await expect(nav.locator('[data-media-control="play-pause"]')).toHaveAttribute("data-entity", "media_player.living_room");

  await page.evaluate(() => {
    const fixture = window.navigationIdentityFixture;
    fixture.card.hass = fixture.makeHass({
      ...fixture.initialStates,
      "media_player.kitchen": fixture.playerState("media_player.kitchen", "idle"),
    });
  });

  await expect(nav.locator('[data-media-index="0"]')).toHaveClass(/active/);
  await expect(nav.locator('[data-media-control="play-pause"]')).toHaveAttribute("data-entity", "media_player.living_room");
  await expect(nav.locator('[data-media-control="volume-up"]')).toHaveAttribute("data-entity", "media_player.living_room");
  await expect(nav.locator('[data-media-control="browse-media"]')).toHaveCount(1);
  await expect(nav.locator('[data-media-control="browse-media"]')).toHaveAttribute("data-entity", "media_player.living_room");

  await nav.locator('[data-media-control="play-pause"]').click();
  await nav.locator('[data-media-control="volume-up"]').click();
  await expect.poll(() => page.evaluate(() => window.navigationIdentityFixture.calls)).toEqual([
    {
      domain: "media_player",
      service: "media_play_pause",
      data: { entity_id: "media_player.living_room" },
    },
    {
      domain: "media_player",
      service: "volume_set",
      data: { entity_id: "media_player.living_room", volume_level: 0.58 },
    },
  ]);
});

test("Entity and Fav use the stronger neutral bubble while tinted glyphs retain contrast", async ({ page }) => {
  await loadBundle(page);
  const visuals = await page.evaluate(() => {
    document.documentElement.style.setProperty("--ha-card-background", "#f7f8fa");
    document.documentElement.style.setProperty("--primary-text-color", "#1b1d22");
    document.documentElement.style.setProperty("--divider-color", "#d7dbe2");
    document.documentElement.style.setProperty("--ha-card-box-shadow", "0 8px 24px rgba(0, 0, 0, 0.14)");
    const accent = "#f29a63";
    const states = {
      "light.neutral": { entity_id: "light.neutral", state: "off", attributes: { friendly_name: "Light neutral" } },
      "sensor.entity": { entity_id: "sensor.entity", state: "idle", attributes: { friendly_name: "Entity neutral" } },
      "input_boolean.fav_neutral": { entity_id: "input_boolean.fav_neutral", state: "off", attributes: { friendly_name: "Fav neutral" } },
      "light.warm": { entity_id: "light.warm", state: "on", attributes: { friendly_name: "Light warm", rgb_color: [242, 154, 99] } },
      "input_boolean.fav_warm": { entity_id: "input_boolean.fav_warm", state: "on", attributes: { friendly_name: "Fav warm" } },
      "vacuum.warm": { entity_id: "vacuum.warm", state: "cleaning", attributes: { friendly_name: "Vacuum warm" } },
    };
    const hass = window.makeHass(states);
    const mount = (tag, config, iconStyles = {}) => {
      const card = document.createElement(tag);
      card.setConfig({
        ...config,
        animations: { enabled: false },
        styles: { icon: iconStyles },
      });
      card.hass = hass;
      document.querySelector("#fixture").append(card);
      return card;
    };
    const read = (card, bubbleSelector) => {
      const surface = getComputedStyle(card.shadowRoot.querySelector("ha-card"));
      const bubble = getComputedStyle(card.shadowRoot.querySelector(bubbleSelector));
      const glyph = getComputedStyle(card.shadowRoot.querySelector(`${bubbleSelector} ha-icon`));
      return {
        surfaceShadow: surface.boxShadow,
        bubbleBackground: bubble.backgroundColor,
        bubbleBackgroundImage: bubble.backgroundImage,
        bubbleBorder: bubble.border,
        bubbleShadow: bubble.boxShadow,
        bubbleColor: bubble.color,
        glyphColor: glyph.color,
      };
    };
    const neutralReference = document.createElement("span");
    neutralReference.style.background = "color-mix(in srgb, var(--primary-text-color) 8%, transparent)";
    neutralReference.style.border = "1px solid color-mix(in srgb, var(--primary-text-color) 8%, transparent)";
    neutralReference.style.boxShadow = "inset 0 1px 0 color-mix(in srgb, var(--primary-text-color) 6%, transparent), 0 10px 24px rgba(0, 0, 0, 0.18)";
    document.querySelector("#fixture").append(neutralReference);
    const neutralReferenceStyle = getComputedStyle(neutralReference);
    const lightNeutral = mount("nodalia-light-card", { entity: "light.neutral" });
    const entityNeutral = mount(
      "nodalia-entity-card",
      { entity: "sensor.entity" },
      { background: "var(--ha-card-background)" },
    );
    const favNeutral = mount(
      "nodalia-fav-card",
      { entity: "input_boolean.fav_neutral" },
      { background: "rgba(255, 255, 255, 0.08)" },
    );
    const lightWarm = mount("nodalia-light-card", { entity: "light.warm" });
    const favWarm = mount("nodalia-fav-card", { entity: "input_boolean.fav_warm" }, { on_color: accent });
    const vacuumWarm = mount("nodalia-vacuum-card", { entity: "vacuum.warm" }, { active_color: accent });
    return {
      accent: "rgb(242, 154, 99)",
      neutralReference: {
        bubbleBackground: neutralReferenceStyle.backgroundColor,
        bubbleBackgroundImage: neutralReferenceStyle.backgroundImage,
        bubbleBorder: neutralReferenceStyle.border,
        bubbleShadow: neutralReferenceStyle.boxShadow,
      },
      lightNeutral: read(lightNeutral, ".light-card__icon"),
      entityNeutral: read(entityNeutral, ".entity-card__icon"),
      favNeutral: read(favNeutral, ".fav-card__icon"),
      lightWarm: read(lightWarm, ".light-card__icon"),
      favWarm: read(favWarm, ".fav-card__icon"),
      vacuumWarm: read(vacuumWarm, ".vacuum-card__icon-button"),
    };
  });

  for (const card of [visuals.entityNeutral, visuals.favNeutral]) {
    expect(card.surfaceShadow).toBe(visuals.lightNeutral.surfaceShadow);
    expect(card.bubbleBackground).toBe(visuals.neutralReference.bubbleBackground);
    expect(card.bubbleBackgroundImage).toBe(visuals.neutralReference.bubbleBackgroundImage);
    expect(card.bubbleBorder).toBe(visuals.neutralReference.bubbleBorder);
    expect(card.bubbleShadow).toBe(visuals.neutralReference.bubbleShadow);
    expect(card.bubbleBackground).not.toBe(visuals.lightNeutral.bubbleBackground);
  }
  expect(visuals.favWarm.bubbleBackground).toBe(visuals.lightWarm.bubbleBackground);
  expect(visuals.favWarm.bubbleShadow).toBe(visuals.lightWarm.bubbleShadow);
  expect(visuals.favWarm.glyphColor).toBe(visuals.lightWarm.glyphColor);
  expect(visuals.favWarm.glyphColor).toBe(visuals.favWarm.bubbleColor);
  expect(visuals.favWarm.glyphColor).not.toBe(visuals.accent);
  expect(visuals.vacuumWarm.bubbleBackground).toBe(visuals.lightWarm.bubbleBackground);
  expect(visuals.vacuumWarm.bubbleShadow).toBe(visuals.lightWarm.bubbleShadow);
  expect(visuals.vacuumWarm.glyphColor).toBe(visuals.lightWarm.glyphColor);
  expect(visuals.vacuumWarm.glyphColor).toBe(visuals.vacuumWarm.bubbleColor);
  expect(visuals.vacuumWarm.glyphColor).not.toBe(visuals.accent);
});

test("Graph keeps glass chrome while value and plot remain open and edge-to-edge", async ({ page }) => {
  await loadBundle(page);
  const visuals = await page.evaluate(async () => {
    document.documentElement.style.setProperty("--ha-card-background", "#f7f8fa");
    document.documentElement.style.setProperty("--primary-text-color", "#1b1d22");
    document.documentElement.style.setProperty("--divider-color", "#d7dbe2");
    document.documentElement.style.setProperty("--ha-card-box-shadow", "0 8px 24px rgba(0, 0, 0, 0.14)");
    const state = {
      entity_id: "sensor.power",
      state: "42",
      attributes: { friendly_name: "Power", unit_of_measurement: "W", device_class: "power" },
    };
    const hass = window.makeHass({ "sensor.power": state });
    const now = Date.now();
    hass.callWS = async message => (
      message?.type === "history/history_during_period"
        ? [[
            { entity_id: "sensor.power", state: "28", last_changed: new Date(now - 7_200_000).toISOString() },
            { entity_id: "sensor.power", state: "52", last_changed: new Date(now - 3_600_000).toISOString() },
            { entity_id: "sensor.power", state: "42", last_changed: new Date(now - 600_000).toISOString() },
          ]]
        : {}
    );
    const card = document.createElement("nodalia-graph-card");
    card.setConfig({
      name: "Power",
      entities: [{ entity: "sensor.power", color: "#71c0ff" }],
      animations: { enabled: false },
    });
    card.hass = hass;
    document.querySelector("#fixture").append(card);
    for (let attempt = 0; attempt < 30 && !card.shadowRoot.querySelector(".graph-card__chart-series-fill"); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    const read = element => {
      const style = getComputedStyle(element);
      return {
        backdrop: style.backdropFilter || style.webkitBackdropFilter,
        background: style.backgroundImage,
        backgroundColor: style.backgroundColor,
        borderRadius: style.borderRadius,
        boxShadow: style.boxShadow,
        padding: style.padding,
      };
    };
    const surfaceNode = card.shadowRoot.querySelector("ha-card");
    const valueNode = card.shadowRoot.querySelector(".graph-card__value");
    const chartNode = card.shadowRoot.querySelector(".graph-card__chart-wrap");
    const svgNode = card.shadowRoot.querySelector(".graph-card__chart");
    const fillNode = card.shadowRoot.querySelector(".graph-card__chart-series-fill");
    const rect = element => {
      const box = element.getBoundingClientRect();
      return { top: box.top, left: box.left, right: box.right, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      surface: read(surfaceNode),
      icon: read(card.shadowRoot.querySelector(".graph-card__icon")),
      value: read(valueNode),
      legend: read(card.shadowRoot.querySelector(".graph-card__legend-item")),
      chart: read(chartNode),
      fill: {
        paint: getComputedStyle(fillNode).fill,
        opacity: getComputedStyle(fillNode).opacity,
        stops: [...card.shadowRoot.querySelectorAll('linearGradient[id^="graph-fill-"] stop')]
          .slice(0, 3)
          .map(stop => stop.getAttribute("stop-opacity")),
      },
      surfaceRect: rect(surfaceNode),
      chartRect: rect(chartNode),
      svgRect: rect(svgNode),
    };
  });

  expect(visuals.surface.background).toContain("linear-gradient");
  expect(visuals.surface.boxShadow).not.toBe("none");
  expect(visuals.icon.borderRadius).toBe("999px");
  for (const primitive of [visuals.icon, visuals.legend]) {
    expect(
      /gradient/.test(primitive.background) || primitive.backgroundColor !== "rgba(0, 0, 0, 0)",
    ).toBe(true);
    expect(primitive.boxShadow).not.toBe("none");
    expect(primitive.backdrop).toMatch(/blur/);
  }
  expect(visuals.value.background).toBe("none");
  expect(visuals.value.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(visuals.value.boxShadow).toBe("none");
  expect(visuals.value.backdrop).toBe("none");
  expect(visuals.value.padding).toBe("0px");
  expect(visuals.chart.background).toBe("none");
  expect(visuals.chart.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(visuals.chart.boxShadow).toBe("none");
  expect(visuals.chart.backdrop).toBe("none");
  expect(visuals.chart.borderRadius).toBe("0px");
  expect(visuals.fill.paint).toContain("url");
  expect(visuals.fill.opacity).toBe("1");
  expect(visuals.fill.stops).toEqual(["0.3", "0.12", "0"]);
  const edgeTolerance = 1.1;
  expect(Math.abs(visuals.chartRect.left - visuals.surfaceRect.left)).toBeLessThanOrEqual(edgeTolerance);
  expect(Math.abs(visuals.chartRect.right - visuals.surfaceRect.right)).toBeLessThanOrEqual(edgeTolerance);
  expect(Math.abs(visuals.chartRect.bottom - visuals.surfaceRect.bottom)).toBeLessThanOrEqual(edgeTolerance);
  expect(Math.abs(visuals.svgRect.left - visuals.chartRect.left)).toBeLessThanOrEqual(edgeTolerance);
  expect(Math.abs(visuals.svgRect.right - visuals.chartRect.right)).toBeLessThanOrEqual(edgeTolerance);
  expect(visuals.chart.padding).toBe("0px");
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
      favBubbleBackground: getComputedStyle(fav.shadowRoot.querySelector(".fav-card__icon")).backgroundColor,
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
  expect(initial.favBubbleBackground).not.toBe("rgba(0, 0, 0, 0)");
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

  // Leave and return with the keyboard. Pressing Enter while still pointer-focused keeps
  // Firefox on the pointer modality, so :focus-visible stays false there.
  await unrelatedButton.focus();
  await page.keyboard.press("Tab");
  await expect(surface).toBeFocused();
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
