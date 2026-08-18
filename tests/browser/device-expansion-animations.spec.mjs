import { expect, test } from "@playwright/test";

async function loadBundle(page) {
  const errors = [];
  page.on("pageerror", error => errors.push(error.stack || String(error)));
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => Boolean(customElements.get("nodalia-light-card")));
  return errors;
}

const devices = [
  {
    name: "Light",
    tag: "nodalia-light-card",
    entity: "light.gecko_test",
    shell: ".light-card__controls-shell",
    entering: "light-card__controls-shell--entering",
    leaving: "light-card__controls-shell--leaving",
    expandAnimation: "light-card-controls-expand",
    collapseAnimation: "light-card-controls-collapse",
    attributes: {
      friendly_name: "Gecko light",
      supported_color_modes: ["brightness", "color_temp", "hs"],
      brightness: 180,
      color_mode: "brightness",
      color_temp_kelvin: 3600,
      min_color_temp_kelvin: 2200,
      max_color_temp_kelvin: 6500,
    },
  },
  {
    name: "Fan",
    tag: "nodalia-fan-card",
    entity: "fan.gecko_test",
    shell: ".fan-card__controls-shell",
    entering: "fan-card__controls-shell--entering",
    leaving: "fan-card__controls-shell--leaving",
    expandAnimation: "fan-card-controls-expand",
    collapseAnimation: "fan-card-controls-collapse",
    attributes: {
      friendly_name: "Gecko fan",
      percentage: 55,
      percentage_step: 1,
      supported_features: 1,
    },
  },
  {
    name: "Humidifier",
    tag: "nodalia-humidifier-card",
    entity: "humidifier.gecko_test",
    shell: ".humidifier-card__controls-shell",
    entering: "humidifier-card__controls-shell--entering",
    leaving: "humidifier-card__controls-shell--leaving",
    expandAnimation: "humidifier-card-controls-expand",
    collapseAnimation: "humidifier-card-controls-collapse",
    attributes: {
      friendly_name: "Gecko humidifier",
      humidity: 52,
      min_humidity: 30,
      max_humidity: 80,
      supported_features: 1,
    },
  },
];

const HEIGHT_SAMPLE_TOLERANCE_PX = 0.5;
const MIN_TOTAL_HEIGHT_CHANGE_PX = 1;

function expectHeightTrajectory(heights, direction) {
  expect(heights).toHaveLength(3);
  const signedHeights = heights.map(height => height * direction);
  expect(signedHeights[1]).toBeGreaterThanOrEqual(signedHeights[0] - HEIGHT_SAMPLE_TOLERANCE_PX);
  expect(signedHeights[2]).toBeGreaterThanOrEqual(signedHeights[1] - HEIGHT_SAMPLE_TOLERANCE_PX);
  expect(signedHeights[2]).toBeGreaterThan(signedHeights[0] + MIN_TOTAL_HEIGHT_CHANGE_PX);
}

async function sampleAnimation(shell, animationName, expectedClass) {
  return shell.evaluate(async (element, expected) => {
    const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const deadline = performance.now() + 2_000;
    let animation = null;

    while (!animation && performance.now() < deadline) {
      animation = element.getAnimations().find(item => item.animationName === expected.name) || null;
      if (!animation) {
        await nextFrame();
      }
    }

    if (!animation || !animation.effect) {
      return {
        found: false,
        hadExpectedClass: element.classList.contains(expected.className),
        heights: [],
        rows: [],
      };
    }

    const timing = animation.effect.getTiming();
    const duration = Number(timing.duration);
    const delay = Number(timing.delay) || 0;
    const samples = [];

    animation.pause();
    try {
      await animation.ready;
    } catch {
      // A detached animation can reject ready in some WebKit builds. Setting
      // currentTime below still provides deterministic computed-style samples.
    }

    for (const progress of [0.15, 0.5, 0.85]) {
      animation.currentTime = delay + duration * progress;
      await nextFrame();
      samples.push({
        height: element.getBoundingClientRect().height,
        row: getComputedStyle(element).gridTemplateRows,
      });
    }

    animation.play();
    return {
      found: true,
      hadExpectedClass: element.classList.contains(expected.className),
      heights: samples.map(sample => sample.height),
      rows: samples.map(sample => sample.row),
    };
  }, { name: animationName, className: expectedClass });
}

