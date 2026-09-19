/** Subset of Nodalia Engine handshake/status used by cards and editors. */
export interface NodaliaEngineStatus {
  available?: boolean;
  version?: string;
  api_version?: number;
  api_min_version?: number;
  api_max_version?: number;
  caps?: {
    climateSchedules?: boolean;
    notifications?: boolean;
    [key: string]: boolean | undefined;
  };
}

export interface NodaliaBackendApi {
  getEditorEngineStatus?: (hass: unknown) => Promise<NodaliaEngineStatus>;
  setClimateSchedule?: (hass: unknown, payload: Record<string, unknown>) => Promise<unknown>;
  [key: string]: unknown;
}

export interface NodaliaEngineOverrideState {
  active?: boolean;
  until?: string;
  [key: string]: unknown;
}
