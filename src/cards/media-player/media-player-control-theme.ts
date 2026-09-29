import { sampleArtworkPalette } from "./media-player-artwork";

const requests = new WeakMap<HTMLElement, object>();

/** Apply to the controls' ancestor, never to the sibling artwork layer. */
export async function applyArtworkControlTheme(host: HTMLElement | null, url: string): Promise<void> {
  if (!host) return;
  const token = {};
  requests.set(host, token);
  host.removeAttribute("data-artwork-controls");
  host.style.removeProperty("--media-control-tint");
  host.style.removeProperty("--media-control-ink");
  if (!url) return;
  const palette = await sampleArtworkPalette(url);
  if (!palette || requests.get(host) !== token || !host.isConnected) return;
  host.style.setProperty("--media-control-tint", palette.primary);
  host.style.setProperty("--media-control-ink", palette.foreground === "dark" ? "#000" : "#fff");
  host.setAttribute("data-artwork-controls", "");
}

// Opaque sampled colors keep the computed contrast independent of the artwork
// behind a control. Layouts own control dimensions; share only visual treatment.
export const MEDIA_CONTROL_STYLES = `
  .media-player__control, .media-player__volume-button {
    -webkit-backdrop-filter: blur(22px) saturate(1.35);
    backdrop-filter: blur(22px) saturate(1.35);
    box-sizing: border-box;
    padding: 0;
    touch-action: manipulation;
    transition: background-color 220ms ease, border-color 220ms ease, transform 160ms ease;
  }
  .media-player__control:focus-visible, .media-player__volume-button:focus-visible,
  .media-player__collapse:focus-visible {
    outline: 2px solid var(--primary-text-color, #fff);
    outline-offset: 3px;
  }
  .media-player-card[data-artwork-controls] :is(.media-player__control, .media-player__volume-button, .media-player__chip, .media-player__collapse) {
    background: var(--media-control-tint);
    color: var(--media-control-ink);
    border-color: color-mix(in srgb, var(--media-control-ink) 24%, var(--media-control-tint));
    box-shadow: inset 0 1px 0 #ffffff24, 0 6px 16px #00000024;
    text-shadow: none;
  }
  .media-player-card[data-artwork-controls] :is(.media-player__control, .media-player__volume-button, .media-player__collapse) ha-icon {
    color: inherit;
  }
  .media-player-card[data-artwork-controls] .media-player__control--primary {
    border-width: 2px;
    border-color: var(--media-control-ink);
  }
  @media (prefers-reduced-motion: reduce) {
    .media-player__control, .media-player__volume-button { transition: none; }
  }
`;
