import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function mountLock(page, config = {}, state = "locked") {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-lock-card"));
  await page.evaluate(({ config, state }) => {
    window.calls = [];
    window.lockState = value => ({ entity_id: "lock.front", state: value, attributes: { friendly_name: "Front Door" } });
    window.hass = window.makeHass({ "lock.front": window.lockState(state) });
    window.hass.callService = async (domain, service, data) => { window.calls.push({ domain, service, data }); };
    window.card = document.createElement("nodalia-lock-card");
    window.card.setConfig({ entity: "lock.front", ...config });
    window.card.hass = window.hass;
    document.querySelector("#fixture").append(window.card);
  }, { config, state });
  return page.locator("nodalia-lock-card");
}
async function drag(page, card, fraction = 1, release = true) {
  await expect(card.locator("[data-handle]")).toHaveCSS("left", "4px");
  const thumb = await card.locator("[data-handle]").boundingBox();
  const track = await card.locator("[role=slider]").boundingBox();
  const x = thumb.x + thumb.width / 2, y = thumb.y + thumb.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + (track.width - thumb.width - 10) * fraction, y, { steps: 12 });
  if (release) await page.mouse.up();
}
for (const layout of ["standard", "compact"]) {
  test(`Lock ${layout}: taps and partial slides cancel; full drag unlocks once`, async ({ page }) => {
    const card = await mountLock(page, { layout });
    const slider = card.locator("[role=slider]");
    await slider.click({ position: { x: 140, y: 24 } });
    await drag(page, card, 0.5);
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
    expect(await page.evaluate(() => window.calls)).toEqual([]);
    await drag(page, card, 1);
    await expect.poll(() => page.evaluate(() => window.calls)).toEqual([
      { domain: "lock", service: "unlock", data: { entity_id: "lock.front" } },
    ]);
    await expect(slider).toHaveAttribute("aria-disabled", "true");
    await slider.click({ force: true });
    expect(await page.evaluate(() => window.calls.length)).toBe(1);
    await page.evaluate(() => {
      window.hass.states["lock.front"] = window.lockState("unlocked"); window.card.hass = window.hass;
    });
    await card.getByRole("button", { name: "Lock", exact: true }).click();
    expect(await page.evaluate(() => window.calls.at(-1).service)).toBe("lock");
    await expect(card.getByRole("button")).toBeDisabled();
  });
}

test("Lock cancels pointer loss, state changes and removal without an unlock", async ({ page }) => {
  const card = await mountLock(page);
  await drag(page, card, 1, false);
  await card.locator("[data-handle]").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(card.locator("[role=slider]")).toHaveAttribute("aria-valuenow", "0");
  await drag(page, card, 1, false);
  await page.evaluate(() => { window.hass.states["lock.front"] = window.lockState("unavailable"); window.card.hass = window.hass; });
  await page.mouse.up();
  await expect(card.locator("[role=slider]")).toHaveAttribute("aria-disabled", "true");
  await page.evaluate(() => { window.hass.states["lock.front"] = window.lockState("locked"); window.card.hass = window.hass; });
  await drag(page, card, 1, false);
  await page.evaluate(() => window.card.remove());
  await page.mouse.up();
  expect(await page.evaluate(() => window.calls)).toEqual([]);
});

test("Lock keyboard needs deliberate progress and confirmation; accessibility is valid", async ({ page }) => {
  const card = await mountLock(page);
  const slider = card.getByRole("slider");
  await slider.focus(); await slider.press("End"); await slider.press("Enter"); await slider.press("Space");
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  for (let i = 0; i < 5; i++) await slider.press("ArrowRight");
  await slider.press("Escape");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  const axe = await new AxeBuilder({ page }).include("nodalia-lock-card").withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
  for (let i = 0; i < 10; i++) await slider.press("ArrowRight");
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  await slider.press("Enter");
  expect(await page.evaluate(() => window.calls.length)).toBe(1);
});

test("Lock shows service errors, times out safely and disables transitional states", async ({ page }) => {
  const card = await mountLock(page, {}, "unlocked");
  await page.evaluate(() => { window.hass.callService = async () => { throw new Error("Device rejected"); }; });
  await card.getByRole("button").click();
  await expect(card.getByRole("alert")).toContainText("command failed");
  await expect(card.getByRole("button")).toBeEnabled();
  await page.clock.install();
  await page.evaluate(() => { window.hass.callService = async () => {}; });
  await card.getByRole("button").click();
  await expect(card.getByRole("button")).toBeDisabled();
  await page.clock.fastForward(15001);
  await expect(card.getByRole("alert")).toContainText("No confirmation");
  for (const state of ["locking", "unlocking", "jammed", "unavailable", "unknown"]) {
    await page.evaluate(state => { window.hass.states["lock.front"] = window.lockState(state); window.card.hass = window.hass; }, state);
    await expect(card.getByRole("slider")).toHaveAttribute("aria-disabled", "true");
  }
});

