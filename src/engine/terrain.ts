import VecMat, { Mat4x4 } from './vecmat';
import { Object3D } from '../obj';
import { Obj, ObjVertex, ObjTriangle, ObjDimensions, Vec4 } from './types';

// --- Perlin noise ---

function buildPermutationTable(seed: number): Uint8Array {
  const p = new Uint8Array(512);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Seeded shuffle (xorshift32)
  let s = seed | 0 || 1;
  for (let i = 255; i > 0; i--) {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    const j = ((s >>> 0) % (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  for (let i = 0; i < 256; i++) p[i + 256] = p[i];
  return p;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

function perlin2d(x: number, y: number, perm: Uint8Array): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);

  const aa = perm[perm[xi] + yi];
  const ab = perm[perm[xi] + yi + 1];
  const ba = perm[perm[xi + 1] + yi];
  const bb = perm[perm[xi + 1] + yi + 1];

  return lerp(
    lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
    lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
    v
  );
}

function fbm(
  x: number, y: number, perm: Uint8Array,
  octaves: number, lacunarity: number, persistence: number
): number {
  let value = 0, amplitude = 1, frequency = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    value += perlin2d(x * frequency, y * frequency, perm) * amplitude;
    max += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / max;
}

// --- Heightmap generation ---

export type HeightmapOptions = {
  seed?: number;
  octaves?: number;
  noiseScale?: number;
  lacunarity?: number;
  persistence?: number;
  /** World-space offset for chunk-based generation. Same world position = same height. */
  worldOffsetX?: number;
  worldOffsetZ?: number;
  /** World-space size of the chunk (used to map grid to world coords) */
  worldSize?: number;
};

/** Shared permutation table cache keyed by seed */
const permCache = new Map<number, Uint8Array>();

function getPermTable(seed: number): Uint8Array {
  let perm = permCache.get(seed);
  if (!perm) {
    perm = buildPermutationTable(seed);
    permCache.set(seed, perm);
  }
  return perm;
}

export function generateHeightmap(
  resolution: number,
  options: HeightmapOptions = {}
): Float32Array {
  const {
    seed = 1,
    octaves = 4,
    noiseScale = 1,
    lacunarity = 2,
    persistence = 0.5,
    worldOffsetX = 0,
    worldOffsetZ = 0,
    worldSize = 1,
  } = options;

  const perm = getPermTable(seed);
  const cols = resolution + 1;
  const map = new Float32Array(cols * cols);

  for (let r = 0; r <= resolution; r++) {
    for (let c = 0; c <= resolution; c++) {
      // Map grid position to world-space, then to noise-space
      const worldX = worldOffsetX + (c / resolution) * worldSize;
      const worldZ = worldOffsetZ + (r / resolution) * worldSize;
      const nx = worldX * noiseScale;
      const nz = worldZ * noiseScale;
      const val = fbm(nx, nz, perm, octaves, lacunarity, persistence);
      // Map from ~[-1,1] to [0,1]
      map[r * cols + c] = (val + 1) * 0.5;
    }
  }

  return map;
}

/**
 * Raises the edges of a heightmap to create a natural bowl, preventing
 * objects from falling off. The border width controls how many cells
 * from the edge are affected. Values blend smoothly from 1.0 at the
 * very edge down to the original heightmap value.
 */
export function raiseEdges(
  heightmap: Float32Array,
  resolution: number,
  borderWidth = 6,
  edgeHeight = 1.0,
  skip?: ('north' | 'south' | 'east' | 'west')[],
): Float32Array {
  const cols = resolution + 1;
  for (let r = 0; r <= resolution; r++) {
    for (let c = 0; c <= resolution; c++) {
      const distances: number[] = [];
      if (!skip?.includes('north')) distances.push(r);
      if (!skip?.includes('south')) distances.push(resolution - r);
      if (!skip?.includes('west')) distances.push(c);
      if (!skip?.includes('east')) distances.push(resolution - c);
      if (!distances.length) continue;

      const distFromEdge = Math.min(...distances);
      if (distFromEdge < borderWidth) {
        const t = 1 - distFromEdge / borderWidth;
        const blend = t * t;
        const i = r * cols + c;
        heightmap[i] = heightmap[i] + (edgeHeight - heightmap[i]) * blend;
      }
    }
  }
  return heightmap;
}

/**
 * Blend one edge of the terrain heightmap so it smoothly matches
 * the height of an adjacent mesh (e.g. mountains).
 *
 * Raycasts downward through the mesh at each terrain edge column to
 * sample exact surface heights, then blends the heightmap inward.
 */
export function blendEdgeToMesh(
  heightmap: Float32Array,
  resolution: number,
  size: number,
  heightScale: number,
  mesh: Object3D,
  vecMat: VecMat,
  edge: 'north' | 'south' | 'east' | 'west',
  blendWidth = 10,
): void {
  const obj = mesh.get();
  const invModel = vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
  if (!invModel) return;

  // Collect all triangles in local space
  const tris: [Vec4, Vec4, Vec4][] = [];
  for (const group of Object.values(obj.groups)) {
    for (const mat of Object.values(group.materials)) {
      for (const tri of mat.triangles) {
        const a = mat.vertices[tri.v1.index];
        const b = mat.vertices[tri.v2.index];
        const c = mat.vertices[tri.v3.index];
        tris.push([
          [a.x, a.y, a.z, 1],
          [b.x, b.y, b.z, 1],
          [c.x, c.y, c.z, 1],
        ]);
      }
    }
  }

  const half = size / 2;
  const step = size / resolution;
  const cols = resolution + 1;

  // Helper: raycast down at a world XZ, return highest hit Y or null
  const sampleMeshHeight = (wx: number, wz: number): number | null => {
    const worldOrigin: Vec4 = [wx, 10000, wz, 1];
    const worldDown: Vec4 = [wx, 9999, wz, 1];
    const localOrigin = vecMat.matrixMultiplyVector(invModel, worldOrigin);
    const localDown = vecMat.matrixMultiplyVector(invModel, worldDown);
    const localDir: Vec4 = [
      localDown[0] - localOrigin[0],
      localDown[1] - localOrigin[1],
      localDown[2] - localOrigin[2],
      0,
    ];
    let bestY: number | null = null;
    for (const [v0, v1, v2] of tris) {
      const t = vecMat.rayIntersectsTriangle(localOrigin, localDir, v0, v1, v2);
      if (t !== null) {
        const localHit: Vec4 = [
          localOrigin[0] + localDir[0] * t,
          localOrigin[1] + localDir[1] * t,
          localOrigin[2] + localDir[2] * t,
          1,
        ];
        const worldHit = vecMat.matrixMultiplyVector(obj.modelMatrix, localHit);
        if (bestY === null || worldHit[1] > bestY) bestY = worldHit[1];
      }
    }
    return bestY;
  };

  const edgeHeights = new Float32Array(cols);
  let hits = 0;

  // Progressive nudge offsets — try closest to boundary first
  const nudges = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

  for (let i = 0; i <= resolution; i++) {
    let baseX: number, baseZ: number;
    if (edge === 'north')      { baseX = -half + i * step; baseZ = -half; }
    else if (edge === 'south') { baseX = -half + i * step; baseZ = half; }
    else if (edge === 'west')  { baseX = -half;            baseZ = -half + i * step; }
    else                       { baseX = half;             baseZ = -half + i * step; }

    let bestY: number | null = null;
    for (const nudge of nudges) {
      let wx = baseX, wz = baseZ;
      if (edge === 'north') wz -= nudge;
      else if (edge === 'south') wz += nudge;
      else if (edge === 'west') wx -= nudge;
      else wx += nudge;

      bestY = sampleMeshHeight(wx, wz);
      if (bestY !== null) break;
    }

    if (bestY !== null) {
      edgeHeights[i] = bestY / heightScale;
      hits++;
    } else {
      const idx = edge === 'north' ? i
        : edge === 'south' ? resolution * cols + i
        : edge === 'west' ? i * cols
        : i * cols + resolution;
      edgeHeights[i] = heightmap[idx];
    }
  }

  if (hits === 0) return;

  // Blend the heightmap rows/cols from the edge inward
  for (let i = 0; i <= resolution; i++) {
    for (let d = 0; d < blendWidth; d++) {
      const t = d / blendWidth;
      const blend = t * t * (3 - 2 * t); // smoothstep
      let r: number, c: number;

      if (edge === 'north') { r = d; c = i; }
      else if (edge === 'south') { r = resolution - d; c = i; }
      else if (edge === 'west') { r = i; c = d; }
      else { r = i; c = resolution - d; }

      const idx = r * cols + c;
      const original = heightmap[idx];
      heightmap[idx] = edgeHeights[i] * (1 - blend) + original * blend;
    }
  }
}

/**
 * Sample the terrain height at a world-space (x, z) position.
 * Returns the Y value at that point, interpolated bilinearly.
 */
export function sampleHeight(
  heightmap: Float32Array,
  resolution: number,
  size: number,
  heightScale: number,
  worldX: number,
  worldZ: number,
): number {
  const half = size / 2;
  // World to grid coordinates [0, resolution]
  const gx = ((worldX + half) / size) * resolution;
  const gz = ((worldZ + half) / size) * resolution;

  const c0 = Math.floor(gx);
  const r0 = Math.floor(gz);
  const c1 = Math.min(c0 + 1, resolution);
  const r1 = Math.min(r0 + 1, resolution);
  const fx = gx - c0;
  const fz = gz - r0;

  const cols = resolution + 1;
  const h00 = heightmap[r0 * cols + c0];
  const h10 = heightmap[r0 * cols + c1];
  const h01 = heightmap[r1 * cols + c0];
  const h11 = heightmap[r1 * cols + c1];

  const h = lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fz);
  return h * heightScale;
}

// --- Heightmap from image ---

export async function loadHeightmapFromImage(
  fileName: string,
  resolution: number
): Promise<Float32Array> {
  const base64 = await window.electron.readFileBase64(fileName);
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

  const img = new Image();
  img.src = `data:${mime};base64,${base64}`;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load heightmap image: ${fileName}`));
  });

  const canvas = document.createElement('canvas');
  const size = resolution + 1;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const pixels = imageData.data;

  const map = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    // Grayscale from red channel (or average RGB)
    map[i] = pixels[i * 4] / 255;
  }

  return map;
}

// --- Export heightmap to image ---

export async function exportHeightmapToImage(
  heightmap: Float32Array,
  resolution: number,
  fileName: string
): Promise<void> {
  const size = resolution + 1;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.createImageData(size, size);
  const pixels = imageData.data;

  for (let i = 0; i < size * size; i++) {
    const v = Math.round(heightmap[i] * 255);
    pixels[i * 4] = v;
    pixels[i * 4 + 1] = v;
    pixels[i * 4 + 2] = v;
    pixels[i * 4 + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  await window.electron.writeFileBase64(fileName, base64);
}

// --- Terrain mesh builder ---

export type TerrainOptions = {
  id: string;
  size: number;
  resolution: number;
  heightScale: number;
  heightmap?: Float32Array;
  noise?: HeightmapOptions;
  /** World-space origin of this chunk (bottom-left corner). Defaults to centered at origin. */
  originX?: number;
  originZ?: number;
};

function calculateDimensions(vertices: ObjVertex[]): ObjDimensions {
  let maxX = -Infinity, minX = Infinity;
  let maxY = -Infinity, minY = Infinity;
  let maxZ = -Infinity, minZ = Infinity;
  for (const { x, y, z } of vertices) {
    if (x > maxX) maxX = x; if (x < minX) minX = x;
    if (y > maxY) maxY = y; if (y < minY) minY = y;
    if (z > maxZ) maxZ = z; if (z < minZ) minZ = z;
  }
  return {
    maxX, minX, maxY, minY, maxZ, minZ,
    centerX: (maxX + minX) / 2,
    centerY: (maxY + minY) / 2,
    centerZ: (maxZ + minZ) / 2,
  };
}

export function createTerrain(options: TerrainOptions, vecMat: VecMat): Object3D {
  const { id, size, resolution, heightScale } = options;
  const heightmap = options.heightmap ?? generateHeightmap(resolution, options.noise);

  const ox = options.originX ?? -(size / 2);
  const oz = options.originZ ?? -(size / 2);
  const step = size / resolution;
  const cols = resolution + 1;

  // Build vertices
  const vertices: ObjVertex[] = [];
  for (let r = 0; r <= resolution; r++) {
    for (let c = 0; c <= resolution; c++) {
      const h = heightmap[r * cols + c];
      vertices.push({
        key: `${r}-${c}`,
        x: ox + c * step,
        y: h * heightScale,
        z: oz + r * step,
        nx: 0, ny: 1, nz: 0,
        u: c / resolution,
        v: r / resolution,
        triangles: [],
      });
    }
  }

  // Build triangles and indexes
  const triangles: ObjTriangle[] = [];
  const indexes: number[] = [];
  let triIdx = 0;

  for (let r = 0; r < resolution; r++) {
    for (let c = 0; c < resolution; c++) {
      const tl = r * cols + c;
      const tr = tl + 1;
      const bl = (r + 1) * cols + c;
      const br = bl + 1;

      // Triangle 1: tl, bl, br
      const t1: ObjTriangle = {
        id: `tri-${triIdx++}`, groupId: 'default', materialId: 'default',
        v1: { key: vertices[tl].key, index: tl },
        v2: { key: vertices[bl].key, index: bl },
        v3: { key: vertices[br].key, index: br },
        nx: 0, ny: 1, nz: 0,
      };
      triangles.push(t1);
      indexes.push(tl, bl, br);

      // Triangle 2: tl, br, tr
      const t2: ObjTriangle = {
        id: `tri-${triIdx++}`, groupId: 'default', materialId: 'default',
        v1: { key: vertices[tl].key, index: tl },
        v2: { key: vertices[br].key, index: br },
        v3: { key: vertices[tr].key, index: tr },
        nx: 0, ny: 1, nz: 0,
      };
      triangles.push(t2);
      indexes.push(tl, br, tr);
    }
  }

  // Compute face normals and link triangles to vertices
  for (const tri of triangles) {
    const v1 = vertices[tri.v1.index];
    const v2 = vertices[tri.v2.index];
    const v3 = vertices[tri.v3.index];

    const e1x = v2.x - v1.x, e1y = v2.y - v1.y, e1z = v2.z - v1.z;
    const e2x = v3.x - v1.x, e2y = v3.y - v1.y, e2z = v3.z - v1.z;

    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;

    tri.nx = nx / len;
    tri.ny = ny / len;
    tri.nz = nz / len;

    v1.triangles.push(tri);
    v2.triangles.push(tri);
    v3.triangles.push(tri);
  }

  // Smooth vertex normals (average of adjacent face normals)
  for (const v of vertices) {
    let nx = 0, ny = 0, nz = 0;
    for (const tri of v.triangles) {
      nx += tri.nx; ny += tri.ny; nz += tri.nz;
    }
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    v.nx = nx / len;
    v.ny = ny / len;
    v.nz = nz / len;
  }

  const dimensions = calculateDimensions(vertices);

  const obj: Obj = {
    id,
    name: id,
    color: [0.35, 0.55, 0.25, 1],
    tint: [0, 0, 0, 0],
    transparency: 1,
    texture: undefined,
    solid: false,
    ground: true,
    meshCollision: false,
    collisionMargin: 0.3,
    modelMatrix: vecMat.matrixCreateIdentity(),
    vertices,
    dimensions,
    groups: {
      default: {
        id: 'default',
        name: 'default',
        vertices,
        dimensions,
        materials: {
          default: {
            id: 'default',
            name: 'default',
            vertices,
            indexes,
            triangles,
            dimensions,
          }
        }
      }
    }
  };

  return new Object3D(id, obj, vecMat);
}

// --- Object gravity ---

type GravityEntry = {
  object: Object3D;
  velocityY: number;
  grounded: boolean;
};

export class ObjectGravity {
  private entries: GravityEntry[] = [];
  private gravity = -0.00003;
  private terminalVelocity = -0.05;

  constructor(
    private heightmap: Float32Array,
    private resolution: number,
    private size: number,
    private heightScale: number,
  ) {}

  add(object: Object3D) {
    this.entries.push({ object, velocityY: 0, grounded: false });
  }

  update(deltaTime: number) {
    for (const entry of this.entries) {
      if (entry.grounded) continue;

      entry.velocityY += this.gravity * deltaTime;
      if (entry.velocityY < this.terminalVelocity) {
        entry.velocityY = this.terminalVelocity;
      }
      const dy = entry.velocityY * deltaTime;

      const obj = entry.object.get();
      const pos = obj.modelMatrix;
      // Translation is at indices [12, 13, 14] in the model matrix
      const x = pos[12];
      const y = pos[13];
      const z = pos[14];

      const groundY = sampleHeight(
        this.heightmap, this.resolution, this.size, this.heightScale, x, z
      );

      // Object bottom = y - half height
      const halfHeight = (obj.dimensions.maxY - obj.dimensions.minY) / 2;
      const feetY = y - halfHeight + dy;

      if (feetY <= groundY) {
        entry.object.move([0, groundY + halfHeight - y, 0]);
        entry.velocityY = 0;
        entry.grounded = true;
      } else {
        entry.object.move([0, dy, 0]);
      }
    }
  }
}
