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
const TILE_MAX_WIDTH = 960;
const CHIP_MIN_WIDTH = 960;
const COMPACT_MAX_WIDTH = 160;
/**
 * Prefer content-height compact tiles under this width when columns are unset.
 * Configured ≤6-col tiles never auto-square (see isConfiguredHalfWidthSpan) —
 * kiosk/desktop half-columns often land in the 300–480px band and 1:1 squares
 * left empty bands beside vacuum/light/fan in the same row.
 */
const SQUARE_MIN_WIDTH = 300;
/**
 * Auto square is only when section columns are unset. Wider cards (spans > 6)
 * stay standard so the entity icon / hero thumb remains visible.
 */
const SQUARE_MAX_WIDTH = 480;
const WIDE_GRID_COLUMNS = 6;

export type ResolvePresentationOptions = {
  preferSquareTiles?: boolean;
  /** Configured section grid span (1–12). Spans ≤6 stay compact; >6 never auto-square. */
  gridColumns?: number | null;
};

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

function isWideSectionSpan(gridColumns: number | null | undefined): boolean {
  const cols = Number(gridColumns);
  return Number.isFinite(cols) && cols > WIDE_GRID_COLUMNS;
}

/** Matches vacuum/light/fan: configured half-tiles stay content-height compact. */
function isConfiguredHalfWidthSpan(gridColumns: number | null | undefined): boolean {
  const cols = Number(gridColumns);
  return Number.isFinite(cols) && cols > 0 && cols <= WIDE_GRID_COLUMNS;
}

function canAutoSquare(
  preferSquareTiles: boolean,
  width: number,
  gridColumns: number | null | undefined,
): boolean {
  // Explicit ≤6-col spans mirror vacuum density; square only when columns are unset.
  if (
    !preferSquareTiles
    || isWideSectionSpan(gridColumns)
    || isConfiguredHalfWidthSpan(gridColumns)
  ) {
    return false;
  }
  return width >= SQUARE_MIN_WIDTH && width < SQUARE_MAX_WIDTH;
}

function keepCurrentIfClose(
  current: Exclude<MediaPlayerPresentationMode, "auto"> | "",
  next: Exclude<MediaPlayerPresentationMode, "auto">,
  width: number,
  height: number,
  preferSquareTiles: boolean,
  gridColumns: number | null | undefined,
): Exclude<MediaPlayerPresentationMode, "auto"> {
  if (!current || current === next) {
    return next;
  }

  if (!preferSquareTiles && (current === "square" || current === "artwork")) {
    return next;
  }

  // Leave square as soon as the card is a configured section span or too wide.
  if (
    (current === "square" || current === "artwork")
    && (
      isWideSectionSpan(gridColumns)
      || isConfiguredHalfWidthSpan(gridColumns)
      || width >= SQUARE_MAX_WIDTH
    )
  ) {
    return next;
  }

  if (preferSquareTiles && next === "square" && (current === "chip" || current === "compact")) {
    return canAutoSquare(preferSquareTiles, width, gridColumns) ? "square" : "compact";
  }

  if (
    preferSquareTiles
    && current === "square"
    && canAutoSquare(preferSquareTiles, width, gridColumns)
    && width < TILE_MAX_WIDTH
  ) {
    return "square";
  }

  const ratio = width / Math.max(height, 1);
  if (
    preferSquareTiles
    && current === "square"
    && canAutoSquare(preferSquareTiles, width, gridColumns)
    && ratio >= 0.72
    && ratio <= 1.38
    && height >= 150
  ) {
    return "square";
  }
  if (current === "chip" && width >= CHIP_MIN_WIDTH && height <= 168 && ratio >= 1.7) {
    return "chip";
  }
  if (current === "compact" && width < COMPACT_MAX_WIDTH && height <= 230) {
    return "compact";
  }
  if (
    preferSquareTiles
    && current === "artwork"
    && canAutoSquare(preferSquareTiles, width, gridColumns)
    && ratio >= 0.72
    && ratio <= 1.45
    && height >= 160
  ) {
    return "artwork";
  }
  return next;
}

export function resolvePresentationMode(
  mode: unknown,
  size: { width?: number; height?: number } = {},
  current: MediaPlayerPresentationMode | "" = "",
  options: ResolvePresentationOptions = {},
): Exclude<MediaPlayerPresentationMode, "auto"> {
  const requested = normalizePresentationMode(mode);
  if (requested !== "auto") {
    return requested;
  }

  const width = Number(size.width) || 0;
  const height = Number(size.height) || 0;
  const gridColumns = options.gridColumns;
  if (!(width > 0)) {
    // Avoid a transient standard/square footprint before the first measure.
    if (isConfiguredHalfWidthSpan(gridColumns)) {
      return "compact";
    }
    return current && current !== "auto" ? current : "standard";
  }

  const preferSquareTiles = options.preferSquareTiles !== false;
  const ratio = height > 0 ? width / height : 0;
  let next: Exclude<MediaPlayerPresentationMode, "auto"> = "standard";

  if (isConfiguredHalfWidthSpan(gridColumns)) {
    // columns: 6 (and below) must match vacuum/light/fan row rhythm — never 1:1.
    next = "compact";
  } else if (width >= CHIP_MIN_WIDTH && height > 0 && height <= 132 && ratio >= 2.05) {
    next = "chip";
  } else if (canAutoSquare(preferSquareTiles, width, gridColumns)) {
    next = "square";
  } else if (!preferSquareTiles && width <= 248) {
    next = "compact";
  } else if (preferSquareTiles && width < SQUARE_MIN_WIDTH) {
    next = "compact";
  } else if (
    preferSquareTiles
    && !isWideSectionSpan(gridColumns)
    && ratio >= 0.84
    && ratio <= 1.18
    && Math.min(width, height) >= 168
    && width < SQUARE_MAX_WIDTH
  ) {
    next = "square";
  }

  const stableCurrent = current && current !== "auto" ? current : "";
  return keepCurrentIfClose(stableCurrent, next, width, height, preferSquareTiles, gridColumns);
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
      // Keep section footprint at 2 rows (same as vacuum/light). Aspect-ratio
      // handles visual height; min_rows: 3 left empty gaps under half-width tiles.
      return { rows: "auto", columns: 6, min_rows: 2, min_columns: 3 };
    case "chip":
      return { rows: "auto", columns: "full", min_rows: 1, min_columns: 6 };
    case "compact":
      // Match Light/Fan section footprint (min_rows: 2) so narrow tiles stay
      // the same rhythm instead of collapsing shorter than sibling Nodalia cards.
      return { rows: "auto", columns: 6, min_rows: 2, min_columns: 2 };
    default:
      return { rows: "auto", columns: "full", min_rows: 2, min_columns: 3 };
  }
}

/** Idle/off tiles mirror Fav/Light chip height in sections (one row). */
export function idlePresentationGridOptions(): {
  rows: "auto";
  columns: number;
  min_rows: number;
  min_columns: number;
} {
  return { rows: "auto", columns: 6, min_rows: 1, min_columns: 2 };
}

export function isExplicitPresentationMode(
  value: unknown,
): value is (typeof EXPLICIT_MODES)[number] {
  return (EXPLICIT_MODES as readonly string[]).includes(String(value || ""));
}
