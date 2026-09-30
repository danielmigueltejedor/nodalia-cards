import { expect, test } from "@playwright/test";

for (const card of ["lock", "entity", "fan", "notifications"]) {
  test(`${card} editor shows the actual translucent tint and retains alpha when changing color`, async ({ page }) => {
    await page.goto("/tests/fixtures/browser.html");
    const tag = `nodalia-${card}-card-editor`;
    await page.waitForFunction(tag => customElements.get(tag), tag);
    await page.evaluate(({ card, tag }) => {
      const entity = card === "lock" ? "lock.front" : card === "fan" ? "fan.room" : "sensor.room";
      const editor = document.createElement(tag);
      editor.setConfig({ entity, styles: { card: { background: "color-mix(in srgb, #ff8800 24%, transparent)" } } });
      editor.hass = window.makeHass({ [entity]: { entity_id: entity, state: "locked", attributes: { friendly_name: "Room" } } });
      editor.addEventListener("config-changed", event => { window.savedColorConfig = event.detail.config; });
      document.querySelector("#fixture").append(editor);
    }, { card, tag });
    const editor = page.locator(tag);
    await editor.locator('[data-editor-toggle="styles"]').click();
    const picker = editor.locator('[data-field="styles.card.background"]');
    await expect(picker).toHaveValue("#ff8800");
    await expect(picker).toHaveAttribute("data-alpha", "0.24");
    await picker.evaluate(input => {
      input.value = "#aabbcc";
      input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    });
    expect(await page.evaluate(() => window.savedColorConfig.styles.card.background)).toBe("rgba(170, 187, 204, 0.24)");
    await expect(picker).toHaveValue("#aabbcc");
    expect(await picker.evaluate(input => input.parentElement.querySelector('.editor-color-swatch').style.getPropertyValue("--editor-swatch").trim())).toBe("rgba(170, 187, 204, 0.24)");
  });
}

test("Lock editor converts wider color spaces through the browser instead of reading them as RGB", async ({ page }) => {
  await page.goto("/tests/fixtures/browser.html");
  await page.waitForFunction(() => customElements.get("nodalia-lock-card-editor"));
  await page.evaluate(() => {
    const editor = document.createElement("nodalia-lock-card-editor");
    editor.setConfig({ entity: "lock.front", styles: { card: { background: "color(display-p3 1 0 0 / .5)" } } });
    document.querySelector("#fixture").append(editor);
  });
  const editor = page.locator("nodalia-lock-card-editor");
  await editor.locator('[data-editor-toggle="styles"]').click();
  const picker = editor.locator('[data-field="styles.card.background"]');
  // Chromium and WebKit round wide-gamut canvas conversions differently.
  const hex = await picker.inputValue();
  expect(parseInt(hex.slice(1, 3), 16)).toBeGreaterThanOrEqual(250);
  expect(parseInt(hex.slice(3, 5), 16)).toBeLessThanOrEqual(2);
  expect(parseInt(hex.slice(5, 7), 16)).toBeLessThanOrEqual(2);
  expect(Number(await picker.getAttribute("data-alpha"))).toBeCloseTo(0.5, 2);
});
