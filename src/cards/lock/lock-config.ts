export const CARD_TAG = "nodalia-lock-card";
export const EDITOR_TAG = "nodalia-lock-card-editor";
export const CARD_VERSION = "2.3.0-alpha.47";
export interface LockConfig {
  type?: string;
  entity: string;
  name?: string;
  layout?: "standard" | "compact";
  unlock_action?: "slider";
  show_name?: boolean;
  show_state?: boolean;
}
export function normalizeConfig(config: LockConfig): LockConfig {
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
  };
}
