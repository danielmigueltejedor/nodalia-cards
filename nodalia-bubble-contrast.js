(function initNodaliaBubbleContrast() {
  const existing = typeof window !== "undefined" ? window.NodaliaBubbleContrast : null;
  if (existing && typeof existing.shouldDarkenBubbleIconGlyph === "function") {
    return;
  }

  function normalizeTextKey(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function getEntityDomain(state) {
    const entityId = String(state?.entity_id || "");
    return entityId.includes(".") ? entityId.split(".")[0] : "";
  }

  function resolveEditorColorValue(value) {
    const rawValue = String(value ?? "").trim();
    if (!rawValue || typeof document === "undefined") {
      return "";
    }

    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.opacity = "0";
    probe.style.pointerEvents = "none";
    probe.style.color = "";
    probe.style.color = rawValue;
    if (!probe.style.color) {
      return rawValue;
    }

    (document.body || document.documentElement).appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved || rawValue;
  }

  function rgbToHueDegrees(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    if (d < 1 / 255) {
      return null;
    }
    let h;
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
    return h;
  }

  function parseCssColorHue(cssColor, resolveDepth = 0) {
    const raw = String(cssColor || "").trim();
    if (!raw) {
      return null;
    }

    const varFallback = /\bvar\([^,]+,\s*([^)]+)\)/i.exec(raw);
    if (varFallback) {
      const nested = parseCssColorHue(varFallback[1].trim(), resolveDepth);
      if (nested !== null && !Number.isNaN(nested)) {
        return nested;
      }
    }

    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
    if (hex) {
      let digits = hex[1];
      if (digits.length === 3) {
        digits = digits
          .split("")
          .map(ch => ch + ch)
          .join("");
      }
      const r = parseInt(digits.slice(0, 2), 16);
      const g = parseInt(digits.slice(2, 4), 16);
      const b = parseInt(digits.slice(4, 6), 16);
      return rgbToHueDegrees(r, g, b);
    }

    const rgbFn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(raw);
    if (rgbFn) {
      return rgbToHueDegrees(Number(rgbFn[1]), Number(rgbFn[2]), Number(rgbFn[3]));
    }

    if (resolveDepth === 0 && typeof document !== "undefined") {
      const resolved = resolveEditorColorValue(raw);
      const resolvedTrim = String(resolved || "").trim();
      if (resolvedTrim && resolvedTrim !== raw) {
        return parseCssColorHue(resolvedTrim, 1);
      }
    }

    return null;
  }

  function isHueCoolTintPoorContrast(hue) {
    if (hue === null || Number.isNaN(hue)) {
      return false;
    }
    if (hue >= 65 && hue <= 155) {
      return true;
    }
    if (hue >= 165 && hue <= 275) {
      return true;
    }
    if (hue >= 300 || hue <= 20) {
      return true;
    }
    return false;
  }

  function inferCoolTintFromEntity(state) {
    if (!state) {
      return false;
    }
    const domain = getEntityDomain(state);
    const dc = normalizeTextKey(state.attributes?.device_class || "");
    const unit = normalizeTextKey(
      String(state.attributes?.unit_of_measurement || state.attributes?.native_unit_of_measurement || ""),
    );

    if (domain === "sensor") {
      if (
        /(^|_)power($|_)|energy|current|voltage|battery|frequency|humidity|moisture|temperature|pressure/.test(dc)
      ) {
        return true;
      }
      if (/\b(kwh|mwh|wh|kw|mw|ma|mv|hz|a|v)\b|\bw\b/.test(unit)) {
        return true;
      }
    }

    if (domain === "binary_sensor" && /moisture|battery/.test(dc)) {
      return true;
    }

    return false;
  }

  function shouldDarkenBubbleIconGlyph(state, accentColor) {
    if (!state) {
      return false;
    }
    const hue = parseCssColorHue(accentColor);
    if (hue !== null && !Number.isNaN(hue)) {
      return isHueCoolTintPoorContrast(hue);
    }
    return inferCoolTintFromEntity(state);
  }

  if (typeof window !== "undefined") {
    window.NodaliaBubbleContrast = {
      resolveEditorColorValue,
      parseCssColorHue,
      shouldDarkenBubbleIconGlyph,
    };
  }
})();
