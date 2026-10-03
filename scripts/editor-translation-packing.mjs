/** Keep the first label verbatim and refer to it when it repeats in the same locale. */
export function encodeLabelReferences(labels) {
  const firstIndex = new Map();
  return labels.map((label, index) => {
    if (typeof label !== "string") throw new TypeError("Editor labels must be strings");
    const previous = firstIndex.get(label);
    if (previous !== undefined) return previous;
    firstIndex.set(label, index);
    return label;
  });
}