test("Lock editor saves layout, entity and visibility settings", async ({ page }) => {
  await mountLock(page);
  await page.evaluate(async () => {
    const editor = await customElements.get("nodalia-lock-card").getConfigElement();
    editor.hass = window.hass; editor.setConfig({ entity: "lock.front" });
    editor.addEventListener("config-changed", event => { window.savedConfig = event.detail.config; });
    document.querySelector("#fixture").append(editor);
  });
  const editor = page.locator("nodalia-lock-card-editor");
  await editor.locator("select").selectOption("compact");
  await editor.locator('[data-field="show_state"]').uncheck();
  await editor.locator('[data-field="name"]').fill("Side Door");
  await editor.locator('[data-field="name"]').blur();
  expect(await page.evaluate(() => window.savedConfig)).toMatchObject({ entity: "lock.front", layout: "compact", show_state: false, name: "Side Door" });
});

async function mountMedia(page, color) {
  await page.route("**/test-artwork.svg*", route => route.fulfill({
    contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="${color}"/></svg>`,
  }));
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-navigation-bar"));
  await page.evaluate(color => {
    document.documentElement.style.setProperty("--primary-text-color", "#fff");
    const artwork = "/test-artwork.svg";
    window.calls = [];
    window.hass = window.makeHass({ "media_player.test": { entity_id: "media_player.test", state: "playing", attributes: { friendly_name: "Media", media_title: "Song", entity_picture: artwork, volume_level: 0.5, supported_features: 1 } } });
    window.hass.callService = async (domain, service, data) => window.calls.push({ domain, service, data });
    for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) {
      const card = document.createElement(tag);
      card.setConfig(tag === "nodalia-navigation-bar" ? {
        layout: { fixed: false, show_desktop: true }, routes: [{ icon: "mdi:home", path: "/" }],
        media_player: { show: true, show_desktop: true, players: [{ entity: "media_player.test" }] },
      } : { entity: "media_player.test" });
      card.hass = window.hass; document.querySelector("#fixture").append(card);
    }
  }, color);
  const nav = page.locator("nodalia-navigation-bar");
  await nav.locator('[data-media-toggle="expand"]').click();
  return nav;
}

test("Expanded Navigation artwork does not intercept playback, volume or collapse", async ({ page }) => {
  const nav = await mountMedia(page, "#ac5522");
  for (const control of ["previous", "play-pause", "next", "volume-up", "volume-down"]) await nav.locator(`[data-media-control="${control}"]`).click();
  expect(await page.evaluate(() => window.calls.map(call => call.service))).toEqual([
    "media_previous_track", "media_play_pause", "media_next_track", "volume_set", "volume_set",
  ]);
  await nav.locator('[data-media-toggle="collapse"]').click();
  await expect(nav.locator(".media-player-card")).toHaveCount(0);
});

for (const color of ["#ffffff", "#000000", "#00ff00", "#0000ff"]) {
  test(`Both players derive readable control colors from ${color}`, async ({ page }) => {
    await mountMedia(page, color);
    for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) {
      const card = page.locator(tag);
      await expect(card.locator("[data-artwork-controls]")).toHaveCount(1);
      const contrast = await card.locator('[data-media-control="play-pause"]').evaluate(button => {
        const luminance = rgb => rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
          const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
        const style = getComputedStyle(button);
        const a = luminance(style.color), b = luminance(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(contrast).toBeGreaterThanOrEqual(4.5);
    }
    await page.evaluate(() => {
      const entity = window.hass.states["media_player.test"];
      window.hass.states["media_player.test"] = { ...entity, attributes: { ...entity.attributes, entity_picture: "" } };
      for (const card of document.querySelectorAll("nodalia-navigation-bar, nodalia-media-player")) card.hass = window.hass;
    });
    await expect(page.locator("[data-artwork-controls]")).toHaveCount(0);
  });
}

test("Media controls remain circular across compact and artwork layouts", async ({ page }) => {
  await mountMedia(page, "#ac5522");
  const mismatches = [];
  for (const mode of ["standard", "square", "artwork", "compact", "chip", "auto"]) {
    await page.evaluate(mode => {
      const card = document.querySelector("nodalia-media-player");
      card.style.width = "300px";
      card.setConfig({ entity: "media_player.test", layout: { mode, fixed: false }, grid_options: { columns: 6, rows: 2 }, animations: { enabled: false } });
    }, mode);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const sizes = await page.locator("nodalia-media-player").locator(".media-player__control, .media-player__volume-button").evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return { control: button.dataset.mediaControl, width: rect.width, height: rect.height };
    }).filter(rect => rect.width > 0 && rect.height > 0));
    expect(sizes.length, mode).toBeGreaterThanOrEqual(3);
    mismatches.push(...sizes.filter(rect => Math.abs(rect.width - rect.height) > 0.5).map(rect => ({ mode, ...rect })));
  }
  const navSizes = await page.locator("nodalia-navigation-bar").locator(".media-player__control, .media-player__volume-button").evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { control: button.dataset.mediaControl, width: rect.width, height: rect.height };
  }));
  mismatches.push(...navSizes.filter(rect => Math.abs(rect.width - rect.height) > 0.5).map(rect => ({ mode: "navigation", ...rect })));
  expect(mismatches).toEqual([]);
});
