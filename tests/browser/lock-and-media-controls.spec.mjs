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
  await editor.locator('[data-field="show_state"]').focus();
  await editor.locator('[data-field="show_state"]').press("Space");
  await editor.locator('[data-field="name"]').fill("Side Door");
  await editor.locator('[data-field="name"]').blur();
  expect(await page.evaluate(() => window.savedConfig)).toMatchObject({ entity: "lock.front", layout: "compact", show_state: false, name: "Side Door" });
});

async function mountMedia(page, color, artworkReady = Promise.resolve()) {
  await page.route("**/test-artwork.svg*", async route => { await artworkReady; return route.fulfill({
    contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="${color}"/></svg>`,
  }); });
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
  test(`Both players keep translucent, blurred controls with artwork tint from ${color}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mountMedia(page, color);
    for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) {
      const card = page.locator(tag);
      await expect(card.locator("[data-artwork-controls]")).toHaveCount(1);
      const surfaces = await card.locator('.media-player__control, .media-player__volume-button, .media-player__chip, .media-player__collapse').evaluateAll(buttons => buttons.map(button => {
        const style = getComputedStyle(button);
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        context.fillStyle = style.backgroundColor; context.fillRect(0, 0, 1, 1);
        return { alpha: context.getImageData(0, 0, 1, 1).data[3] / 255, blur: style.backdropFilter || style.webkitBackdropFilter };
      }));
      expect(surfaces.length).toBeGreaterThanOrEqual(3);
      for (const surface of surfaces) {
        expect(surface.alpha).toBeGreaterThan(0.15);
        expect(surface.alpha).toBeLessThan(0.35);
        expect(surface.blur).toContain("blur(");
      }
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

test("Lock and Media Player use the Nodalia icon bubble and state-chip styling", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mountMedia(page, "#ac5522");
  await page.evaluate(() => {
    const states = { ...window.hass.states, "lock.front": { entity_id: "lock.front", state: "unlocked", attributes: { friendly_name: "Front door" } }, "sensor.test": { entity_id: "sensor.test", state: "idle", attributes: { friendly_name: "Reference" } } };
    const hass = window.makeHass(states);
    for (const [tag, config] of [
      ["nodalia-fav-card", { entity: "sensor.test" }],
      ["nodalia-lock-card", { entity: "lock.front", layout: "compact" }],
      ["nodalia-lock-card", { entity: "lock.front", layout: "standard", name: "Main entrance" }],
    ]) {
      const card = document.createElement(tag); card.setConfig(config); card.hass = config.layout === "standard" ? window.makeHass({ ...states, "lock.front": { ...states["lock.front"], state: "locked" } }) : hass;
      document.querySelector("#fixture").append(card);
    }
    document.querySelector("nodalia-media-player").setConfig({ entity: "media_player.test", layout: { mode: "compact" }, animations: { enabled: false } });
    document.querySelector("#fixture").style.maxWidth = "320px";
  });
  for (const light of [false, true]) {
    await page.evaluate(light => {
      const root = document.documentElement;
      root.style.setProperty("--primary-text-color", light ? "#212121" : "#f4f4f4");
      root.style.setProperty("--secondary-text-color", light ? "#555" : "#aeb6c5");
      root.style.setProperty("--ha-card-background", light ? "#fff" : "#20242b");
      root.style.setProperty("--divider-color", light ? "#ddd" : "#414957");
      root.style.setProperty("--ha-card-box-shadow", "0 8px 24px rgba(0,0,0,.2)");
    }, light);
    const readStyles = () => page.evaluate(() => {
      const read = element => {
        const css = getComputedStyle(element);
        return { background: css.backgroundColor, border: css.border, radius: css.borderRadius, shadow: css.boxShadow };
      };
      const reference = document.querySelector("nodalia-fav-card").shadowRoot;
      const media = document.querySelector("nodalia-media-player").shadowRoot;
      const lock = document.querySelector("nodalia-lock-card").shadowRoot;
      return {
        reference: read(reference.querySelector(".fav-card__icon")),
        media: read(media.querySelector(".media-player__artwork")),
        lock: read(lock.querySelector(".icon")),
        title: getComputedStyle(lock.querySelector(".name")).fontSize,
        stateRadius: getComputedStyle(lock.querySelector(".state")).borderRadius,
        stateSize: getComputedStyle(lock.querySelector(".state")).fontSize,
        surfaceShadow: getComputedStyle(lock.querySelector("ha-card")).boxShadow,
        referenceShadow: getComputedStyle(reference.querySelector("ha-card")).boxShadow,
      };
    });
    await expect.poll(async () => {
      const current = await readStyles();
      return JSON.stringify(current.media) === JSON.stringify(current.reference) && JSON.stringify(current.lock) === JSON.stringify(current.reference);
    }).toBe(true);
    const styles = await readStyles();
    expect(styles.media).toEqual(styles.reference);
    expect(styles.lock).toEqual(styles.reference);
    expect(styles.title).toBe("13px");
    expect(styles.stateRadius).toBe("999px");
    expect(styles.stateSize).toBe("11px");
    expect(styles.surfaceShadow).toBe(styles.referenceShadow);
    await page.screenshot({ path: testInfo.outputPath(`card-family-${light ? "light" : "dark"}.png`), fullPage: true });
  }
});

test("Media capsules and selectors stay translucent from their first themed paint and after a track change", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  let releaseArtwork;
  const artworkReady = new Promise(resolve => { releaseArtwork = resolve; });
  await mountMedia(page, "#ac5522", artworkReady);
  await page.evaluate(() => {
    window.hass.states["media_player.second"] = { ...window.hass.states["media_player.test"], entity_id: "media_player.second" };
    const players = [{ entity: "media_player.test" }, { entity: "media_player.second" }];
    const media = document.querySelector("nodalia-media-player");
    media.setConfig({ players, animations: { enabled: false } }); media.hass = window.hass;
    const nav = document.querySelector("nodalia-navigation-bar");
    nav.setConfig({ layout: { fixed: false, show_desktop: true }, routes: [{ icon: "mdi:home", path: "/" }], media_player: { show: true, show_desktop: true, players } }); nav.hass = window.hass;
  });
  const expand = page.locator("nodalia-navigation-bar").locator('[data-media-toggle="expand"]');
  if (await expand.isVisible()) await expand.click();
  const check = async () => {
    for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) {
      const card = page.locator(tag);
      const result = await card.evaluate(element => {
        const root = element.shadowRoot;
        const controls = [...root.querySelectorAll('.media-player__transport .media-player__control')];
        const read = node => {
          const style = getComputedStyle(node), rect = node.getBoundingClientRect();
          const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
          const ctx = canvas.getContext("2d"); ctx.fillStyle = style.backgroundColor; ctx.fillRect(0, 0, 1, 1);
          return { alpha: ctx.getImageData(0, 0, 1, 1).data[3] / 255, width: rect.width, height: rect.height, border: style.border, background: style.backgroundColor, shadow: style.boxShadow, blur: style.backdropFilter || style.webkitBackdropFilter, color: style.color };
        };
        const transport = root.querySelector('.media-player__transport');
        return { controls: controls.map(read), containers: [transport, root.querySelector('.media-player__dots'), ...root.querySelectorAll('.media-player__chip, .media-player__collapse')].map(read), display: getComputedStyle(transport).display };
      });
      expect(["flex", "inline-flex"]).toContain(result.display);
      expect(result.controls).toHaveLength(3);
      const {width: referenceWidth, height: referenceHeight, ...referenceStyle} = result.controls[0];
      for (const control of result.controls) {
        const {width, height, ...style} = control;
        expect(style).toEqual(referenceStyle);
        expect(width).toBeCloseTo(referenceWidth, 2);
        expect(height).toBeCloseTo(referenceHeight, 2);
        expect(width).toBeCloseTo(height, 2);
      }
      for (const surface of [...result.controls, ...result.containers]) {
        expect(surface.alpha).toBeGreaterThan(0.15); expect(surface.alpha).toBeLessThan(0.35);
        expect(surface.blur).toContain('blur(');
        expect(surface.background).toBe(referenceStyle.background);
        expect(surface.color).toBe(referenceStyle.color);
      }
    }
  };
  for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) {
    await expect(page.locator(tag).locator('.media-player-card')).toHaveCount(0);
  }
  releaseArtwork();
  for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) await expect(page.locator(tag).locator('[data-artwork-controls]')).toHaveCount(1);
  await check();
  await page.route('**/next-cover.svg*', route => route.abort());
  await page.evaluate(() => {
    const entity = window.hass.states["media_player.test"];
    window.hass.states["media_player.test"] = { ...entity, attributes: { ...entity.attributes, media_title: "Next song", entity_picture: "/next-cover.svg" } };
    for (const card of document.querySelectorAll('nodalia-media-player, nodalia-navigation-bar')) card.hass = window.hass;
  });
  await check();
});

