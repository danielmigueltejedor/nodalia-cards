import { expect, test } from "@playwright/test";

for (const mode of ["always", "never"]) {
  for (const source of ["state_entity", "error_entity"]) {
    test(`Vacuum ${mode} translates ${source} and truncates long status without clipping battery`, async ({ page }) => {
      await page.goto("/tests/fixtures/browser.html");
      await page.waitForFunction(() => customElements.get("nodalia-vacuum-card"));
      await page.evaluate(({ mode, source }) => {
        const card = document.createElement("nodalia-vacuum-card");
        card.style.width = "180px";
        card.setConfig({ entity: "vacuum.robot", [source]: "sensor.robot_status", compact_layout_mode: mode, language: "es", animations: { enabled: false } });
        card.hass = window.createHassFixture({ overrides: { language: "es", locale: { language: "es" } }, entities: {
          "vacuum.robot": { state: "docked", attributes: { friendly_name: "Robot", battery_level: 91 } },
          "sensor.robot_status": { state: "Charger Disconnected" },
        } });
        document.querySelector("#fixture").append(card);
        window.vacuumStatusCard = card;
      }, { mode, source });
      const card = page.locator("nodalia-vacuum-card");
      const chip = card.locator(".vacuum-card__chip--state");
      await expect(chip).toHaveText("Cargador desconectado");
      await expect(chip).toHaveAttribute("title", "Cargador desconectado");
      const text = chip.locator(".vacuum-card__chip-label");
      // The initial deferred resize can replace the label while WebKit resolves
      // a locator. Assert the live label after that measurement settles.
      await expect.poll(() => text.evaluate(node => ({
        connected: node.isConnected,
        ellipsis: getComputedStyle(node).textOverflow,
        clipped: node.scrollWidth > node.clientWidth,
      }))).toEqual({ connected: true, ellipsis: "ellipsis", clipped: true });
      const geometry = await card.evaluate(node => {
        const root = node.shadowRoot;
        const rect = root.querySelector(".vacuum-card").getBoundingClientRect();
        return [...root.querySelectorAll(".vacuum-card__chip")].map(chip => ({
          left: chip.getBoundingClientRect().left - rect.left,
          right: chip.getBoundingClientRect().right - rect.right,
        }));
      });
      expect(geometry.length).toBeGreaterThanOrEqual(2);
      for (const item of geometry) {
        expect(item.left).toBeGreaterThanOrEqual(0);
        expect(item.right).toBeLessThanOrEqual(0.5);
      }
      await expect(card.locator(".vacuum-card__chip--battery")).toContainText("91%");
      await page.evaluate(() => {
        const card = window.vacuumStatusCard;
        card.hass = window.createHassFixture({ overrides: { language: "es", locale: { language: "es" } }, entities: {
          "vacuum.robot": { state: "cleaning", attributes: { friendly_name: "Robot", battery_level: 90 } },
          "sensor.robot_status": { state: "none" },
        } });
      });
      await expect(chip).not.toHaveText("Cargador desconectado");
    });
  }
}
