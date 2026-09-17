import type { ArtworkPalette, MediaPlayerIdleArtworkConfig } from "./media-player-types";

const PALETTE_CACHE = new Map<string, ArtworkPalette>();
const PRELOAD_CACHE = new Map<string, Promise<boolean>>();

export function getArtworkVisuals(
  artwork: {
    mode?: string;
    blur?: number;
    dim?: number;
    saturation?: number;
    opacity?: number;
  } = {},
  albumCoverEnabled = true,
  isLightTheme = false,
): { filter: string; opacity: string; dim: number } {
  if (!albumCoverEnabled || artwork.mode === "off") {
    return { filter: "none", opacity: "0", dim: 0 };
  }
  const blur = artwork.mode === "blur"
    ? Math.max(18, Number(artwork.blur) || 18)
    : Math.max(0, Number(artwork.blur) || 0);
  const saturation = Number.isFinite(Number(artwork.saturation)) ? Number(artwork.saturation) : 1;
  const brightness = isLightTheme ? 1.03 : 1;
  const opacity = Number.isFinite(Number(artwork.opacity)) ? Number(artwork.opacity) : 1;
  const tone = `saturate(${saturation}) brightness(${brightness})`;
  return {
    filter: blur > 0 ? `blur(${blur}px) ${tone}` : tone,
    opacity: String(Math.min(1, Math.max(0.15, opacity))),
    dim: Math.min(0.85, Math.max(0, Number(artwork.dim) || 0)),
  };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function rememberRecentArtwork(history: string[], url: string, maxItems = 8): string[] {
  const nextUrl = String(url || "").trim();
  const limit = Math.max(1, Math.min(24, Number(maxItems) || 8));
  const next = Array.isArray(history) ? history.filter(item => String(item || "").trim()) : [];
  if (!nextUrl) {
    return next.slice(0, limit);
  }
  if (next[0] === nextUrl) {
    return next.slice(0, limit);
  }
  return [nextUrl, ...next.filter(item => item !== nextUrl)].slice(0, limit);
}

export function extractArtworkPalette(image: CanvasImageSource): ArtworkPalette | null {
  try {
    const canvas = document.createElement("canvas");
    const width = 24;
    const height = 24;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3] ?? 0;
      if (alpha < 96) {
        continue;
      }
      const r = data[index] ?? 0;
      const g = data[index + 1] ?? 0;
      const b = data[index + 2] ?? 0;
      const luma = (r * 299 + g * 587 + b * 114) / 1000;
      if (luma < 18 || luma > 242) {
        continue;
      }
      red += r;
      green += g;
      blue += b;
      count += 1;
    }
    if (!count) {
      return null;
    }
    const primary = `rgb(${Math.round(red / count)}, ${Math.round(green / count)}, ${Math.round(blue / count)})`;
    const luma = (red / count * 299 + green / count * 587 + blue / count * 114) / 1000;
    return {
      primary,
      foreground: luma > 150 ? "dark" : "light",
    };
  } catch (_error) {
    return null;
  }
}

export function getCachedArtworkPalette(url: string): ArtworkPalette | null {
  return PALETTE_CACHE.get(url) || null;
}

export function setCachedArtworkPalette(url: string, palette: ArtworkPalette): void {
  PALETTE_CACHE.set(url, palette);
}

export function preloadArtworkUrl(url: string): Promise<boolean> {
  const nextUrl = String(url || "").trim();
  if (!nextUrl) {
    return Promise.resolve(false);
  }
  const cached = PRELOAD_CACHE.get(nextUrl);
  if (cached) {
    return cached;
  }
  const pending = new Promise<boolean>(resolve => {
    const image = new Image();
    image.decoding = "async";
    const settle = (loaded: boolean) => {
      image.onload = null;
      image.onerror = null;
      resolve(loaded);
    };
    image.onload = () => {
      const decode = image.decode?.();
      if (decode && typeof decode.then === "function") {
        decode.then(() => settle(true)).catch(() => settle(true));
        return;
      }
      settle(true);
    };
    image.onerror = () => settle(false);
    image.src = nextUrl;
  });
  PRELOAD_CACHE.set(nextUrl, pending);
  return pending;
}