test("Lock is suggested by entity and its editor keeps focus during state updates", async ({ page }) => {
  await mountLock(page);
  const suggestions = await page.evaluate(() => {
    const metadata = window.customCards.find(card => card.type === 'nodalia-lock-card');
    const hass = window.makeHass({ 'lock.front': { state: 'locked', attributes: {} }, 'light.test': { state: 'off', attributes: {} } });
    return [metadata.getEntitySuggestion(hass, 'lock.front'), metadata.getEntitySuggestion(hass, 'light.test')];
  });
  expect(suggestions[0].config).toEqual({ type: 'custom:nodalia-lock-card', entity: 'lock.front' });
  expect(suggestions[1]).toBeNull();
  await page.evaluate(() => {
    const editor = document.createElement('nodalia-lock-card-editor');
    editor.hass = window.makeHass({}); editor.setConfig({ entity: 'lock.front' }); document.querySelector('#fixture').append(editor);
  });
  const editor = page.locator('nodalia-lock-card-editor');
  await expect(editor.locator('.editor-section')).toHaveCount(3);
  await editor.locator('[data-field="name"]').fill('My door');
  await page.evaluate(() => { document.querySelector('nodalia-lock-card-editor').hass = window.makeHass({}); });
  await expect(editor.locator('[data-field="name"]')).toBeFocused();
  await expect(editor.locator('[data-field="name"]')).toHaveValue('My door');
});

