import { expect, test } from "@playwright/test";

for (const mode of ["auto", "compact", "square", "artwork"]) {
  test(`Idle ${mode} media keeps browse and playback separate in half-width tiles`, async ({ page }) => {
    await page.goto("/tests/fixtures/browser.html");
    await page.waitForFunction(() => customElements.get("nodalia-media-player"));
    await page.evaluate(mode => {
      window.calls = []; window.browserCalls = [];
      window.hass = window.makeHass({ "media_player.nabu": {
        entity_id: "media_player.nabu", state: "idle",
        attributes: { friendly_name: "Nabu", supported_features: 2048 },
      } });
      window.hass.callService = async (domain, service, data) => window.calls.push({ domain, service, data });
      window.hass.callWS = async request => {
        window.browserCalls.push(request);
        return { title: "Library", media_content_id: "", media_content_type: "directory", can_expand: true, can_play: false, children: [] };
      };
      const card = document.createElement("nodalia-media-player");
      card.setConfig({ entity: "media_player.nabu", grid_options: { columns: 6 }, layout: { mode }, animations: { enabled: false } });
      card.hass = window.hass; document.querySelector("#fixture").append(card); window.card = card;
    }, mode);
    const card = page.locator("nodalia-media-player");
    for (const width of [184, 220, 300]) {
      await card.evaluate((element, width) => { element.style.width = `${width}px`; }, width);
      for (const state of ["idle", "paused", "off"]) {
        await page.evaluate(state => {
          window.hass.states["media_player.nabu"] = { entity_id: "media_player.nabu", state,
            attributes: { friendly_name: "Nabu", supported_features: 2048, ...(state === "off" ? { volume_level: 0 } : {}) } };
          window.card.hass = window.hass;
        }, state);
        await expect(card.locator(".media-player-card--idle")).toBeVisible();
        await expect.poll(() => card.evaluate(element => {
          const root = element.shadowRoot;
          const play = root.querySelector('[data-media-control="play"]').getBoundingClientRect();
          const browse = root.querySelector('[data-media-control="browse-media"]').getBoundingClientRect();
          const name = root.querySelector(".media-player__idle-name").getBoundingClientRect();
          const surface = root.querySelector(".media-player-card").getBoundingClientRect();
          const overlap = Math.max(0, Math.min(play.right, browse.right) - Math.max(play.left, browse.left))
            * Math.max(0, Math.min(play.bottom, browse.bottom) - Math.max(play.top, browse.top));
          return { overlap, contained: [play, browse].every(rect => rect.left >= surface.left && rect.right <= surface.right && rect.top >= surface.top && rect.bottom <= surface.bottom), visible: play.width > 0 && browse.width > 0 && name.width > 20 };
        }), { message: `${mode}, ${width}px, ${state}` }).toEqual({ overlap: 0, contained: true, visible: true });
      }
      await card.locator('[data-media-control="play"]').click();
      await card.locator('[data-media-control="browse-media"]').click();
      await expect(card.getByRole("dialog")).toBeVisible();
      await card.locator('.media-browser__header-button[data-media-browser-close="true"]').click();
    }
    expect(await page.evaluate(() => window.calls)).toEqual(Array.from({ length: 3 }, () => ({ domain: "media_player", service: "media_play", data: { entity_id: "media_player.nabu" } })));
    expect(await page.evaluate(() => window.browserCalls)).toEqual(Array.from({ length: 3 }, () => ({ type: "media_player/browse_media", entity_id: "media_player.nabu" })));
  });
}
