/**
 * Minimal Home Assistant surfaces actually read by Nodalia Cards.
 * These are local contracts, not a reimplementation of HA's unpublished typings.
 */

export interface HassEntityAttributes {
  friendly_name?: string;
  icon?: string;
  entity_picture?: string;
  supported_features?: number;
  [key: string]: unknown;
}

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: HassEntityAttributes;
  last_changed?: string;
  last_updated?: string;
}

export interface HassLocale {
  language?: string;
}

export interface HassUser {
  is_admin?: boolean;
}

export interface HassConfig {
  unit_system?: {
    temperature?: string;
  };
}

export interface HomeAssistant {
  states: Record<string, HassEntity | undefined>;
  locale?: HassLocale;
  language?: string;
  selectedLanguage?: string;
  user?: HassUser;
  config?: HassConfig;
  callService?: (
    domain: string,
    service: string,
    data?: Record<string, unknown>,
    target?: Record<string, unknown>,
  ) => unknown;
  connection?: {
    sendMessagePromise?: (message: Record<string, unknown>) => Promise<unknown>;
  };
  navigate?: (path: string) => void;
}

export type EntityId = string;
