export const isArray = (val: any) => {
  return Array.isArray(val);
};

export const shallowCloneArray = <T extends any[]>(items: T): T => {
  if (!items) {
    // @ts-expect-error
    return [] as T;
  }

  const res = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (isArray(item)) {
      res[i] = shallowCloneArray(item);
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

export const shallowCloneObject = <T extends Record<string, any>>(obj: T): T => {
  const res = {} as T;

  for (const key in obj) {
    const val = obj[key];

    if (isArray(val)) {
      res[key] = [...val] as any;
      continue;
    }

    if (typeof val === 'object') {
      res[key] = { ...val };
      continue;
    }

    res[key] = val;
  }

  return res;
}