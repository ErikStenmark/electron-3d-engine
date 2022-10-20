export type Vec3d = [number, number, number, number] | [number, number, number];

export type Triangle = [Vec3d, Vec3d, Vec3d, Vec3d];

export type MeshTriangle = [Vec3d, Vec3d, Vec3d];

export type Mesh<T extends Triangle | MeshTriangle = MeshTriangle> = Array<T>;