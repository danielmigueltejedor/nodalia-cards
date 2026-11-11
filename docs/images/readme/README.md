# README images

`hero`, `devices` and `energy`, each in a dark and a light theme (WebP, 2808 px wide, transparent rounded corners).

They are captures of the real cards from `nodalia-cards.js`, mounted on the browser test fixture
(`tests/fixtures/browser.html` and `hass.mjs`) with demo entities: no real home is shown. Two things
differ from the test fixture, both to match what Home Assistant provides at runtime:

- `ha-icon` draws the Material Design Icons paths (`@mdi/js`, Apache-2.0; not stored in this repository).
- `ha-card` has Home Assistant's default surface (background, border, radius and shadow variables).

The theme variables are the ones the browser tests use for their dark surface checks, plus a light
counterpart. The background behind the cards is part of the image, not of the cards.

To refresh them, mount the same cards on the fixture, capture at 2x and export to WebP.
