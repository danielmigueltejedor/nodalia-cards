export interface EditorColorChannels { red: number; green: number; blue: number; alpha: number }
export interface EditorColorModel {
  alpha: number; hex: string; label: string; resolved: string; source: string; value: string;
}

const clamp = (value: number, max: number): number => Math.max(0, Math.min(max, value));
const component = (value: string | undefined, scale: number): number | null => {
  if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i.test(value)) return null;
  const numeric = Number(value.replace(/%$/, ""));
  return Number.isFinite(numeric) ? clamp(value.endsWith("%") ? numeric * scale / 100 : numeric, scale) : null;
};

/** Parse resolved sRGB CSS colors; CSS Color 4 uses 0..1, RGB uses 0..255. */
export function parseEditorColorChannels(value: unknown): EditorColorChannels | null {
  const raw = String(value ?? "").trim();
  const hexMatch = raw.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hexMatch?.[1]) {
    const hex = hexMatch[1].length < 5 ? hexMatch[1].split("").map(channel => channel + channel).join("") : hexMatch[1];
    return { red: parseInt(hex.slice(0, 2), 16), green: parseInt(hex.slice(2, 4), 16), blue: parseInt(hex.slice(4, 6), 16), alpha: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1 };
  }
  const rgb = raw.match(/^rgba?\(([^)]+)\)$/i);
  const srgb = raw.match(/^color\(\s*srgb\s+([^)]+)\)$/i);
  const body = rgb?.[1] ?? srgb?.[1];
  if (!body) return null;
  const sections = body.trim().split(/\s*\/\s*/);
  if (sections.length > 2) return null;
  const parts = sections[0]?.split(/[\s,]+/) ?? [];
  if (sections.length === 2 && parts.length !== 3 || parts.length < 3 || parts.length > 4) return null;
  const scale = srgb ? 1 : 255;
  const red = component(parts[0], scale), green = component(parts[1], scale), blue = component(parts[2], scale);
  const alphaPart = sections[1] ?? parts[3];
  const alpha = alphaPart === undefined ? 1 : component(alphaPart, 1);
  if (red === null || green === null || blue === null || alpha === null) return null;
  return { red: red * 255 / scale, green: green * 255 / scale, blue: blue * 255 / scale, alpha };
}

export function formatEditorHexChannel(value: unknown): string {
  const numeric = Number(value);
  return clamp(Math.round(Number.isFinite(numeric) ? numeric : 0), 255).toString(16).padStart(2, "0");
}

export function formatEditorColorFromHex(hex: unknown, alpha: unknown = 1): string {
  const normalized = String(hex ?? "").trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalized)) return String(hex ?? "");
  const numeric = Number(alpha);
  const safeAlpha = clamp(Number.isFinite(numeric) ? numeric : 1, 1);
  if (safeAlpha >= 0.999) return `#${normalized}`;
  const red = parseInt(normalized.slice(0, 2), 16), green = parseInt(normalized.slice(2, 4), 16), blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Number(safeAlpha.toFixed(2))})`;
}

export function resolveEditorColorValue(value: unknown): string {
  const resolve = typeof window !== "undefined" ? window.NodaliaBubbleContrast?.resolveEditorColorValue : undefined;
  return resolve?.(value) || String(value ?? "").trim();
}

/** Let the browser convert wider color spaces to the native picker's sRGB gamut. */
function browserColorChannels(value: string): EditorColorChannels | null {
  if (typeof document === "undefined" || !/^(?:color|oklab|oklch|lab|lch)\(/i.test(value)) return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#000001";
  context.fillStyle = value;
  if (context.fillStyle === "#000001") {
    context.fillStyle = "#000002";
    context.fillStyle = value;
    if (context.fillStyle === "#000002") return null;
  }
  context.fillRect(0, 0, 1, 1);
  const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
  if (red === undefined || green === undefined || blue === undefined || alpha === undefined) return null;
  return { red, green, blue, alpha: alpha / 255 };
}

export function getEditorColorModel(value: unknown, fallbackValue: unknown = "#71c0ff"): EditorColorModel {
  const source = String(value ?? "").trim() || String(fallbackValue ?? "").trim() || "#71c0ff";
  const resolved = resolveEditorColorValue(source);
  const channels = parseEditorColorChannels(resolved) || parseEditorColorChannels(source) || browserColorChannels(resolved)
    || parseEditorColorChannels(resolveEditorColorValue(fallbackValue)) || parseEditorColorChannels(fallbackValue)
    || { red: 113, green: 192, blue: 255, alpha: 1 };
  const hex = `#${formatEditorHexChannel(channels.red)}${formatEditorHexChannel(channels.green)}${formatEditorHexChannel(channels.blue)}`;
  return { alpha: channels.alpha, hex, label: source, resolved, source, value: formatEditorColorFromHex(hex, channels.alpha) };
}
