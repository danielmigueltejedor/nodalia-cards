import type { HomeAssistant } from "../../core/types/home-assistant";
export function lockText(hass: HomeAssistant | null, key: string): string {
  const language = window.NodaliaI18n?.resolveLanguage?.(hass) || "en";
  const strings = window.NodaliaI18n?.strings?.(language)?.lock as Record<string, string> | undefined;
  const fallback = window.NodaliaI18n?.strings?.("en")?.lock as Record<string, string> | undefined;
  return strings?.[key] || fallback?.[key] || key;
}
