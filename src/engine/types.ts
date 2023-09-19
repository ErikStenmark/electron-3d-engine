export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export type AnyVec = Vec3 | Vec4;

export type Triangle<T = Vec3 | Vec4> = [T, T, T, T];
export type MeshTriangle = [Vec4, Vec4, Vec4];

export type Mesh<T extends Triangle | MeshTriangle = MeshTriangle> = Array<T>;

export type ObjTri = [ObjVertex, ObjVertex, ObjVertex];

export type ObjVertex = {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  /** Every triangle that uses the vertex */
  triangles: ObjTriangle[];
};

export type ObjTriangle = {
  id: string;
  v1: number;
  v2: number;
  v3: number;
  nx: number;
  ny: number;
  nz: number;
}

export type Obj = {
  indexes: number[];
  vertices: ObjVertex[];
  triangles: ObjTriangle[];
}