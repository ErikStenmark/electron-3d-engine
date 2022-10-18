export type Vec3d = [number, number, number, number] | [number, number, number];

export type Triangle = [Vec3d, Vec3d, Vec3d, string?];

export type Mesh = Triangle[];