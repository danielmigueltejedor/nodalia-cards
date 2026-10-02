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
  id?: string;
  is_admin?: boolean;
}

export interface HassConfig {
  components?: unknown;
  language?: string;
  unit_system?: {
    temperature?: string;
  };
}

export interface HomeAssistant {
  connected?:boolean;
  localize?:(key:string, replacements?:Record<string,string>)=>string;
  formatEntityState?: (state: HassEntity) => unknown;
  states: Record<string, HassEntity | undefined>;
  services?: Record<string,Record<string,unknown>>;
  areas?: unknown;
  devices?: unknown;
  entities?: unknown;
  entityRegistry?: unknown;
  entity_registry?: unknown;
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
    notifyOnError?: boolean,
    returnResponse?: boolean,
  ) => unknown;
  callApi?: (method: string, path: string, parameters?: unknown) => Promise<unknown>;
  auth?: { fetchWithAuth?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };
  callWS?: (message: Record<string, unknown>) => Promise<unknown>;
  connection?: {
    subscribeMessage?: (callback: (event: unknown) => void, message: Record<string, unknown>) => Promise<(() => void) | void>;
    sendMessagePromise?: (message: Record<string, unknown>) => Promise<unknown>;
  };
  hassUrl?: (path: string) => string;
  navigate?: (path: string) => void;
}

export type EntityId = string;
