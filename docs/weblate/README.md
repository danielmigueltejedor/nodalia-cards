# Self-hosted Weblate for Nodalia Cards

Community and maintainer translations for Nodalia Cards run on a **self-hosted Weblate** instance that syncs with this GitHub repository.

Public URL (configurable; replace if your deploy differs):

```text
https://translate.getnodalia.com
```

This folder is **deployment and operator documentation only**. The Home Assistant cards do not call Weblate at runtime. Locale JSON under `i18n/` in Git remains the source of truth for the application.

## Quick links

| Topic | Where |
|---|---|
| Translator / developer guide | [`../TRANSLATIONS.md`](../TRANSLATIONS.md) |
| Docker Compose example | [`docker-compose.yml`](./docker-compose.yml) |
| Environment template | [`.env.example`](./.env.example) |
| Optional machine translation | [`libretranslate.md`](./libretranslate.md) |
| Exact Weblate UI settings | [Component settings](#weblate-ui-component-settings) below |

## Branch strategy (recommended)

Use a dedicated Git branch so translation commits never land on `main` without review:

```text
main      ← developers add/change English source strings + app code
weblate   ← Weblate pulls from here / pushes translation commits here
```

Recommended flow:

1. Developers edit `i18n/runtime/en.json` and `i18n/editor/en.json` on `main` (or a feature branch → PR → `main`).
2. Maintainers merge `main` into `weblate` (or configure Weblate to track `main` for pull and push to `weblate`).
3. Weblate pulls new source strings, translators work in the UI.
4. Weblate commits updated `i18n/**/<lang>.json` files to the `weblate` branch.
5. Open a pull request `weblate` → `main`.
6. CI validates locale schema/keys and regenerates `nodalia-i18n.js` / `nodalia-editor-ui.js` when needed (see workflow below).
7. Merge the PR after green CI.

Why not push straight to `main`? Translation-only commits still require regenerating tracked i18n artifacts. A PR keeps review, CI, and artifact sync explicit.

If you prefer Weblate to open GitHub pull requests automatically, enable Weblate’s GitHub integration / “create pull request” workflow addon instead of direct pushes. Secrets stay in Weblate and GitHub — never in this repo.

## Repository layout Weblate must use

| Surface | Source language | Source file | Translation files | JSON shape |
|---|---|---|---|---|
| Runtime (card UI) | English (`en`) | `i18n/runtime/en.json` | `i18n/runtime/<lang>.json` | Nested objects |
| Editor (visual editors) | English (`en`) | `i18n/editor/en.json` | `i18n/editor/<lang>.json` | Flat `ed.*` keys |

Supported locale codes today (besides `en`):

```text
de, el, es, fr, it, nl, no, pt, ro, ru, zh
```

Norwegian is stored as `no` (mapped to `nb-NO` at runtime for formatting).

## Weblate UI component settings

Create one Weblate **project** (for example `nodalia-cards`) and **two components**.

### Shared VCS settings (both components)

| Setting | Value |
|---|---|
| Source code repository | `https://github.com/danielmigueltejedor/nodalia-cards.git` (or SSH equivalent) |
| Repository branch (pull) | `main` (or `weblate` if you only sync that branch) |
| Repository push URL | Same repo; use a deploy key / machine user with write access |
| Push branch | `weblate` (recommended) |
| Merge style | Rebase or merge — prefer rebase if your Weblate version supports it cleanly |
| Source language | English |
| Language code style | Two-letter ISO 639-1 (`de`, `fr`, …). Map Norwegian to `no` if Weblate suggests `nb`. |
| File format | JSON file |
| New language | Add corresponding `*.json` and extend generator lang lists (see TRANSLATIONS.md) |

### Component A — Runtime

| Setting | Value |
|---|---|
| Name | `runtime` |
| File mask | `i18n/runtime/*.json` |
| Monolingual base language file | `i18n/runtime/en.json` |
| Template for new translations | `i18n/runtime/en.json` |
| JSON style | Nested structure / preserve object hierarchy (enable nested JSON if offered) |
| Edit base file | Disabled for translators (developers edit English in Git) |

### Component B — Editor

| Setting | Value |
|---|---|
| Name | `editor` |
| File mask | `i18n/editor/*.json` |
| Monolingual base language file | `i18n/editor/en.json` |
| Template for new translations | `i18n/editor/en.json` |
| JSON style | Flat key/value (keys like `ed.climate.title`) |
| Edit base file | Disabled for translators |

### Webhooks / polling

- Prefer a **GitHub webhook** from the repository to Weblate (`/hooks/github/` on your instance) so pulls happen on push.
- Alternatively enable periodic repository polling in Weblate (slower).
- Configure the webhook secret in Weblate and GitHub — never commit it.

## Credentials you must configure outside Git

| Secret | Where |
|---|---|
| Weblate admin password | Host `.env` / secrets manager |
| PostgreSQL password | Host `.env` / secrets manager |
| GitHub deploy key or machine-user PAT (repo write for push branch) | Weblate VCS credentials |
| GitHub webhook secret | Weblate + GitHub webhook settings |
| Optional SMTP / OAuth client secrets | Weblate UI or host env |
| Optional LibreTranslate API URL/key | Weblate machine-translation add-on |

Do **not** put tokens in compose files committed to Git or in application source.

## CI expectations

Every pull request (including Weblate → `main`) already runs:

```bash
pnpm run i18n:validate-editor
pnpm run i18n:validate-runtime
pnpm run i18n:audit
pnpm run i18n:gen-editor
pnpm run i18n:gen-runtime
pnpm run validate
```

Validators enforce:

- Locale JSON parses
- Non-English files match the English key tree / key set
- Unknown keys fail
- Placeholder/`code` spans stay aligned with English
- Generated `nodalia-editor-ui.js` / `nodalia-i18n.js` stay in sync after gen

Workflow [`.github/workflows/weblate-i18n-sync.yml`](../../.github/workflows/weblate-i18n-sync.yml) regenerates tracked i18n artifacts on pushes to the `weblate` branch so PRs into `main` are not blocked solely by stale generated files.

## Reverse proxy assumptions

- Terminate TLS at Caddy / Traefik / nginx / Cloudflare.
- Forward to `WEBLATE_HTTP_PORT` (default `8080`) on the Weblate container.
- Set `WEBLATE_SITE_DOMAIN` to the public hostname **without** `https://`.
- Allow websocket upgrades if your proxy requires explicit config.
- Restrict admin paths if you expose the instance publicly.

## Deploying the example stack

```bash
cd docs/weblate
cp .env.example .env
# edit .env — strong passwords, real domain and admin email
docker compose --env-file .env up -d
```

Pin `weblate/weblate` to a specific version tag for production instead of `latest`. Keep PostgreSQL upgrades manual and deliberate.

Upstream reference: [Weblate Docker install](https://docs.weblate.org/en/latest/admin/install/docker.html) and [WeblateOrg/docker-compose](https://github.com/WeblateOrg/docker-compose).
