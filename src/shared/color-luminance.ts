import { parseEditorColorChannels } from "./editor-color";
export interface RgbChannels { red: number; green: number; blue: number }
export function parseRgbColor(value: unknown): RgbChannels | null {
  const channels = parseEditorColorChannels(value);
  return channels ? { red: channels.red, green: channels.green, blue: channels.blue } : null;
}
export function getRelativeLuminance(color: RgbChannels | null | undefined): number | null {
  if (!color || ![color.red, color.green, color.blue].every(Number.isFinite)) return null;
  const toLinear = (channel: number) => {
    const normalized = Math.max(0, Math.min(1, channel / 255));
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return .2126 * toLinear(color.red) + .7152 * toLinear(color.green) + .0722 * toLinear(color.blue);
}
