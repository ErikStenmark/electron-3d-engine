const isArray = (val: any) => {
  return Array.isArray(val);
};

const isObject = (val: any) => {
  return {}.toString.call(val) === '[object Object]' && !isArray(val);
};

export const clone = <T extends {}>(val: T, history = null): T => {
  const stack = history || new Set();

  if (stack.has(val)) {
    return val;
  }

  stack.add(val);

  const copyObject = <T extends { [key: string]: any }>(o: T) => {
    const oo = Object.create({});
    for (const k in o) {
      oo[k] = clone(o[k], stack as any);
    }
    return oo;
  };

  const copyArray = <T = []>(a: Array<T>): Array<T> => {
    return [...a].map((e: any) => {
      if (isArray(e)) {
        return copyArray(e);
      } else if (isObject(e)) {
        return copyObject(e);
      }
      return clone(e, stack as any);
    });
  };

  if (isArray(val)) {
    return copyArray(val as any) as unknown as T;
  }

  if (isObject(val)) {
    return copyObject(val);
  }

  return val;
};