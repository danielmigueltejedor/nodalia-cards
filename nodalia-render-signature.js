/* Generated from src/shared/render-signature-runtime.ts. Do not edit. */
"use strict";
(() => {
  // src/shared/render-signature.ts
  function toKey(value) {
    if (value === null || value === void 0) return "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
    return String(value);
  }
  function joinParts(parts, sectionSeparator = "||", valueSeparator = "::") {
    return (Array.isArray(parts) ? parts : []).map((part) => {
      if (!part || typeof part !== "object" || !("values" in part) || !Array.isArray(part.values)) return "";
      const prefix = "prefix" in part ? String(part.prefix || "") : "";
      return `${prefix}${part.values.map((value) => toKey(value)).join(valueSeparator)}`;
    }).filter(Boolean).join(sectionSeparator);
  }
  var renderSignature = { joinParts, toKey };

  // src/shared/render-signature-runtime.ts
  if (typeof window !== "undefined" && !window.NodaliaRenderSignature) window.NodaliaRenderSignature = renderSignature;
})();
