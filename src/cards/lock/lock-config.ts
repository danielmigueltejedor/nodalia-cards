import { normalizeLockStyles } from "./lock-styles";
import type { LockStyles, LockStylesInput } from "./lock-styles";
export const CARD_TAG = "nodalia-lock-card";
export const EDITOR_TAG = "nodalia-lock-card-editor";
export { CARD_VERSION } from "../../version";
export interface LockConfig {
  type?: string;
  entity: string;
  name?: string;
  layout?: "standard" | "compact";
  unlock_action?: "slider";
  show_name?: boolean;
  show_state?: boolean;
  styles?: LockStylesInput;
}
export type NormalizedLockConfig = Omit<LockConfig, "styles"> & Required<Pick<LockConfig, "layout" | "unlock_action" | "show_name" | "show_state">> & { styles: LockStyles };
export function normalizeConfig(config: LockConfig): NormalizedLockConfig {
  if (!config || typeof config.entity !== "string" || !/^lock\.[a-z0-9_]+$/.test(config.entity)) {
    throw new Error("A lock entity is required");
  }
  if (config.unlock_action && config.unlock_action !== "slider") throw new Error("Unlocking requires the slider");
  return {
    ...config,
    entity: config.entity,
    layout: config.layout === "compact" ? "compact" : "standard",
    unlock_action: "slider",
    show_name: config.show_name !== false,
    show_state: config.show_state !== false,
    styles: normalizeLockStyles(config.styles),
  };
}
