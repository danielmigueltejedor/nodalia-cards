export const CARD_TAG = "nodalia-calendar-card";
export const EDITOR_TAG = "nodalia-calendar-card-editor";
export const CARD_VERSION = "2.3.0-alpha.26";
export const NODALIA_EVENT_METADATA_RE = /<!--\s*nodalia:event(?:\s+color="([^"]+)")?\s*-->/gi;
export const HAPTIC_PATTERNS = {
  selection: 8,
  light: 10,
  medium: 16,
  heavy: 24,
  success: [10, 40, 10],
  warning: [20, 50, 12],
  failure: [12, 40, 12, 40, 18],
};

/** Matches Home Assistant `calendar/event/delete` + frontend `RecurrenceRange`. */
export const CALENDAR_DELETE_RECURRENCE_THIS = "";
export const CALENDAR_DELETE_RECURRENCE_THIS_AND_FUTURE = "THISANDFUTURE";

export const VALID_TIME_RANGES = ["3d", "1w", "2w", "1m"];
export const DATE_TIME_FORMATTER_CACHE_LIMIT = 48;
export const dateTimeFormatterCache = new Map();
