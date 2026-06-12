# Nodalia News Card

`custom:nodalia-news-card` is an editorial, newspaper-inspired information card for Home Assistant dashboards. It is designed for wall tablets, family hubs, and central dashboards alongside other Nodalia cards such as Weather, Calendar, Notifications, Power Flow, Media Player, and Navigation Bar.

## Overview

The News Card renders headline-first news items from Home Assistant entities. Headlines use a serif editorial typography stack while metadata and summaries use the dashboard body font, keeping the card native to Nodalia and Home Assistant.

**MVP limitation:** The News Card does not fetch news directly from external APIs in this first alpha. It renders news items already exposed to Home Assistant through entities or integrations.

`items`, `articles`, `entries`, `news`, and `headlines` may be native JSON arrays or JSON strings (common with template sensors). Invalid JSON strings are ignored safely.

## Installation

The card ships in the main Nodalia Cards HACS bundle. Add the versioned resource (for example `nodalia-cards-1.3.0-alpha.1.js`) to Lovelace resources, then use the YAML below.

## Simple example

```yaml
type: custom:nodalia-news-card
entity: sensor.news
title: News
```

## Magazine layout example

```yaml
type: custom:nodalia-news-card
title: Latest News
max_items: 5
language: auto

sources:
  - entity: sensor.news_general
    name: General
    icon: mdi:newspaper-variant-outline
    category: general

  - entity: sensor.home_assistant_blog
    name: Home Assistant
    icon: mdi:home-assistant
    category: domotics

layout:
  mode: magazine
  density: normal
  show_images: true
  show_summary: true
  show_source: true
  show_time: true
  show_category: true

filters:
  hide_older_than: 48h
  max_per_source: 3
  include_keywords: []
  exclude_keywords: []

appearance:
  preset: glass
```

## Compact layout example

```yaml
type: custom:nodalia-news-card
title: Headlines
max_items: 6
layout:
  mode: compact
  show_images: false
  show_summary: false
sources:
  - entity: sensor.news_general
```

## Expected entity structure

Configure one or more entities whose **attributes** contain an array of news items. Supported attribute names:

- `items` (recommended)
- `articles`
- `entries`
- `news`
- `headlines`

Example attribute payload:

```yaml
items:
  - title: "Headline"
    summary: "Short summary of the article."
    source: "Home Assistant Blog"
    published: "2026-06-12T09:00:00+02:00"
    url: "https://example.com/article"
    image: "https://example.com/image.jpg"
    category: "Technology"
```

## Supported item fields

The card normalizes common alternative keys:

| Concept   | Supported keys |
|-----------|----------------|
| Title     | `title`, `headline`, `name` |
| Summary   | `summary`, `description`, `content`, `excerpt` |
| Source    | `source`, `publisher`, `feed`, `author` |
| Published | `published`, `published_at`, `date`, `datetime`, `timestamp` |
| URL       | `url`, `link` |
| Image     | `image`, `image_url`, `thumbnail`, `picture` |
| Category  | `category`, `section`, `tag` |

If both `entity` and `sources` are configured, both are merged.

## Layout modes

| Mode | Description |
|------|-------------|
| `magazine` | Default. First item featured with dominant headline; remaining items listed below. |
| `compact` | Dense headline list with optional thumbnails. |
| `list` | Vertical article list with optional thumbnail and summary. |

## Filtering

| Option | Description |
|--------|-------------|
| `max_items` | Maximum items after merge (default `5`, max `50`). |
| `filters.hide_older_than` | Drop older items (`24h`, `48h`, `7d`). Invalid values are ignored safely. |
| `filters.max_per_source` | Limit items per source entity. |
| `filters.include_keywords` | Keep items whose title/summary contains any keyword. |
| `filters.exclude_keywords` | Remove items whose title/summary contains any keyword. |

Items are sorted by published date descending.

## Interaction

- Tapping an item with a valid `http`/`https` URL opens it in a new tab with `noopener,noreferrer`.
- Unsafe URLs (for example `javascript:`) are ignored.
- The card does not call Home Assistant services from news data in this MVP.

## Localization

Runtime strings are available in English and Spanish via `newsCard.*` i18n keys. Set `language: auto` to follow the dashboard locale.

## Editor

The visual editor supports title, entity, max items, layout mode, and visibility toggles for images, summary, source, time, and category.
