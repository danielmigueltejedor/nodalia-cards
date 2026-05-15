# Nodalia Cards — styling reference for your dashboard

This guide is for anyone who wants **the same look and feel as Nodalia Cards** on other Lovelace cards (for example [card-mod](https://github.com/thomasloven/lovelace-card-mod), Mushroom, button-card, or built-in entities) **without** editing Nodalia’s JavaScript.

Nodalia cards are **theme-aware**: they read Home Assistant’s CSS variables first, then add a small set of fixed accents (mostly on gauges and climate arcs). Defaults live in each card’s `DEFAULT_CONFIG.styles` in the source files under this repository.

---

## 1. How Nodalia ties into Home Assistant themes

Most “chrome” (card surface, border, shadow, main text) uses HA’s standard variables so **light/dark and custom themes** apply automatically.

| Role | Typical CSS value in Nodalia defaults |
|------|----------------------------------------|
| Card background | `var(--ha-card-background)` |
| Card border | `1px solid var(--divider-color)` |
| Card shadow | `var(--ha-card-box-shadow)` |
| Primary text | `var(--primary-text-color)` |
| Muted / secondary text | Often `color-mix(in srgb, var(--primary-text-color) …%, transparent)` or `var(--secondary-text-color)` where noted in YAML |
| Primary accent | `var(--primary-color)` and `rgba(var(--rgb-primary-color), …)` |
| Semantic | `var(--info-color, #71c0ff)`, `var(--warning-color, #f6b73c)`, `var(--error-color, #ff6b6b)` |

**Tip:** In the browser devtools, select a Nodalia card’s `<ha-card>` (inside the card’s shadow root) and inspect **computed** styles to see exactly what your theme resolves to.

---

## 2. Layout and shape (the “Nodalia” silhouette)

These are the **default** radii and chip shapes used across many cards (you can override each card’s `styles` block in YAML).

| Token / idea | Typical default | Notes |
|--------------|-----------------|--------|
| Card corner radius | **`28px`–`32px`** | Entity / light / fan / vacuum / cover / humidifier / climate often **28–30px**; power flow **32px**; graph **30px** |
| Pill chips | **`border-radius: 999px`** | State chips, badges, compact labels |
| Card padding | Often **`12px`–`18px`** | Power flow uses slightly tighter padding; graph a bit roomier |
| Vertical rhythm | **`gap: 12px`–`20px`** between major rows | Matches HA card density without crowding |

---

## 3. Icon bubble (hero icon)

Many device-style cards share the same **round icon plate**:

- **Size:** commonly **`38px`–`58px`** side (climate / gauge larger; entity / light middle).
- **Plate fill:** `color-mix(in srgb, var(--primary-text-color) 6%, transparent)` — a very soft neutral wash that works in light and dark.
- **Glyph color:** `var(--primary-text-color)` with **on** / **active** tints such as `var(--info-color, #71c0ff)` or `var(--warning-color, #f6b73c)` depending on domain.

---

## 4. Chips (state / attribute rows)

Shared defaults on several cards:

| Property | Typical value |
|----------|----------------|
| Height | `24px` (some cards `21px` on denser UIs) |
| Font size | `9px`–`11px` |
| Horizontal padding | `0 9px` or `0 10px` |
| Radius | `999px` |

---

## 5. Controls (circular buttons in a row)

Common pattern:

- **Control diameter:** `36px`–`42px`
- **Accent ring / fill:** `rgba(var(--rgb-primary-color), 0.18)` or a soft blue like `rgba(113, 192, 255, 0.2)` on cover-style layouts
- **Icon stroke:** inherits `var(--primary-text-color)` for the default idle state

---

## 6. Sliders (light, fan, cover, humidifier, …)

Defaults vary slightly by card; typical ranges:

| Property | Typical range |
|----------|----------------|
| Track height | `16px`–`22px` |
| Thumb | `22px`–`28px` |
| Track color | `var(--primary-color)` or `var(--info-color, #71c0ff)` |
| Wrap height | `44px`–`56px` |

---

## 7. Climate and circular gauge (fixed accent hues)

These use **theme variables for chrome** but **fixed hue anchors** for HVAC / value arcs so the dial stays readable:

| Semantic | Example default (from `nodalia-climate-card.js`) |
|----------|---------------------------------------------------|
| Heat | `#f59f42` |
| Cool | `#71c0ff` |
| Dry | `#7fd0c8` |
| Auto | `#c5a66f` |
| Fan | `#83d39c` |

Circular gauge high tint often uses **`#ff7d57`** for the “hot” end of the arc (`nodalia-circular-gauge-card.js`). You can mirror these hex values in `card-mod` gradients if you want Mushroom sliders to feel similar.

---

## 8. Graph card (typography scale)

Default `styles` in `nodalia-graph-card.js` (illustrative):

| Role | Default size |
|------|----------------|
| Title | `13px` |
| Main value | `40px` |
| Unit | `17px` |
| Legend | `11px` |
| Chart height | `178px` (configurable) |

---

## 9. Power flow card

- **Card radius:** `32px` by default.
- **Flow line width:** configurable; default style key `flow_width` maps to a thin energetic line.
- **Node bubbles:** larger **home** node vs **grid/solar/battery**; values use smaller secondary sizes (`~10px`–`22px` hierarchy).

---

## 10. Overriding Nodalia from YAML (recommended)

Every Nodalia card that supports styling documents keys under **`styles:`** in its README or in the **visual editor**. Prefer YAML `styles` (or the editor) so you stay **inside the supported surface** and survive updates.

Example (illustrative — keys differ per card type):

```yaml
type: custom:nodalia-entity-card
entity: switch.example
styles:
  card:
    border_radius: 26px
    padding: 16px
  icon:
    size: 42px
```

---

## 11. Using card-mod on *other* cards to match Nodalia

Because Nodalia renders in the **shadow DOM**, you **do not** style it with global `card-mod` on the outer host the same way as a plain `entities` card. This section is for **non-Nodalia** cards where you want a similar **ha-card** shell.

Example: soften a standard card to feel closer to Nodalia’s default entity/light shell:

```yaml
type: entities
entities:
  - entity: light.living_room
card_mod:
  style: |
    ha-card {
      border-radius: 28px !important;
      border: 1px solid var(--divider-color) !important;
      box-shadow: var(--ha-card-box-shadow) !important;
      padding: 14px;
    }
```

Adjust radius (`28px` vs `30px` vs `32px`) to match the Nodalia card you use most on that view.

---

## 12. Where to look in the source (advanced)

| Area | File(s) |
|------|---------|
| Generic device / entity shell | `nodalia-entity-card.js`, `nodalia-light-card.js`, `nodalia-fan-card.js`, `nodalia-vacuum-card.js`, `nodalia-cover-card.js`, `nodalia-humidifier-card.js` |
| Climate dial | `nodalia-climate-card.js` (`styles.dial.*`) |
| Circular gauge | `nodalia-circular-gauge-card.js` (`styles.gauge.*`) |
| Graph | `nodalia-graph-card.js` |
| Power flow | `nodalia-power-flow-card.js` |
| Notifications / calendar / weather | `nodalia-notifications-card.js`, `nodalia-calendar-card.js`, `nodalia-weather-card.js` |

Search for `DEFAULT_CONFIG` and the nested `styles:` object in each file for the **authoritative** list of keys and default strings.

---

## 13. Limitations and expectations

- **Shadow DOM:** external CSS cannot reach inside Nodalia cards; use each card’s `styles` / editor instead.
- **Theme variables change:** documenting resolved hex values would go stale; this file intentionally references **`var(--…)`** where possible.
- **card-mod** is third-party; YAML examples here are illustrative—follow the card-mod docs for your HA version.

If something is missing from this reference, open an issue with the **card type** and the **style property** you want documented, and we can extend this file.
