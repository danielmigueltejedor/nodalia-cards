import { bubbleContrast } from "./bubble-contrast";
const existing = typeof window !== "undefined" ? window.NodaliaBubbleContrast : undefined;
if (typeof window !== "undefined" && !(existing
  && typeof existing.shouldDarkenBubbleIconGlyph === "function"
  && typeof existing.resolveBubbleIconGlyphColor === "function"
  && typeof existing.normalizeNeutralBubbleBackground === "function")) {
  window.NodaliaBubbleContrast = bubbleContrast;
}
