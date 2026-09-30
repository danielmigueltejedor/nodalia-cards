const isUnknownArray = (value: unknown): value is unknown[] => Array.isArray(value);

export function moveItem<T>(array: T, fromIndex: number, toIndex: number): T {
  if (!isUnknownArray(array)) {
    return array;
  }

  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const removed = array.splice(fromIndex, 1);
  array.splice(toIndex, 0, ...removed);
  return array;
}