test("Lock icon glyphs are centered inside the state and slide bubbles", async ({ page }) => {
  for (const layout of ['standard', 'compact']) {
    const card = await mountLock(page, { layout });
    const offsets = await card.evaluate(element => {
      // Model ha-icon > ha-svg-icon: an inline-flex child aligned to the text middle.
      return [...element.shadowRoot.querySelectorAll('.icon ha-icon, .handle ha-icon')].map(icon => {
        icon.attachShadow({ mode: 'open' }).innerHTML = '<span style="display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)"><svg xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:100%" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg></span>';
        const glyph = icon.shadowRoot.querySelector('svg').getBoundingClientRect();
        const bubble = icon.parentElement.getBoundingClientRect();
        return { x: Math.abs(glyph.x + glyph.width / 2 - bubble.x - bubble.width / 2), y: Math.abs(glyph.y + glyph.height / 2 - bubble.y - bubble.height / 2) };
      });
    });
    expect(offsets).toHaveLength(2);
    for (const offset of offsets) {
      expect(offset.x).toBeLessThan(0.5);
      expect(offset.y).toBeLessThan(0.5);
    }
  }
});

test("Playback capsule stays at the card center with asymmetric auxiliary controls", async ({ page }) => {
  await mountMedia(page, '#ac5522');
  for (const width of [300, 480, 700]) {
    for (const tag of ['nodalia-media-player', 'nodalia-navigation-bar']) {
      const result = await page.locator(tag).evaluate((element, width) => {
        element.style.width = `${width}px`;
        const root = element.shadowRoot;
        const end = root.querySelector('.media-player__transport-side--end');
        if (!end.querySelector('[data-extra]')) {
          const auxiliary = root.querySelector('.media-player__volume-button').cloneNode(true);
          auxiliary.dataset.extra = ''; end.append(auxiliary);
        }
        const surface = root.querySelector('.media-player-card').getBoundingClientRect();
        const capsule = root.querySelector('.media-player__transport').getBoundingClientRect();
        return { offset: Math.abs(capsule.x + capsule.width / 2 - surface.x - surface.width / 2), inside: capsule.left >= surface.left && capsule.right <= surface.right };
      }, width);
      expect(result.offset).toBeLessThan(1);
      expect(result.inside).toBe(true);
    }
  }
});

