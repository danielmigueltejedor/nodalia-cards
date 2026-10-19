import { expect, test } from "@playwright/test";

test("Media reads modern translucent theme colors immediately and leaves no color probes", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-media-player"));
  await page.evaluate(() => {
    const card = document.createElement("nodalia-media-player");
    card.setConfig({ entity: "media_player.one", artwork: { mode: "off" }, animations: { enabled: false } });
    card.hass = window.makeHass({ "media_player.one": { state: "paused", attributes: { friendly_name: "One", media_title: "Song" } } });
    document.querySelector("#fixture").append(card);
    window.mediaColorFixture = card;
  });
  await expect(page.locator("nodalia-media-player .media-player-card")).toBeVisible();
  for (const [text, background, expected] of [["color(srgb 0 0 0 / .8)", "color(srgb 1 1 1 / .8)", true], ["rgb(100% 100% 100% / 80%)", "rgb(0% 0% 0% / 80%)", false]]) {
    const result = await page.evaluate(({ text, background }) => {
      const card = window.mediaColorFixture;
      card.style.setProperty("--primary-text-color", text);
      card.style.setProperty("--ha-card-background", background);
      const before = card.shadowRoot.childElementCount;
      const light = card._isLightThemeSurface();
      return { light, before, after: card.shadowRoot.childElementCount };
    }, { text, background });
    expect(result.light).toBe(expected);
    expect(result.after).toBe(result.before);
  }
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test("Media TV keeps control icons on the theme ink while the cover only fills the circular chip", async ({ page }) => {
  await page.route("**/test-artwork.svg*", route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#ffffff"/></svg>',
  }));
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-media-player"));
  const state = {
    entity_id: "media_player.tv",
    state: "playing",
    attributes: { friendly_name: "Living Room TV", media_title: "Show", source: "Plex", entity_picture: "/test-artwork.svg", volume_level: 0.4, supported_features: 1 },
  };
  const mount = config => page.evaluate(({ config, state }) => {
    document.documentElement.style.setProperty("--primary-text-color", "rgb(255, 255, 255)");
    const card = document.createElement("nodalia-media-player");
    card.setConfig(config);
    card.hass = window.makeHass({ "media_player.tv": state });
    document.querySelector("#fixture").replaceChildren(card);
    window.tvMediaFixture = card;
  }, { config, state });
  const card = page.locator("nodalia-media-player");

  // No album fill: the cover only paints the circular chip, so the white cover's
  // dark palette must not reach the controls sitting on the card surface.
  await mount({ players: [{ entity: "media_player.tv", tv_mode: true }], album_cover_background: false, animations: { enabled: false } });
  await expect(card.locator(".media-player-card--tv")).toHaveCount(1);
  await expect(card.locator(".media-player__artwork img")).toHaveCount(1);
  await card.locator(".media-player__artwork img").evaluate(img => img.decode());
  await expect(card.locator("[data-artwork-controls]")).toHaveCount(0);
  await expect(card.locator('[data-media-control="play-pause"]')).toHaveCSS("color", "rgb(255, 255, 255)");

  // Album fill puts the cover behind the controls: the artwork ink applies again.
  await mount({ players: [{ entity: "media_player.tv", tv_mode: true }], animations: { enabled: false } });
  await expect(card.locator(".media-player-card--tv")).toHaveCount(1);
  await expect(card.locator("[data-artwork-controls]")).toHaveCount(1);
  await expect(card.locator('[data-media-control="play-pause"]')).toHaveCSS("color", "rgb(0, 0, 0)");
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test("Navigation media controls keep the theme ink while the cover only fills the circular chip", async ({ page }) => {
  await page.route("**/test-artwork.svg*", route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#ffffff"/></svg>',
  }));
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-navigation-bar"));
  const state = {
    entity_id: "media_player.test",
    state: "playing",
    attributes: { friendly_name: "Speaker", media_title: "Song", entity_picture: "/test-artwork.svg", volume_level: 0.5, supported_features: 1 },
  };
  const mount = albumCoverBackground => page.evaluate(({ albumCoverBackground, state }) => {
    document.documentElement.style.setProperty("--primary-text-color", "rgb(255, 255, 255)");
    const card = document.createElement("nodalia-navigation-bar");
    card.setConfig({
      animations: { enabled: false },
      layout: { fixed: false, show_desktop: true },
      routes: [{ path: "/lovelace/home", label: "Home", icon: "mdi:home" }],
      media_player: { show: true, show_desktop: true, album_cover_background: albumCoverBackground, players: [{ entity: "media_player.test" }] },
    });
    card.hass = window.makeHass({ "media_player.test": state });
    document.querySelector("#fixture").replaceChildren(card);
  }, { albumCoverBackground, state });
  const nav = page.locator("nodalia-navigation-bar");

  // No album fill: the cover only paints the chip, so the controls keep the theme ink.
  await mount(false);
  await nav.locator('[data-media-toggle="expand"]').click();
  await expect(nav.locator(".media-player-card")).toHaveCount(1);
  await expect(nav.locator(".media-player__artwork img")).toHaveCount(1);
  await expect(nav.locator("[data-artwork-controls]")).toHaveCount(0);
  await expect(nav.locator('[data-media-control="play-pause"]')).toHaveCSS("color", "rgb(255, 255, 255)");

  // Album fill puts the cover behind the controls: the artwork ink applies again.
  await mount(true);
  await nav.locator('[data-media-toggle="expand"]').click();
  await expect(nav.locator(".media-player-card .media-player__album-bg")).toHaveCount(1);
  await expect(nav.locator("[data-artwork-controls]")).toHaveCount(1);
  await expect(nav.locator('[data-media-control="play-pause"]')).toHaveCSS("color", "rgb(0, 0, 0)");
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test("Media editor preserves a player row when its entity is cleared and commits the empty placeholder", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-media-player-editor"));
  await page.evaluate(() => {
    const editor = document.createElement("nodalia-media-player-editor");
    editor.setConfig({ players: [{ entity: "media_player.one", label: "One" }] });
    editor.hass = window.makeHass({ "media_player.one": { state: "paused", attributes: { friendly_name: "One" } } });
    editor.addEventListener("config-changed", event => { window.savedMediaConfig = event.detail.config; });
    document.querySelector("#fixture").append(editor);
    window.mediaEditorFixture = editor;
  });
  const editor = page.locator("nodalia-media-player-editor");
  await expect(editor.locator(".player-editor-card")).toHaveCount(1);
  const picker = editor.locator('[data-field="players.0.entity"]').last();
  await picker.evaluate(control => control.dispatchEvent(new CustomEvent("value-changed", { detail: { value: "" }, bubbles: true, composed: true })));
  await expect(editor.locator(".player-editor-card")).toHaveCount(1);
  expect(await page.evaluate(() => window.savedMediaConfig.players[0])).toMatchObject({ entity: "", label: "One" });
  expect(await page.evaluate(() => window.mediaEditorFixture._config.players[0].entity)).toBe("");
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});
