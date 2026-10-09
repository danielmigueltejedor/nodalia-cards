/**
 * Detects when the part of the HA entity catalog that entity auto-discovery reads has changed.
 *
 * Discovery looks only at entity ids, friendly names and registry identity, never at state
 * values, yet HA delivers a new `states` object on every state change. Comparing those few
 * fields against the previous catalog lets discovery results survive unrelated updates.
 */
type CatalogRecord = Record<string, unknown>;

const FIELDS = 5;

function record(value: unknown): CatalogRecord {
  return value !== null && typeof value === "object" ? value as CatalogRecord : {};
}

export class EntityCatalogStamp {
  /** Increases whenever a discovery-relevant field of any entity changed. */
  version = 0;
  private snapshotRef: unknown = null;
  private catalog: unknown[] = [];

  /**
   * Returns the current version for the HA object, advancing it if the catalog changed.
   * `trusted` lets a caller that already compared this exact HA object during the current
   * synchronous pass skip the comparison. Otherwise every call compares, so dictionaries that
   * HA or a wrapper mutates in place are still noticed.
   */
  update(hass: { states?: unknown; entities?: unknown } | null | undefined, trusted = false): number {
    if (trusted && hass && hass === this.snapshotRef) return this.version;
    const states = record(hass?.states);
    const registry = record(hass?.entities);
    const ids = Object.keys(states);
    const catalog = this.catalog;
    let same = catalog.length === ids.length * FIELDS;
    // Compare in place first: the usual HA update leaves the catalog untouched and allocates nothing.
    for (let index = 0; same && index < ids.length; index += 1) {
      const id = ids[index] as string;
      const attributes = record(record(states[id]).attributes);
      const entry = record(registry[id]);
      const offset = index * FIELDS;
      same = catalog[offset] === id
        && catalog[offset + 1] === attributes.friendly_name
        && catalog[offset + 2] === entry.device_id
        && catalog[offset + 3] === entry.original_name
        && catalog[offset + 4] === entry.translation_key;
    }
    if (!same) {
      const next: unknown[] = [];
      for (const id of ids) {
        const attributes = record(record(states[id]).attributes);
        const entry = record(registry[id]);
        next.push(id, attributes.friendly_name, entry.device_id, entry.original_name, entry.translation_key);
      }
      this.catalog = next;
      this.version += 1;
    }
    this.snapshotRef = hass ?? null;
    return this.version;
  }

  /** Forget the previous catalog, e.g. when the HA connection or user changed. */
  reset() {
    this.snapshotRef = null;
    this.catalog = [];
    this.version += 1;
  }
}