for (const device of devices) {
  test(`${device.name} expands, collapses and settles across browser engines`, async ({ page }) => {
    const errors = await loadBundle(page);
    await page.evaluate(current => {
      const fixture = document.querySelector("#fixture");
      fixture.replaceChildren();
      fixture.style.width = "420px";

      const offState = {
        entity_id: current.entity,
        state: "off",
        attributes: { ...current.attributes },
        last_updated: "2026-08-15T00:00:00.000Z",
      };
      const card = document.createElement(current.tag);
      card.dataset.animationFixture = current.name.toLowerCase();
      card.setConfig({
        entity: current.entity,
        compact_layout_mode: "never",
        animations: {
          enabled: true,
          power_duration: 600,
          controls_duration: 600,
          panel_duration: 600,
          preset_duration: 600,
        },
      });
      window.deviceAnimationHass = window.makeHass({ [current.entity]: offState });
      card.hass = window.deviceAnimationHass;
      fixture.append(card);
    }, device);

    const card = page.locator(`[data-animation-fixture="${device.name.toLowerCase()}"]`);
    await expect(card.locator(device.shell)).toHaveCount(0);

    await page.evaluate(current => {
      const previous = window.deviceAnimationHass.states[current.entity];
      const next = {
        ...previous,
        state: "on",
        attributes: { ...current.attributes },
        last_updated: "2026-08-15T00:00:01.000Z",
      };
      window.deviceAnimationHass = {
        ...window.deviceAnimationHass,
        states: { ...window.deviceAnimationHass.states, [current.entity]: next },
      };
      document.querySelector(`[data-animation-fixture="${current.name.toLowerCase()}"]`).hass = window.deviceAnimationHass;
    }, device);

    const openingShell = card.locator(device.shell);
    const opening = await sampleAnimation(openingShell, device.expandAnimation, device.entering);
    expect(opening.found).toBe(true);
    expect(opening.hadExpectedClass).toBe(true);
    expectHeightTrajectory(opening.heights, 1);
    expect(opening.rows[0]).not.toBe(opening.rows[2]);

    await page.waitForTimeout(220);
    await expect(card.locator(device.shell)).toHaveCount(1);
    await expect(card.locator(device.shell)).not.toHaveClass(new RegExp(device.entering));

    await page.evaluate(current => {
      const previous = window.deviceAnimationHass.states[current.entity];
      const next = {
        ...previous,
        state: "off",
        last_updated: "2026-08-15T00:00:02.000Z",
      };
      window.deviceAnimationHass = {
        ...window.deviceAnimationHass,
        states: { ...window.deviceAnimationHass.states, [current.entity]: next },
      };
      document.querySelector(`[data-animation-fixture="${current.name.toLowerCase()}"]`).hass = window.deviceAnimationHass;
    }, device);

    const closingShell = card.locator(device.shell);
    const closing = await sampleAnimation(closingShell, device.collapseAnimation, device.leaving);
    expect(closing.found).toBe(true);
    expect(closing.hadExpectedClass).toBe(true);
    expectHeightTrajectory(closing.heights, -1);

    await page.waitForTimeout(220);
    await expect(card.locator(device.shell)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test("visual editors render and persist individual scroll haptic toggles", async ({ page }) => {
  const errors = await loadBundle(page);
  const result = await page.evaluate(async () => {
    const fixtures = [
      { tag: "nodalia-light-card", entity: "light.test", fields: ["brightness", "temperature", "color"] },
      { tag: "nodalia-fan-card", entity: "fan.test", fields: ["percentage"] },
      { tag: "nodalia-humidifier-card", entity: "humidifier.test", fields: ["humidity"] },
      { tag: "nodalia-climate-card", entity: "climate.test", fields: ["temperature_dial"] },
      { tag: "nodalia-cover-card", entity: "cover.test", fields: ["position", "tilt"] },
    ];
    const states = Object.fromEntries(fixtures.map(item => [item.entity, {
      entity_id: item.entity,
      state: "off",
      attributes: { friendly_name: item.tag },
    }]));
    const hass = window.makeHass(states);
    const records = [];

    for (const fixture of fixtures) {
      const ctor = customElements.get(fixture.tag);
      const editor = await ctor.getConfigElement();
      editor.hass = hass;
      editor.setConfig({
        type: `custom:${fixture.tag}`,
        entity: fixture.entity,
        haptics: {
          enabled: true,
          scrolls: Object.fromEntries(fixture.fields.map(field => [field, true])),
        },
      });
      document.querySelector("#fixture").append(editor);
      await Promise.resolve();

      const controls = fixture.fields.map(field => {
        const input = editor.shadowRoot?.querySelector(`[data-field="haptics.scrolls.${field}"]`);
        return {
          field,
          exists: input instanceof HTMLInputElement,
          checked: input instanceof HTMLInputElement ? input.checked : null,
          label: input?.closest("label")?.textContent?.replace(/\s+/g, " ").trim() || "",
        };
      });

      let changedConfig = null;
      editor.addEventListener("config-changed", event => {
        changedConfig = event.detail?.config || null;
      }, { once: true });
      const firstControl = editor.shadowRoot
        ?.querySelector(`[data-field="haptics.scrolls.${fixture.fields[0]}"]`);
      if (firstControl instanceof HTMLInputElement) {
        firstControl.checked = false;
        firstControl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      }
      records.push({
        tag: fixture.tag,
        controls,
        persisted: changedConfig?.haptics?.scrolls?.[fixture.fields[0]] === false,
      });
      editor.remove();
    }

    return records;
  });

  for (const editor of result) {
    expect(editor.persisted, `${editor.tag} should persist its scroll haptic toggle`).toBe(true);
    for (const control of editor.controls) {
      expect(control.exists, `${editor.tag}:${control.field}`).toBe(true);
      expect(control.checked, `${editor.tag}:${control.field}`).toBe(true);
      expect(control.label, `${editor.tag}:${control.field}`).not.toMatch(/^ed\./);
    }
  }
  expect(errors).toEqual([]);
});
