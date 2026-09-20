export interface RoomSummaryPublicApi {
  CARD_VERSION: string;
  normalizeConfig: (rawConfig?: unknown) => Record<string, unknown>;
  normalizeEntityField: (...args: unknown[]) => unknown;
  hubMediaPlayerIds: (...args: unknown[]) => unknown;
  hubSecurityEntityIds: (...args: unknown[]) => unknown;
  hubAlarmEntityIds: (...args: unknown[]) => unknown;
  buildRoomSummary: (...args: unknown[]) => unknown;
  hasRoomContent: (...args: unknown[]) => unknown;
  formatMetric: (...args: unknown[]) => unknown;
  getState: (...args: unknown[]) => unknown;
}
