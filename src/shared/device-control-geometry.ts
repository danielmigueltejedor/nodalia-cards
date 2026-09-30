/** Shared pointer math for the identical Fan, Humidifier and Cover controls. */
export const CIRCULAR_LAYOUT_DIAL_START_ANGLE = 135;
export const CIRCULAR_LAYOUT_DIAL_END_ANGLE = 405;
export const CIRCULAR_LAYOUT_DIAL_SWEEP = CIRCULAR_LAYOUT_DIAL_END_ANGLE - CIRCULAR_LAYOUT_DIAL_START_ANGLE;

export interface DialGeometry { left: number; top: number; width: number; height: number }
export interface DialRange { min?: unknown; max?: unknown }
export interface SliderDragGeometry { left: number; width: number; min: number; max: number; step: number }
export interface RangeInput extends Pick<HTMLInputElement, "value" | "min" | "max" | "step" | "getBoundingClientRect"> {}

const clampGeometryValue = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export function getRangeValueFromClientX(slider: RangeInput, clientX: number) {
  const rect = slider.getBoundingClientRect();
  if (!rect.width) {
    return Number(slider.value || 0);
  }

  const min = Number(slider.min || 0);
  const max = Number(slider.max || 100);
  const step = slider.step === "any" ? 0 : Number(slider.step || 1);
  const ratio = clampGeometryValue((clientX - rect.left) / rect.width, 0, 1);
  let nextValue = min + ((max - min) * ratio);

  if (Number.isFinite(step) && step > 0) {
    nextValue = min + (Math.round((nextValue - min) / step) * step);
  }

  return clampGeometryValue(nextValue, min, max);
}

export function getSliderDragGeometry(slider: RangeInput): SliderDragGeometry {
  const rect = slider.getBoundingClientRect();
  return {
    left: rect.left,
    width: rect.width,
    min: Number(slider.min || 0),
    max: Number(slider.max || 100),
    step: slider.step === "any" ? 0 : Number(slider.step || 1),
  };
}

export function getRangeValueFromGeometry(geometry: SliderDragGeometry | null | undefined, currentValue: unknown, clientX: number) {
  if (!geometry || !Number.isFinite(geometry.width) || geometry.width <= 0) {
    return Number(currentValue || 0);
  }
  const ratio = clampGeometryValue((clientX - geometry.left) / geometry.width, 0, 1);
  let nextValue = geometry.min + ((geometry.max - geometry.min) * ratio);
  if (Number.isFinite(geometry.step) && geometry.step > 0) {
    nextValue = geometry.min + (Math.round((nextValue - geometry.min) / geometry.step) * geometry.step);
  }
  return clampGeometryValue(nextValue, geometry.min, geometry.max);
}

export function getCircularLayoutDialModel(value: unknown, min: unknown = 0, max: unknown = 100) {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const safeMax = Number.isFinite(Number(max)) && Number(max) > safeMin ? Number(max) : Math.max(100, safeMin + 1);
  const safeValue = clampGeometryValue(Number.isFinite(Number(value)) ? Number(value) : safeMin, safeMin, safeMax);
  const ratio = clampGeometryValue((safeValue - safeMin) / (safeMax - safeMin), 0, 1);
  const angle = CIRCULAR_LAYOUT_DIAL_START_ANGLE + (ratio * CIRCULAR_LAYOUT_DIAL_SWEEP);
  const radians = angle * (Math.PI / 180);
  const markerRadius = 86;
  return {
    progress: Number((ratio * 75).toFixed(3)),
    markerLeft: Number((((120 + (Math.cos(radians) * markerRadius)) / 240) * 100).toFixed(3)),
    markerTop: Number((((120 + (Math.sin(radians) * markerRadius)) / 240) * 100).toFixed(3)),
  };
}

export function getCircularLayoutDialValueFromPoint(dial: Pick<Element, "getBoundingClientRect"> | null | undefined, clientX: number, clientY: number, range: DialRange | null | undefined, step: number, fallbackValue: unknown = null, geometry: DialGeometry | null = null) {
  const rect = geometry || dial?.getBoundingClientRect?.();
  const safeMin = Number.isFinite(Number(range?.min)) ? Number(range?.min) : 0;
  const safeMax = Number.isFinite(Number(range?.max)) && Number(range?.max) > safeMin ? Number(range?.max) : Math.max(100, safeMin + 1);
  if (!rect?.width || !rect?.height) {
    return Number.isFinite(Number(fallbackValue)) ? Number(fallbackValue) : safeMin;
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
  const gapStart = CIRCULAR_LAYOUT_DIAL_END_ANGLE % 360;
  const gapEnd = CIRCULAR_LAYOUT_DIAL_START_ANGLE;
  if (
    normalizedAngle > gapStart
    && normalizedAngle < gapEnd
    && Number.isFinite(Number(fallbackValue))
  ) {
    return Number(fallbackValue);
  }
  if (normalizedAngle < CIRCULAR_LAYOUT_DIAL_START_ANGLE) {
    normalizedAngle += 360;
  }
  normalizedAngle = clampGeometryValue(normalizedAngle, CIRCULAR_LAYOUT_DIAL_START_ANGLE, CIRCULAR_LAYOUT_DIAL_END_ANGLE);

  const ratio = (normalizedAngle - CIRCULAR_LAYOUT_DIAL_START_ANGLE) / CIRCULAR_LAYOUT_DIAL_SWEEP;
  const rawValue = safeMin + ((safeMax - safeMin) * ratio);
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1;
  const rounded = safeMin + (Math.round((rawValue - safeMin) / safeStep) * safeStep);
  return clampGeometryValue(rounded, safeMin, safeMax);
}

