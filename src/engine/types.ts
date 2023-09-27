export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export type AnyVec = Vec3 | Vec4;

export type Triangle<T = Vec3 | Vec4> = [T, T, T, T];
export type MeshTriangle = [Vec4, Vec4, Vec4];

export type Mesh<T extends Triangle | MeshTriangle = MeshTriangle> = Array<T>;

export type ObjTri = [ObjVertex, ObjVertex, ObjVertex];

export type Position = {
  x: number;
  y: number;
  z: number;
};

export type Normal = {
  nx: number;
  ny: number;
  nz: number;
}

export type Texture = {
  u: number;
  v: number;
}

export type ObjVertex = Position & Normal & Texture & {
  key: string;
  /** Every triangle that uses the vertex */
  triangles: ObjTriangle[];
};

export type ObjTriangle = Normal & {
  id: string;
  v1: number;
  v2: number;
  v3: number;
}

export type ObjDimensions = {
  maxX: number;
  maxY: number;
  maxZ: number;
  minX: number;
  minY: number;
  minZ: number;
  centerX: number;
  centerY: number;
  centerZ: number;
}

export type Obj = {
  indexes: number[];
  vertices: ObjVertex[];
  triangles: ObjTriangle[];
  texture?: HTMLImageElement;
  dimensions: ObjDimensions;
  color: Vec4;
  tint: Vec4;
}