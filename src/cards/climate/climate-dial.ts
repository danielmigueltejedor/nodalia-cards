import {
  DIAL_CIRCLE_RADIUS,
  DIAL_END_ANGLE,
  DIAL_START_ANGLE,
  DIAL_SWEEP,
  DIAL_VIEWBOX_SIZE,
} from "./climate-constants";
import { clamp } from "./climate-runtime";

export function buildClimateDialModeButtonRows<T>(fragments: T[]): T[][] {
  const n = fragments.length;
  if (n === 0) {
    return [];
  }

  if (n < 3) {
    return [fragments];
  }

  if (n === 5 || n === 6) {
    return [fragments.slice(0, 3), fragments.slice(3)];
  }

  const rows = [fragments.slice(0, 2)];
  const rest = fragments.slice(2);
  let i = 0;
  while (i < rest.length) {
    const left = rest.length - i;
    if (left === 4) {
      rows.push(rest.slice(i, i + 2));
      rows.push(rest.slice(i + 2, i + 4));
      i += 4;
    } else if (left <= 3) {
      rows.push(rest.slice(i));
      i = rest.length;
    } else {
      rows.push(rest.slice(i, i + 2));
      i += 2;
    }
  }

  return rows;
}

export function getClimateDialCenterInsetCss(
  modeDialButtonCount: number,
  tightLayout: boolean,
  compactLayout: boolean,
): string {
  const pick = (tightStr: string, compactStr: string, regularStr: string): string => (
    tightLayout ? tightStr : compactLayout ? compactStr : regularStr
  );

  if (modeDialButtonCount === 5 || modeDialButtonCount === 6) {
    return pick("22% 12.5% 16.5% 12.5%", "23% 14% 17% 14%", "24% 14% 17.5% 14%");
  }
  if (modeDialButtonCount >= 7) {
    return pick("24% 12% 12% 12%", "25% 13.5% 13% 13.5%", "26% 14% 13.5% 14%");
  }
  if (modeDialButtonCount === 4) {
    return pick("24% 13.5% 15.5% 13.5%", "25% 15% 16.5% 15%", "26% 14.5% 17% 14.5%");
  }
  if (modeDialButtonCount === 3) {
    return pick("24% 14% 16% 14%", "25% 15% 17% 15%", "26% 15% 17.5% 15%");
  }
  return pick("22% 14% 16% 14%", "22% 15.5% 17% 15.5%", "21% 15% 18% 15%");
}

export interface ClimateDialRange {
  min: number;
  max: number;
}

export function getDialValueFromPoint(
  dial: { getBoundingClientRect(): DOMRect },
  clientX: number,
  clientY: number,
  range: ClimateDialRange,
  step: number,
  fallbackValue: number | null = null,
  geometry: DOMRect | null = null,
): number {
  const rect = geometry || dial.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : range.min;
  }

  const centerX = rect.left + (rect.width / 2);
  const centerY = rect.top + (rect.height / 2);
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const distance = Math.sqrt((dx ** 2) + (dy ** 2));
  const outerRadius = Math.min(rect.width, rect.height) / 2;
  const innerDeadZone = outerRadius * 0.42;

  if (distance < innerDeadZone && Number.isFinite(Number(fallbackValue))) {
    return Number(fallbackValue);
  }

  const angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
  let normalizedAngle = angle < 0 ? angle + 360 : angle;

  if (normalizedAngle < DIAL_START_ANGLE) {
    normalizedAngle += 360;
  }

  normalizedAngle = clamp(normalizedAngle, DIAL_START_ANGLE, DIAL_END_ANGLE);

  const ratio = (normalizedAngle - DIAL_START_ANGLE) / DIAL_SWEEP;
  const rawValue = range.min + ((range.max - range.min) * ratio);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 0.5;
  const rounded = range.min + (Math.round((rawValue - range.min) / safeStep) * safeStep);

  return clamp(Number(rounded.toFixed(2)), range.min, range.max);
}

export function getDialMarkerPosition(angle: number): { left: number; top: number } {
  const markerRadiusPercent = (DIAL_CIRCLE_RADIUS / DIAL_VIEWBOX_SIZE) * 100;
  const radians = (angle * Math.PI) / 180;
  return {
    left: Number((50 + (Math.cos(radians) * markerRadiusPercent)).toFixed(3)),
    top: Number((50 + (Math.sin(radians) * markerRadiusPercent)).toFixed(3)),
  };
}
