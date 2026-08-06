import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const SURFACE_CARDS = [
  "nodalia-weather-card.js",
  "nodalia-calendar-card.js",
  "nodalia-entity-card.js",
  "nodalia-navigation-bar.js",
];

function loadUtils() {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(read("nodalia-utils.js"), context);
  return context.window.NodaliaUtils;
}

test("composeCardSurfaceBackground keeps glaze on one background stack without transparent ambient layers", () => {
  const utils = loadUtils();
  assert.equal(typeof utils.composeCardSurfaceBackground, "function");

  const active = utils.composeCardSurfaceBackground({
    base: "linear-gradient(135deg, #224 0%, #112 100%)",
    accentColor: "#71c0ff",
    ambient: true,
    glazeStrength: 22,
  });
  assert.match(active, /linear-gradient\(180deg/);
  assert.match(active, /linear-gradient\(135deg, #224 0%, #112 100%\)$/);
  assert.doesNotMatch(active, /radial-gradient/);

  const idle = utils.composeCardSurfaceBackground({
    base: "var(--ha-card-background)",
    glazeMode: "neutral",
    glazeNeutralStrength: 5,
  });
  assert.match(idle, /var\(--primary-text-color\) 5%/);
  assert.doesNotMatch(idle, /radial-gradient/);
});

test("Weather, Calendar, Entity and Navigation avoid absolute ha-card surface overlays", () => {
  for (const file of SURFACE_CARDS) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /ha-card(?:\.navbar-card)?::before\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/,
      `${file} should not paint the card surface with an absolute ::before fill`,
    );
    assert.doesNotMatch(
      source,
      /ha-card(?:\.navbar-card)?::after\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;/,
      `${file} should not paint the card surface with an absolute ::after fill`,
    );
  }

  assert.match(read("nodalia-calendar-card.js"), /composeCardSurfaceBackground/);
  assert.match(read("nodalia-entity-card.js"), /composeCardSurfaceBackground/);
  assert.match(read("nodalia-navigation-bar.js"), /composeCardSurfaceBackground/);
  assert.match(
    read("nodalia-weather-card.js"),
    /ha-card \{\s*background:\s*linear-gradient\(180deg/,
  );
});

test("Entity Card active and idle surfaces stay in one background paint", () => {
  const source = read("nodalia-entity-card.js");
  assert.match(source, /glazeMode:\s*isActive \? "accent" : "neutral"/);
  assert.match(source, /color-mix\(in srgb, \$\{accentColor\} 26%/);
  assert.doesNotMatch(source, /ambient:\s*isActive/);
  assert.doesNotMatch(source, /ha-card \{[\s\S]*isolation:\s*isolate;/);
});

test("Calendar Card bakes ambient tint into the opaque surface base", () => {
  const source = read("nodalia-calendar-card.js");
  assert.match(source, /color-mix\(in srgb, \$\{accentColor\} 26%, \$\{baseCardBg\}\)/);
  assert.doesNotMatch(source, /ambient:\s*true/);
  assert.doesNotMatch(
    source,
    /composeCardSurfaceBackground\?\. \(\{[\s\S]*radial-gradient\(circle at 18% 20%/,
  );
});

test("Calendar and Navigation card shells no longer force isolation on the clipped surface", () => {
  const calendarHaCard = read("nodalia-calendar-card.js").match(/ha-card \{[\s\S]*?\n        \}/);
  assert.ok(calendarHaCard, "calendar ha-card rule should exist");
  assert.doesNotMatch(calendarHaCard[0], /isolation:\s*isolate/);

  const navbarHaCard = read("nodalia-navigation-bar.js").match(/ha-card\.navbar-card \{[\s\S]*?\n        \}/);
  assert.ok(navbarHaCard, "navbar ha-card rule should exist");
  assert.doesNotMatch(navbarHaCard[0], /isolation:\s*isolate/);
});