test("Dashboard remounts paint tinted controls from the first animated frame", async ({ page }) => {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route("**/first-view-cover.svg*", async route => {
    await ready;
    await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#0000ff"/></svg>' });
  });
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-media-player"));
  await page.evaluate(() => {
    window.firstPaintTints = [];
    window.viewHass = window.makeHass({ "media_player.test": { state: "playing", attributes: { friendly_name: "Media", media_title: "Song", entity_picture: "/first-view-cover.svg" } } });
    window.mountViewPlayers = () => {
      for (const tag of ["nodalia-media-player", "nodalia-navigation-bar"]) {
        const card = document.createElement(tag);
        new MutationObserver(() => {
          const surface = card.shadowRoot.querySelector(".media-player-card");
          if (surface) window.firstPaintTints.push({ tag, tint: surface.style.getPropertyValue("--media-control-tint") });
        }).observe(card.shadowRoot, { subtree: true, childList: true, attributes: true });
        card.setConfig(tag === "nodalia-media-player"
          ? { entity: "media_player.test", layout: { fixed: false, show_desktop: true }, animations: { enabled: true } }
          : { layout: { fixed: false, show_desktop: true }, routes: [{ icon: "mdi:home", path: "/" }], media_player: { show: true, show_desktop: true, players: [{ entity: "media_player.test" }] }, animations: { enabled: true } });
        card.hass = window.viewHass;
        document.querySelector("#fixture").append(card);
        card.shadowRoot.querySelector('[data-media-toggle="expand"]')?.click();
      }
    };
    window.mountViewPlayers();
  });
  await page.waitForTimeout(100);
  release();
  const players = page.locator("nodalia-media-player, nodalia-navigation-bar");
  await expect.poll(() => players.evaluateAll(cards => cards.every(card =>
    card.shadowRoot.querySelector("[data-artwork-controls]")?.style.getPropertyValue("--media-control-tint") === "rgb(0, 0, 255)"
  ))).toBe(true);
  expect(await page.evaluate(() => window.firstPaintTints.every(row => row.tint === "rgb(0, 0, 255)"))).toBe(true);
  const restored = await page.evaluate(() => {
    document.querySelectorAll("nodalia-media-player, nodalia-navigation-bar").forEach(card => card.remove());
    let imageRequests = 0;
    const NativeImage = window.Image;
    window.Image = class extends NativeImage { constructor(...args) { super(...args); imageRequests++; } };
    window.firstPaintTints = [];
    window.mountViewPlayers();
    const result = [...document.querySelectorAll("nodalia-media-player, nodalia-navigation-bar")].map(card => ({
      tint: card.shadowRoot.querySelector(".media-player-card")?.style.getPropertyValue("--media-control-tint"),
      entering: Boolean(card.shadowRoot.querySelector(".media-player__content--entering")),
    }));
    window.Image = NativeImage;
    return { result, imageRequests };
  });
  expect(restored.result.map(row => row.tint)).toEqual(["rgb(0, 0, 255)", "rgb(0, 0, 255)"]);
  expect(restored.result[0].entering).toBe(true);
  expect(restored.imageRequests).toBe(0);
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test("Dashboard entrance preserves the artwork glass while controls move into place", async ({ page, browserName }) => {
  await page.route("**/entrance-glass.svg*", route => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><defs><pattern id="stripes" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#f00"/><rect width="10" height="20" fill="#00f"/></pattern></defs><rect width="600" height="300" fill="url(#stripes)"/></svg>',
  }));
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-media-player"));
  await page.evaluate(() => {
    window.glassHass = window.makeHass({ "media_player.test": { state: "playing", attributes: {
      media_title: "Glass entrance", entity_picture: "/entrance-glass.svg",
    } } });
    window.mountGlassPlayer = mode => {
      document.querySelector("#fixture").replaceChildren();
      const card = document.createElement("nodalia-media-player");
      card.style.width = "360px";
      card.setConfig({ entity: "media_player.test", layout: { mode, fixed: false }, animations: { enabled: true, panel_duration: 1000 } });
      card.hass = window.glassHass;
      document.querySelector("#fixture").append(card);
      return card;
    };
    window.mountGlassPlayer("standard");
  });
  await page.locator("[data-artwork-controls]").waitFor();
  for (const mode of ["standard", "compact", "square", "chip", "artwork"]) {
    let settledContrast;
    for (const fraction of [1, 0.05, 0.5]) {
      const phase = await page.evaluate(({ mode, fraction }) => {
        const card = window.mountGlassPlayer(mode);
        const content = card.shadowRoot.querySelector(".media-player__content");
        const surface = card.shadowRoot.querySelector(".media-player-card");
        const animation = surface.getAnimations()[0] || content.getAnimations()[0];
        animation.pause();
        animation.currentTime = Number(animation.effect.getTiming().duration) * fraction;
        const control = card.shadowRoot.querySelector('[data-media-control="play-pause"]');
        const ancestors = [];
        for (let parent = control.parentElement; parent && !parent.matches(".media-player-card"); parent = parent.parentElement) {
          const style = getComputedStyle(parent);
          ancestors.push({ opacity: style.opacity, filter: style.filter, willChange: style.willChange });
        }
        return { ancestors, background: getComputedStyle(control).backgroundColor, transform: getComputedStyle(surface).transform };
      }, { mode, fraction });
      // Read the actual rendered pixels: without backdrop blur, the sharp cover
      // stripes remain visible inside the button despite a correct tint variable.
      const shot = await page.locator("nodalia-media-player").locator('[data-media-control="play-pause"]').screenshot({ animations: "allow" });
      const contrast = await page.evaluate(async data => {
        const image = new Image();
        image.src = `data:image/png;base64,${data}`;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(Math.floor(image.width * 0.3), Math.floor(image.height * 0.3), Math.floor(image.width * 0.4), Math.floor(image.height * 0.4)).data;
        const reds = [], blues = [];
        for (let index = 0; index < pixels.length; index += 4) { reds.push(pixels[index]); blues.push(pixels[index + 2]); }
        return Math.max(Math.max(...reds) - Math.min(...reds), Math.max(...blues) - Math.min(...blues));
      }, shot.toString("base64"));
      // Software WebKit can omit backdrop rasterization altogether. Compare its
      // entrance to its own settled pixels; Chromium also verifies actual blur.
      if (fraction === 1) settledContrast = contrast;
      else expect(Math.abs(contrast - settledContrast), `${mode} at ${fraction}: rendered glass matches its settled appearance`).toBeLessThan(12);
      if (browserName === "chromium") expect(contrast, `${mode} at ${fraction}: rendered glass blurs the cover immediately`).toBeLessThan(60);
      for (const ancestor of phase.ancestors) {
        expect(ancestor.opacity, `${mode} at ${fraction}: glass must keep sampling the cover`).toBe("1");
        expect(ancestor.filter).toBe("none");
        expect(ancestor.willChange).not.toMatch(/opacity|filter/);
      }
      expect(phase.background).toMatch(/0\.24/);
      if (fraction < 1) expect(phase.transform).not.toBe("matrix(1, 0, 0, 1, 0, 0)");
    }
  }
  expect(await page.evaluate(() => window.bundleErrors)).toEqual([]);
});

