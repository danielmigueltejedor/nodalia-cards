import type { PlaybackProgress } from "./media-player-types";

/** Home Assistant `MediaPlayerEntityFeature.SEEK`. */
export const MEDIA_PLAYER_FEATURE_SEEK = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function supportsMediaSeek(state: unknown): boolean {
  const features = Number(
    (state as { attributes?: { supported_features?: unknown } } | null)?.attributes?.supported_features || 0,
  );
  return Number.isFinite(features) && (features & MEDIA_PLAYER_FEATURE_SEEK) !== 0;
}

export function interpolatePlaybackProgress(
  state: unknown,
  now: number = Date.now(),
): PlaybackProgress | null {
  const entity = state as {
    state?: string;
    attributes?: {
      media_duration?: unknown;
      media_position?: unknown;
      media_position_updated_at?: unknown;
    };
  } | null;
  const duration = Number(entity?.attributes?.media_duration || 0);
  if (!(duration > 0)) {
    return null;
  }

  let position = Number(entity?.attributes?.media_position || 0);
  const updatedAt = entity?.attributes?.media_position_updated_at;
  if (entity?.state === "playing" && updatedAt) {
    const updatedAtTime = new Date(String(updatedAt)).getTime();
    if (!Number.isNaN(updatedAtTime)) {
      position += Math.max(0, (now - updatedAtTime) / 1000);
    }
  }

  position = clamp(position, 0, duration);
  return {
    duration,
    position,
    percent: clamp((position / duration) * 100, 0, 100),
  };
}

export function progressPercentFromClientX(
  track: { getBoundingClientRect(): DOMRect },
  clientX: number,
): number {
  const rect = track.getBoundingClientRect();
  if (!(rect.width > 0)) {
    return 0;
  }
  return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
}

export function seekPositionFromPercent(percent: number, duration: number): number {
  if (!(duration > 0)) {
    return 0;
  }
  return clamp((Number(percent) / 100) * duration, 0, duration);
}
