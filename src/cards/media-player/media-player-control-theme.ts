import { getCachedArtworkPalette, sampleArtworkPalette } from "./media-player-artwork";

const requests = new WeakMap<HTMLElement, object>();
const themes = new WeakMap<Element, { url: string; tint: string; ink: string }>();


const prepared = new Set<string>();
const displayedArtwork = new WeakMap<HTMLElement, string>();
const renderRequests = new WeakMap<HTMLElement, { url: string; token: object }>();

/** Commit a replacement cover and palette together; cached covers never yield. */
export function prepareArtworkTheme(owner: HTMLElement, url: string, render: () => void): boolean {
  if (displayedArtwork.get(owner) === url || !url || getCachedArtworkPalette(url) || prepared.has(url)) {
    displayedArtwork.set(owner, url);
    renderRequests.delete(owner);
    return true;
  }
  const existing = renderRequests.get(owner);
  if (existing?.url === url) return false;
  const token = {};
  renderRequests.set(owner, { url, token });
  void sampleArtworkPalette(url).then(() => {
    if (renderRequests.get(owner)?.token !== token) return;
    renderRequests.delete(owner);
    prepared.add(url);
    if (prepared.size > 64) {
      const first = prepared.values().next().value;
      if (first !== undefined) prepared.delete(first);
    }
    if (owner.isConnected) render();
  });
  return false;
}

/** Invalidate deferred owner rendering and palette carry-over at context boundaries. */
export function releaseArtworkTheme(owner: HTMLElement): void {
  renderRequests.delete(owner);
  displayedArtwork.delete(owner);
  themes.delete(owner);
  const root = owner.shadowRoot;
  root?.querySelectorAll(".media-player-card").forEach(host => {if (host instanceof HTMLElement) requests.delete(host);});
}

/** Apply to the controls' ancestor, never to the sibling artwork layer. */
export async function applyArtworkControlTheme(host: HTMLElement | null, url: string): Promise<void> {
  if (!host) return;
  const root = host.getRootNode();
  const owner = root instanceof ShadowRoot ? root.host : host;
  const token = {};
  requests.set(host, token);
  if (!url) {
    themes.delete(owner);
    host.removeAttribute("data-artwork-controls");
    host.style.removeProperty("--media-control-tint");
    host.style.removeProperty("--media-control-ink");
    return;
  }
  const apply = (theme: { tint: string; ink: string }) => {
    host.style.setProperty("--media-control-tint", theme.tint);
    host.style.setProperty("--media-control-ink", theme.ink);
    host.setAttribute("data-artwork-controls", "");
  };
  // Navigation can recreate its inner card on track changes. Keep its previous
  // palette on the owning component so a new inner card never flashes neutral.
  const cached = getCachedArtworkPalette(url);
  if (cached) {
    const theme = { url, tint: cached.primary, ink: cached.foreground === "dark" ? "#000" : "#fff" };
    themes.set(owner, theme);
    apply(theme);
    return;
  }
  const previous = themes.get(owner);
  if (previous) {
    apply(previous);
    if (previous.url === url) return;
  }
  const palette = await sampleArtworkPalette(url);
  if (!palette || requests.get(host) !== token || !host.isConnected) return;
  const theme = { url, tint: palette.primary, ink: palette.foreground === "dark" ? "#000" : "#fff" };
  themes.set(owner, theme);
  apply(theme);
}

// Let the artwork show through a softly tinted, blurred surface.
// Layouts own control dimensions; share only visual treatment.
export const MEDIA_CONTROL_STYLES = `
  .media-player-card .media-player__transport-shell { width:100%; }
  .media-player-card .media-player__transport-cluster {
    display:grid; grid-template-columns:minmax(0, 1fr) auto minmax(0, 1fr);
    gap:8px; width:100%; align-items:center;
  }
  .media-player__transport-side { display:flex; flex-wrap:wrap; gap:8px; min-width:0; align-items:center; }
  .media-player__transport-side--start { justify-content:flex-end; }
  .media-player__transport-side--end { justify-content:flex-start; }
  .media-player-card .media-player__transport-addon { position:static; transform:none; }

  .media-player__control, .media-player__volume-button, .media-player__chip, .media-player__collapse, .media-player__transport, .media-player__dots {
    -webkit-backdrop-filter: blur(22px) saturate(1.35);
    backdrop-filter: blur(22px) saturate(1.35);
    box-sizing: border-box;
    touch-action: manipulation;
    transition: transform 160ms ease;
  }
  .media-player__control:focus-visible, .media-player__volume-button:focus-visible,
  .media-player__collapse:focus-visible {
    outline: 2px solid var(--primary-text-color, #fff);
    outline-offset: 3px;
  }
  .media-player-card :is(.media-player__control, .media-player__volume-button, .media-player__chip, .media-player__collapse, .media-player__transport, .media-player__dots) {
    background: color-mix(in srgb, var(--media-control-tint, var(--primary-text-color, #fff)) 24%, transparent);
    color: var(--media-control-ink, var(--primary-text-color, #fff));
    border-color: color-mix(in srgb, var(--media-control-ink, var(--primary-text-color, #fff)) 18%, transparent);
    box-shadow: inset 0 1px 0 #ffffff0f, 0 10px 24px #00000029;
    text-shadow: none;
  }
  .media-player-card :is(.media-player__control, .media-player__volume-button, .media-player__collapse) ha-icon {
    color: inherit;
  }
  .media-player-card .media-player__dot::before {
    background: color-mix(in srgb, var(--media-control-ink, var(--primary-text-color, #fff)) 45%, transparent);
  }
  .media-player-card .media-player__dot.active::before {
    background: var(--media-control-ink, var(--primary-text-color, #fff));
  }
  @media (prefers-reduced-motion: reduce) {
    .media-player__control, .media-player__volume-button { transition: none; }
  }
`;