test("a replacement cover and its control palette are committed together", async ({ page }) => {
  await mountMedia(page, "#0000ff");
  const players = page.locator("nodalia-navigation-bar, nodalia-media-player");
  await expect.poll(() => players.evaluateAll(cards => cards.every(card =>
    card.shadowRoot.querySelector("[data-artwork-controls]")?.style.getPropertyValue("--media-control-tint") === "rgb(0, 0, 255)"
  ))).toBe(true);
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  let requested = false;
  await page.route("**/replacement-cover.svg*", async route => {
    requested = true;
    await ready;
    await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" fill="#ff0000"/></svg>' });
  });
  await page.evaluate(() => {
    const previous = window.hass.states["media_player.test"];
    window.hass = { ...window.hass, states: { ...window.hass.states, "media_player.test": {
      ...previous, attributes: { ...previous.attributes, media_title: "Replacement song", entity_picture: "/replacement-cover.svg" },
    } } };
    for (const card of document.querySelectorAll("nodalia-navigation-bar, nodalia-media-player")) card.hass = window.hass;
  });
  await expect.poll(() => requested).toBe(true);
  for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) {
    await expect(page.locator(tag)).not.toContainText("Replacement song");
  }
  await players.evaluateAll(cards => {
    window.paletteCommits = [];
    for (const card of cards) {
      const observer = new MutationObserver(() => {
        if (!card.shadowRoot.textContent.includes("Replacement song")) return;
        window.paletteCommits.push(card.shadowRoot.querySelector("[data-artwork-controls]")?.style.getPropertyValue("--media-control-tint"));
      });
      observer.observe(card.shadowRoot, { subtree: true, childList: true, attributes: true });
    }
  });
  release();
  for (const tag of ["nodalia-navigation-bar", "nodalia-media-player"]) await expect(page.locator(tag)).toContainText("Replacement song");
  await expect.poll(() => page.evaluate(() => window.paletteCommits.length)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.paletteCommits.every(tint => tint === "rgb(255, 0, 0)"))).toBe(true);
});

