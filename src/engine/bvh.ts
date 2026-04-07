import { Obj, Vec3, Vec4 } from './types';
import VecMat, { Mat4x4 } from './vecmat';

export type AABB = { min: Vec3; max: Vec3 };

export type BVHLeaf = {
  isLeaf: true;
  aabb: AABB;
  objectIndex: number;
};

export type BVHInternal = {
  isLeaf: false;
  aabb: AABB;
  left: BVHNode;
  right: BVHNode;
};

export type BVHNode = BVHLeaf | BVHInternal;

export type BVHResult = {
  root: BVHNode | null;
  worldAABBs: AABB[];
};

function unionAABB(a: AABB, b: AABB): AABB {
  return {
    min: [
      Math.min(a.min[0], b.min[0]),
      Math.min(a.min[1], b.min[1]),
      Math.min(a.min[2], b.min[2]),
    ],
    max: [
      Math.max(a.max[0], b.max[0]),
      Math.max(a.max[1], b.max[1]),
      Math.max(a.max[2], b.max[2]),
    ],
  };
}

function buildNode(indices: number[], aabbs: AABB[]): BVHNode {
  if (indices.length === 1) {
    return { isLeaf: true, aabb: aabbs[indices[0]], objectIndex: indices[0] };
  }

  if (indices.length === 2) {
    return {
      isLeaf: false,
      aabb: unionAABB(aabbs[indices[0]], aabbs[indices[1]]),
      left: { isLeaf: true, aabb: aabbs[indices[0]], objectIndex: indices[0] },
      right: { isLeaf: true, aabb: aabbs[indices[1]], objectIndex: indices[1] },
    };
  }

  // Find longest axis of centroid spread
  let minC: Vec3 = [Infinity, Infinity, Infinity];
  let maxC: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < indices.length; i++) {
    const a = aabbs[indices[i]];
    const cx = (a.min[0] + a.max[0]) * 0.5;
    const cy = (a.min[1] + a.max[1]) * 0.5;
    const cz = (a.min[2] + a.max[2]) * 0.5;
    if (cx < minC[0]) minC[0] = cx;
    if (cy < minC[1]) minC[1] = cy;
    if (cz < minC[2]) minC[2] = cz;
    if (cx > maxC[0]) maxC[0] = cx;
    if (cy > maxC[1]) maxC[1] = cy;
    if (cz > maxC[2]) maxC[2] = cz;
  }

  const dx = maxC[0] - minC[0];
  const dy = maxC[1] - minC[1];
  const dz = maxC[2] - minC[2];
  const axis = dx >= dy && dx >= dz ? 0 : dy >= dz ? 1 : 2;

  // Sort by centroid on chosen axis
  indices.sort((a, b) => {
    const ca = (aabbs[a].min[axis] + aabbs[a].max[axis]) * 0.5;
    const cb = (aabbs[b].min[axis] + aabbs[b].max[axis]) * 0.5;
    return ca - cb;
  });

  const mid = indices.length >> 1;
  const left = buildNode(indices.slice(0, mid), aabbs);
  const right = buildNode(indices.slice(mid), aabbs);

  return {
    isLeaf: false,
    aabb: unionAABB(left.aabb, right.aabb),
    left,
    right,
  };
}

export function buildBVH(objects: Obj[], vecMat: VecMat): BVHResult {
  const worldAABBs: AABB[] = new Array(objects.length);
  for (let i = 0; i < objects.length; i++) {
    const { min, max } = vecMat.getWorldAABB(objects[i].modelMatrix, objects[i].dimensions);
    worldAABBs[i] = { min, max };
  }

  if (objects.length === 0) {
    return { root: null, worldAABBs };
  }

  const indices: number[] = new Array(objects.length);
  for (let i = 0; i < objects.length; i++) indices[i] = i;

  return { root: buildNode(indices, worldAABBs), worldAABBs };
}

function aabbInFrustum(planes: Vec4[], min: Vec3, max: Vec3): boolean {
  for (let i = 0; i < 6; i++) {
    const a = planes[i][0], b = planes[i][1], c = planes[i][2], d = planes[i][3];
    const px = a >= 0 ? max[0] : min[0];
    const py = b >= 0 ? max[1] : min[1];
    const pz = c >= 0 ? max[2] : min[2];
    if (a * px + b * py + c * pz + d < 0) return false;
  }
  return true;
}

export function queryFrustum(root: BVHNode | null, planes: Vec4[]): number[] {
  if (!root) return [];
  const result: number[] = [];
  const stack: BVHNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (!aabbInFrustum(planes, node.aabb.min, node.aabb.max)) continue;

    if (node.isLeaf) {
      result.push(node.objectIndex);
    } else {
      stack.push(node.left, node.right);
    }
  }

  return result;
}

export function queryPoint(root: BVHNode | null, point: Vec3): number[] {
  if (!root) return [];
  const result: number[] = [];
  const stack: BVHNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const { min, max } = node.aabb;
    if (point[0] < min[0] || point[0] > max[0] ||
        point[1] < min[1] || point[1] > max[1] ||
        point[2] < min[2] || point[2] > max[2]) continue;

    if (node.isLeaf) {
      result.push(node.objectIndex);
    } else {
      stack.push(node.left, node.right);
    }
  }

  return result;
}

function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.min[0] <= b.max[0] && a.max[0] >= b.min[0]
      && a.min[1] <= b.max[1] && a.max[1] >= b.min[1]
      && a.min[2] <= b.max[2] && a.max[2] >= b.min[2];
}

export function queryAllPairs(root: BVHNode | null): [number, number][] {
  if (!root) return [];
  const result: [number, number][] = [];
  selfOverlap(root, root, result);
  return result;
}

function selfOverlap(a: BVHNode, b: BVHNode, result: [number, number][]): void {
  if (!aabbOverlap(a.aabb, b.aabb)) return;

  if (a.isLeaf && b.isLeaf) {
    if (a.objectIndex < b.objectIndex) {
      result.push([a.objectIndex, b.objectIndex]);
    }
    return;
  }

  if (a.isLeaf) {
    selfOverlap(a, (b as BVHInternal).left, result);
    selfOverlap(a, (b as BVHInternal).right, result);
    return;
  }

  if (b.isLeaf) {
    selfOverlap((a as BVHInternal).left, b, result);
    selfOverlap((a as BVHInternal).right, b, result);
    return;
  }

  const ai = a as BVHInternal;
  const bi = b as BVHInternal;
  if (a === b) {
    // Same node: recurse into children pairs
    selfOverlap(ai.left, ai.left, result);
    selfOverlap(ai.left, ai.right, result);
    selfOverlap(ai.right, ai.right, result);
  } else {
    selfOverlap(ai.left, bi.left, result);
    selfOverlap(ai.left, bi.right, result);
    selfOverlap(ai.right, bi.left, result);
    selfOverlap(ai.right, bi.right, result);
  }
}