export async function sampleArtworkPalette(url: string): Promise<ArtworkPalette | null> {
  const nextUrl = String(url || "").trim();
  if (!nextUrl) {
    return null;
  }
  const cached = getCachedArtworkPalette(nextUrl);
  if (cached) {
    return cached;
  }
  try {
    const image = new Image();
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    const loaded = await new Promise<boolean>(resolve => {
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = nextUrl;
    });
    if (!loaded) {
      return null;
    }
    const palette = extractArtworkPalette(image);
    if (palette) {
      setCachedArtworkPalette(nextUrl, palette);
    }
    return palette;
  } catch (_error) {
    return null;
  }
}

export interface ArtworkLayerHost {
  stage: HTMLElement;
  current: HTMLElement;
  incoming: HTMLElement;
}

export class MediaPlayerArtworkController {
  currentUrl = "";
  recent: string[] = [];
  palette: ArtworkPalette | null = null;
  private slideshowTimer = 0;
  private slideshowIndex = 0;
  private generation = 0;
  private host: ArtworkLayerHost | null = null;
  private idleActive = false;

  attach(host: ArtworkLayerHost): void {
    this.host = host;
  }

  detach(): void {
    this.stopSlideshow();
    this.host = null;
    this.generation += 1;
  }

  getStage(): HTMLElement | null {
    return this.host?.stage || null;
  }

  remember(url: string, maxItems = 8): void {
    this.recent = rememberRecentArtwork(this.recent, url, maxItems);
  }

  stopSlideshow(): void {
    if (this.slideshowTimer) {
      window.clearInterval(this.slideshowTimer);
      this.slideshowTimer = 0;
    }
    this.idleActive = false;
    this.host?.current.classList.remove("is-idle-animated");
    this.host?.incoming.classList.remove("is-idle-animated");
  }

  async show(
    url: string,
    options: {
      crossfade?: boolean;
      duration?: number;
      idle?: boolean;
      animation?: string;
      connected?: boolean;
    } = {},
  ): Promise<boolean> {
    const host = this.host;
    const nextUrl = String(url || "").trim();
    if (!host) {
      return false;
    }
    if (!nextUrl) {
      return false;
    }
    if (nextUrl === this.currentUrl && host.current.style.backgroundImage) {
      this.applyIdleAnimation(Boolean(options.idle), options.animation);
      return true;
    }

    const token = ++this.generation;
    const loaded = await preloadArtworkUrl(nextUrl);
    if (token !== this.generation || options.connected === false) {
      return false;
    }
    if (!loaded) {
      return false;
    }

    const reduceMotion = prefersReducedMotion() || options.crossfade === false;
    const duration = Math.max(0, Number(options.duration) || 500);
    host.incoming.style.backgroundImage = `url("${nextUrl.replace(/"/g, "%22")}")`;
    host.incoming.classList.add("is-visible");
    if (reduceMotion || !this.currentUrl) {
      host.current.style.backgroundImage = host.incoming.style.backgroundImage;
      host.incoming.classList.remove("is-visible");
      host.incoming.style.backgroundImage = "";
      this.currentUrl = nextUrl;
      this.applyIdleAnimation(Boolean(options.idle), options.animation);
      return true;
    }

    host.incoming.style.transitionDuration = `${duration}ms`;
    requestAnimationFrame(() => {
      host.incoming.classList.add("is-ready");
    });

    window.setTimeout(() => {
      if (token !== this.generation) {
        return;
      }
      host.current.style.backgroundImage = host.incoming.style.backgroundImage;
      host.incoming.classList.remove("is-visible", "is-ready");
      host.incoming.style.backgroundImage = "";
      this.currentUrl = nextUrl;
      this.applyIdleAnimation(Boolean(options.idle), options.animation);
    }, duration);
    return true;
  }

  startSlideshow(
    config: MediaPlayerIdleArtworkConfig,
    onTick: (url: string) => void,
  ): void {
    this.stopSlideshow();
    if (!config.enabled || !config.slideshow || this.recent.length < 2) {
      return;
    }
    this.idleActive = true;
    const interval = Math.max(4, Number(config.interval) || 15) * 1000;
    this.slideshowTimer = window.setInterval(() => {
      if (!this.recent.length) {
        return;
      }
      this.slideshowIndex = (this.slideshowIndex + 1) % this.recent.length;
      const url = this.recent[this.slideshowIndex];
      if (url) {
        onTick(url);
      }
    }, interval);
  }

  private applyIdleAnimation(idle: boolean, animation?: string): void {
    const host = this.host;
    if (!host) {
      return;
    }
    const enabled = idle && animation === "subtle" && !prefersReducedMotion();
    host.current.classList.toggle("is-idle-animated", enabled);
  }
}
