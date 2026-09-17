import type { MediaPlayerPresentationMode } from "./media-player-types";

export const MEDIA_PLAYER_PRESENTATION_MODES = [
  "auto",
  "standard",
  "square",
  "chip",
  "compact",
  "artwork",
] as const;

const EXPLICIT_MODES = ["standard", "square", "chip", "compact", "artwork"] as const;

export function normalizePresentationMode(value: unknown): MediaPlayerPresentationMode {
  const key = String(value || "").trim().toLowerCase();
  if (key === "horizontal" || key === "long" || key === "chip") {
    return "chip";
  }
  if (key === "minimal" || key === "artwork") {
    return "artwork";
  }
  if ((MEDIA_PLAYER_PRESENTATION_MODES as readonly string[]).includes(key)) {
    return key as MediaPlayerPresentationMode;
  }
  return "auto";
}

function keepCurrentIfClose(
  current: Exclude<MediaPlayerPresentationMode, "auto"> | "",
  next: Exclude<MediaPlayerPresentationMode, "auto">,
  width: number,
  height: number,
): Exclude<MediaPlayerPresentationMode, "auto"> {
  if (!current || current === next) {
    return next;
  }

  const ratio = width / Math.max(height, 1);
  if (current === "square" && ratio >= 0.72 && ratio <= 1.38 && height >= 150) {
    return "square";
  }
  if (current === "chip" && height <= 168 && ratio >= 1.7) {
    return "chip";
  }
  if (current === "compact" && width <= 300 && height <= 230) {
    return "compact";
  }
  if (current === "artwork" && ratio >= 0.72 && ratio <= 1.45 && height >= 160) {
    return "artwork";
  }
  return next;
}

export function resolvePresentationMode(
  mode: unknown,
  size: { width?: number; height?: number } = {},
  current: MediaPlayerPresentationMode | "" = "",
): Exclude<MediaPlayerPresentationMode, "auto"> {
  const requested = normalizePresentationMode(mode);
  if (requested !== "auto") {
    return requested;
  }

  const width = Number(size.width) || 0;
  const height = Number(size.height) || 0;
  if (!(width > 0) || !(height > 0)) {
    return current && current !== "auto" ? current : "standard";
  }

  const ratio = width / height;
  let next: Exclude<MediaPlayerPresentationMode, "auto"> = "standard";
  if (height <= 132 && ratio >= 2.05) {
    next = "chip";
  } else if (ratio >= 0.84 && ratio <= 1.18 && Math.min(width, height) >= 168) {
    next = "square";
  } else if (width <= 248 && height <= 210) {
    next = "compact";
  }

  const stableCurrent = current && current !== "auto" ? current : "";
  return keepCurrentIfClose(stableCurrent, next, width, height);
}

export function presentationGridOptions(mode: Exclude<MediaPlayerPresentationMode, "auto">): {
  rows: "auto";
  columns: "full" | number;
  min_rows: number;
  min_columns: number;
} {
  switch (mode) {
    case "square":
    case "artwork":
      return { rows: "auto", columns: 6, min_rows: 3, min_columns: 3 };
    case "chip":
      return { rows: "auto", columns: "full", min_rows: 1, min_columns: 6 };
    case "compact":
      return { rows: "auto", columns: 3, min_rows: 2, min_columns: 2 };
    default:
      return { rows: "auto", columns: "full", min_rows: 2, min_columns: 3 };
  }
}

export function isExplicitPresentationMode(
  value: unknown,
): value is (typeof EXPLICIT_MODES)[number] {
  return (EXPLICIT_MODES as readonly string[]).includes(String(value || ""));
}
