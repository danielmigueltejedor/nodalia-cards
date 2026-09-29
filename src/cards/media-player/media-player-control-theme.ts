import { sampleArtworkPalette } from "./media-player-artwork";

const requests = new WeakMap<HTMLElement, object>();
const themes = new WeakMap<Element, { url: string; tint: string; ink: string }>();

/** Apply to the controls' ancestor, never to the sibling artwork layer. */
export async function applyArtworkControlTheme(host: HTMLElement | null, url: string): Promise<void> {
  if (!host) return;
  const owner = (host.getRootNode?.() as ShadowRoot)?.host || host;
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
  .media-player__control, .media-player__volume-button, .media-player__collapse, .media-player__transport, .media-player__dots {
    -webkit-backdrop-filter: blur(22px) saturate(1.35);
    backdrop-filter: blur(22px) saturate(1.35);
    box-sizing: border-box;
    touch-action: manipulation;
    transition: background-color 220ms ease, border-color 220ms ease, transform 160ms ease;
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
