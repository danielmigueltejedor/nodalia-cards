/**
 * Shared render-signature helpers for cards that want stable, auditable signatures
 * without JSON.stringify-heavy allocations.
 */
(function initNodaliaRenderSignature() {
  if (typeof window === "undefined") {
    return;
  }
  if (window.NodaliaRenderSignature) {
    return;
  }

  function toKey(value) {
    if (value === null || value === undefined) {
      return "";
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "";
    }
    return String(value);
  }

  function joinParts(parts, sectionSeparator = "||", valueSeparator = "::") {
    return (Array.isArray(parts) ? parts : [])
      .map(part => {
        if (!part || !Array.isArray(part.values)) {
          return "";
        }
        const prefix = String(part.prefix || "");
        const body = part.values.map(value => toKey(value)).join(valueSeparator);
        return `${prefix}${body}`;
      })
      .filter(Boolean)
      .join(sectionSeparator);
  }

  window.NodaliaRenderSignature = {
    joinParts,
    toKey,
  };
})();
