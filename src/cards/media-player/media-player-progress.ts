import type { PlaybackProgress } from "./media-player-types";

/** Home Assistant `MediaPlayerEntityFeature.SEEK`. */
export const MEDIA_PLAYER_FEATURE_SEEK = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string,unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {return isRecord(value) ? value : {};}

export function supportsMediaSeek(state: unknown): boolean {
  const features = Number(record(record(state).attributes).supported_features || 0);
  return Number.isFinite(features) && (features & MEDIA_PLAYER_FEATURE_SEEK) !== 0;
}

export function interpolatePlaybackProgress(state: unknown, now: number = Date.now()): PlaybackProgress | null {
  const entity = record(state);
  const attrs = record(entity.attributes);
  const duration = Number(attrs.media_duration || 0);
  if (!Number.isFinite(duration) || !(duration > 0)) return null;
  const rawPosition = Number(attrs.media_position || 0);
  let position = Number.isFinite(rawPosition) ? rawPosition : 0;
  const updatedAt = attrs.media_position_updated_at;
  if (entity.state === "playing" && updatedAt && Number.isFinite(now)) {
    const timestamp = new Date(String(updatedAt)).getTime();
    if (Number.isFinite(timestamp)) position += Math.max(0, (now - timestamp) / 1000);
  }
  position = clamp(position, 0, duration);
  return {duration, position, percent: clamp(position / duration * 100, 0, 100)};
}

export function progressPercentFromClientX(
  track: { getBoundingClientRect(): DOMRect },
  clientX: number,
): number {
  const rect = track.getBoundingClientRect();
  if (!Number.isFinite(clientX) || !Number.isFinite(rect.left) || !Number.isFinite(rect.width) || !(rect.width > 0)) {
    return 0;
  }
  return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
}

export function seekPositionFromPercent(percent: number, duration: number): number {
  if (!Number.isFinite(percent) || !Number.isFinite(duration) || !(duration > 0)) {
    return 0;
  }
  return clamp((Number(percent) / 100) * duration, 0, duration);
}
