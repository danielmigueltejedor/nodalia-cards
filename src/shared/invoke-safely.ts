export function invokeSafely<T>(action: () => T): { ok: true; value: T } | { ok: false } {
  try {
    return { ok: true, value: action() };
  } catch {
    return { ok: false };
  }
}
