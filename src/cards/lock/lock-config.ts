import { normalizeLockStyles } from "./lock-styles";
import type { LockStyles, LockStylesInput } from "./lock-styles";
import { parseFiniteNumericValue } from "../../shared/numeric-values";
export const CARD_TAG = "nodalia-lock-card";
export const EDITOR_TAG = "nodalia-lock-card-editor";
export { CARD_VERSION } from "../../version";
/** Same entrance default and bounds as the other content cards. */
export const LOCK_CONTENT_DURATION = 420;
export interface LockAnimationsConfig {
  enabled?: boolean;
  content_duration?: number | string;
}
export interface LockConfig {
  type?: string;
  entity: string;
  name?: string;
  layout?: "standard" | "compact";
  unlock_action?: "slider";
  show_name?: boolean;
  show_state?: boolean;
  animations?: LockAnimationsConfig;
  styles?: LockStylesInput;
}
export type NormalizedLockConfig = Omit<LockConfig, "styles" | "animations"> & Required<Pick<LockConfig, "layout" | "unlock_action" | "show_name" | "show_state">> & {
  animations: { enabled: boolean; content_duration: number };
  styles: LockStyles;
};
export function normalizeConfig(config: LockConfig): NormalizedLockConfig {
  if (!config || typeof config.entity !== "string" || !/^lock\.[a-z0-9_]+$/.test(config.entity)) {
    throw new Error("A lock entity is required");
  }
  if (config.unlock_action && config.unlock_action !== "slider") throw new Error("Unlocking requires the slider");
  const animations = typeof config.animations === "object" && config.animations !== null ? config.animations : {};
  const duration = parseFiniteNumericValue(animations.content_duration) || LOCK_CONTENT_DURATION;
  return {
    ...config,
    entity: config.entity,
    layout: config.layout === "compact" ? "compact" : "standard",
    unlock_action: "slider",
    show_name: config.show_name !== false,
    show_state: config.show_state !== false,
    animations: { enabled: animations.enabled !== false, content_duration: Math.min(1800, Math.max(140, Math.round(duration))) },
    styles: normalizeLockStyles(config.styles),
  };
}
