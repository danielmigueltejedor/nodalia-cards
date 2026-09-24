# Optional: LibreTranslate with Weblate

LibreTranslate is an optional **self-hosted** machine-translation backend you can wire into Weblate for suggestions. Nodalia Cards does **not** depend on LibreTranslate at build time or runtime.

## Why optional

- Speeds up first-pass suggestions for translators
- Keeps MT on infrastructure you control (no paid SaaS required)
- Suggestions must still be reviewed — never auto-commit unreviewed MT into `main`

## Typical setup

1. Run LibreTranslate beside Weblate (separate Compose service or host).
2. In Weblate: **Management** → **Machine translation** → add an HTTP API / LibreTranslate-compatible endpoint.
3. Point it at your LibreTranslate URL (for example `http://libretranslate:5000`).
4. Leave API keys in Weblate/host secrets, not in this repository.

Example snippet you could add locally to a private override compose file (do **not** commit secrets):

```yaml
services:
  libretranslate:
    image: libretranslate/libretranslate:latest
    restart: unless-stopped
    environment:
      LT_LOAD_ONLY: en,es,de,fr,it,nl,pt,ru,zh,el,ro
    volumes:
      - libretranslate-data:/home/libretranslate/.local
    # Do not publish this port publicly without auth / network policy.

volumes:
  libretranslate-data:
```

Norwegian (`no`) and some smaller locales may need extra models or fall back to English suggestions — verify coverage in your LibreTranslate build.

## Policy recommendation

- Allow MT suggestions in Weblate for translators.
- Disallow automatic acceptance of MT without human review.
- Keep Git history of reviewed strings only via the normal `weblate` → `main` PR flow.
