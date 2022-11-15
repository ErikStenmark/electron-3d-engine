export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];

export type AnyVec = Vec3 | Vec4;

export type Triangle<T = Vec3 | Vec4> = [T, T, T, T];
export type MeshTriangle = [Vec4, Vec4, Vec4];

export type Mesh<T extends Triangle | MeshTriangle = MeshTriangle> = Array<T>;