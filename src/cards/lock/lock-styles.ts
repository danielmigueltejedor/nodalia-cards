export const DEFAULT_LOCK_STYLES = {
  card: {
    background: "var(--ha-card-background, var(--card-background-color, #1c1c20))",
    border: "1px solid var(--divider-color, #ffffff18)",
    border_radius: "var(--nodalia-card-border-radius, 28px)",
    box_shadow: "var(--ha-card-box-shadow, 0 8px 24px #0002)",
    padding: "var(--lock-card-padding, 16px)",
    gap: "var(--lock-card-gap, 14px)",
  },
  icon: {
    size: "var(--lock-icon-size, 38px)",
    background: "color-mix(in srgb, var(--primary-text-color) 6%, transparent)",
    on_color: "var(--success-color, #6acb9a)",
    off_color: "var(--state-inactive-color, color-mix(in srgb, var(--primary-text-color) 55%, transparent))",
  },
  control: {
    size: "var(--lock-handle-default, 42px)",
    background: "color-mix(in srgb, var(--primary-text-color) 8%, var(--lock-surface))",
  },
  chip_border_radius: "999px",
  title_size: "13px",
  chip_font_size: "11px",
};
export type LockStyles = typeof DEFAULT_LOCK_STYLES;
export type LockStylesInput = {
  card?: Partial<LockStyles["card"]>;
  icon?: Partial<LockStyles["icon"]>;
  control?: Partial<LockStyles["control"]>;
  chip_border_radius?: string;
  title_size?: string;
  chip_font_size?: string;
};
export function normalizeLockStyles(value: unknown): LockStyles {
  const utils = window.NodaliaUtils;
  const source = utils.isObject(value) ? value : {};
  const read = (group: unknown, key: string, fallback: string) => utils.sanitizeCssValue(utils.isObject(group) ? group[key] : undefined, fallback);
  const defaults = DEFAULT_LOCK_STYLES;
  return {
    card: {
      background: read(source.card, "background", defaults.card.background),
      border: read(source.card, "border", defaults.card.border),
      border_radius: read(source.card, "border_radius", defaults.card.border_radius),
      box_shadow: read(source.card, "box_shadow", defaults.card.box_shadow),
      padding: read(source.card, "padding", defaults.card.padding),
      gap: read(source.card, "gap", defaults.card.gap),
    },
    icon: {
      size: read(source.icon, "size", defaults.icon.size),
      background: read(source.icon, "background", defaults.icon.background),
      on_color: read(source.icon, "on_color", defaults.icon.on_color),
      off_color: read(source.icon, "off_color", defaults.icon.off_color),
    },
    control: {
      size: read(source.control, "size", defaults.control.size),
      background: read(source.control, "background", defaults.control.background),
    },
    chip_border_radius: read(source, "chip_border_radius", defaults.chip_border_radius),
    title_size: read(source, "title_size", defaults.title_size),
    chip_font_size: read(source, "chip_font_size", defaults.chip_font_size),
  };
}
