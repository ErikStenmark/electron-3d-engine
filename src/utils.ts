export const isArray = (val: any) => {
  return Array.isArray(val);
};

export const cloneArray = <T extends any[]>(items: T): T => {
  if (!items) {
    // @ts-expect-error
    return [] as T;
  }

  const res = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isArray(item)) {
      res[i] = cloneArray(item);
      continue;
    }

    if (typeof item === 'object') {
      res[i] = { ...item };
      continue;
    }

    res[i] = item;
  }

  return res as T;
}