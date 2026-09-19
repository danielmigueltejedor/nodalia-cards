/** Lovelace action tokens used across Nodalia cards. */
export type LovelaceActionName =
  | "more-info"
  | "none"
  | "toggle"
  | "navigate"
  | "url"
  | "call-service"
  | "perform-action"
  | "assist"
  | "auto"
  | (string & {});

export interface LovelaceActionConfig {
  action?: LovelaceActionName;
  navigation_path?: string;
  url_path?: string;
  service?: string;
  perform_action?: string;
  target?: Record<string, unknown>;
  data?: Record<string, unknown>;
  service_data?: Record<string, unknown>;
}

export interface ServiceCall {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: Record<string, unknown> | null;
}
