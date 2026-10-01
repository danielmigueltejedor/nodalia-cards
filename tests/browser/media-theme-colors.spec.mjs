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
