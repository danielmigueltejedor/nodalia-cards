export function restoreProtectedTranslationValues(translatedText, protectedValues) {
  let restored = String(translatedText ?? "");
  for (const { token, value } of protectedValues) {
    const index = String(token).match(/\d+/)?.[0];
    if (index === undefined) {
      return null;
    }
    const pattern = new RegExp(
      `__\\s*NODALIA\\s*_\\s*TOKEN\\s*_\\s*${index}\\s*__`,
      "gi",
    );
    if (!pattern.test(restored)) {
      return null;
    }
    restored = restored.replace(pattern, value);
  }
  return restored;
}