test("Lock editor uses the shared switches and style presets, preserving nested settings", async ({ page }) => {
  await mountLock(page);
  await page.evaluate(() => {
    const editor = document.createElement("nodalia-lock-card-editor");
    editor.hass = window.hass;
    editor.setConfig({ entity: "lock.front", styles: { card: { padding: "18px" } } });
    editor.addEventListener("config-changed", event => { window.savedConfig = event.detail.config; window.card.setConfig(event.detail.config); });
    document.querySelector("#fixture").append(editor);
  });
  const editor = page.locator("nodalia-lock-card-editor");
  const stateSwitch = editor.locator('[data-field="show_state"]');
  await expect(stateSwitch).toHaveRole("switch");
  await expect(editor.locator(".editor-toggle__switch").first()).toHaveCSS("width", "40px");
  await expect(editor.locator(".editor-toggle__switch").first()).toHaveCSS("height", "22px");
  await stateSwitch.focus(); await stateSwitch.press("Space");
  await expect(page.locator("nodalia-lock-card").locator(".state")).toHaveCount(0);
  await editor.locator('[data-editor-toggle="styles"]').click();
  await expect(editor.locator('[data-editor-toggle="styles"]')).toHaveAttribute("aria-expanded", "true");
  await expect(editor).not.toContainText("ed.entity.");
  await editor.locator('[data-field="styles.card.border_radius"][value="14px"]').check();
  await editor.locator('[data-field="styles.icon.size"]').fill("48px");
  await editor.locator('[data-field="styles.icon.size"]').blur();
  const saved = await page.evaluate(() => window.savedConfig);
  expect(saved.styles.card).toEqual({ padding: "18px", border_radius: "14px" });
  expect(saved.styles.icon.size).toBe("48px");
  await expect(page.locator("nodalia-lock-card").locator("ha-card")).toHaveCSS("border-radius", "14px");
  await expect(page.locator("nodalia-lock-card").locator(".icon")).toHaveCSS("width", "48px");
  await expect(page.locator("nodalia-lock-card").locator(".icon")).toHaveCSS("height", "48px");
});

test("Summary keeps media on home and embeds the native Lock card in security", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-room-summary-card"));
  await page.evaluate(() => {
    window.calls = [];
    const hass = window.createHassFixture({ entities: {
      "lock.front": { state: "locked", attributes: { friendly_name: "Front door" } },
      "media_player.room": { state: "playing", attributes: { media_title: "Song" } },
    }, overrides: { callService: async (...args) => { window.calls.push(args); } } });
    const summary = document.createElement("nodalia-room-summary-card");
    summary.setConfig({ locks: ["lock.front"], media_player: "media_player.room", animations: { enabled: false } });
    summary.hass = hass;
    document.querySelector("#fixture").append(summary);
  });
  const summary = page.locator("nodalia-room-summary-card");
  await expect(summary.locator("nodalia-media-player")).toHaveCount(1);
  await expect(summary.locator('[data-room-action="nav:media"]')).toHaveCount(0);
  await summary.locator('[data-room-action="nav:security"]').click();
  const lock = summary.locator("nodalia-lock-card");
  await expect(lock).toHaveCount(1);
  await expect(summary.locator("nodalia-entity-card")).toHaveCount(0);
  await expect(lock.getByRole("slider")).toHaveAttribute("aria-disabled", "false");
  await lock.getByRole("slider").press("End");
  await lock.getByRole("slider").press("Enter");
  expect(await page.evaluate(() => window.calls)).toEqual([]);
  await summary.locator('[data-room-action="nav:home"]').click();
  await expect(summary.locator("nodalia-media-player")).toHaveCount(1);
  await expect(summary.locator('[data-room-action="nav:media"]')).toHaveCount(0);
});
