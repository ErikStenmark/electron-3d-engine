import VecMat from "./engine/vecmat";
import {
  AnyVec,
  NewObj,
  Obj,
  ObjDimensions,
  ObjGroup,
  ObjGroupMaterial,
  ObjTriangle,
  ObjVertex,
  Vec4,
} from "./engine/types";

type TransformOpts = {
  recalculateNormals?: boolean;
  noStore?: boolean;
};

export class Object3D {
  private obj: Obj;

  constructor(
    private id: string,
    private props: NewObj | Obj,
    private vecMat: VecMat
  ) {
    this.obj = this.buildObject3D();

    if (!this.isObj(props)) {
      this.center();
    }
  }

  public get(): Obj {
    return this.obj;
  }

  private isObj(obj: NewObj | Obj): obj is Obj {
    return (obj as Obj).vertices !== undefined;
  }

  private buildObject3D(): Obj {
    if (this.isObj(this.props)) {
      return this.props;
    }

    const { faces, images, positions, textures, normals, materials } =
      this.props;
    const obj = this.initObj();

    for (const group of faces) {
      const mats: { [key: string]: ObjGroupMaterial } = {};

      for (const material of group.materials) {
        const seenKeys: string[] = [];
        const vertices: ObjVertex[] = [];
        const indexes: number[] = [];
        const triangles: ObjTriangle[] = [];

        const materialData = materials?.find((m) => m.name === material.id);
        const mtlColor = materialData?.Kd;
        const mtlTransparency = materialData?.d || 1;
        const mtlTexture = materialData?.map_Kd;

        let triangleIndex = 0;
        for (const face of material.faces) {
          const [v1, v2, v3] = face;

          const triangle = this.newTriangle(
            `tri-${triangleIndex++}`,
            group.id,
            material.id
          );

          const addIndexToTriangle = (
            key: string,
            index: number,
            i: number
          ) => {
            if (i === 0) triangle.v1 = { key, index };
            if (i === 1) triangle.v2 = { key, index };
            if (i === 2) triangle.v3 = { key, index };
          };

          const seenVertices: number[] = [];

          for (let i = 0; i < 3; i++) {
            const [p, t, n] = [v1, v2, v3][i];

            let vertexKey = `${p}`;
            if (t || t === 0) vertexKey += `/${t}`;
            if (n || n === 0) vertexKey += `/${n}`;

            if (seenKeys.includes(vertexKey)) {
              const index = seenKeys.indexOf(vertexKey);

              indexes.push(index);
              addIndexToTriangle(vertexKey, index, i);

              seenVertices.push(index);
              continue;
            }

            seenKeys.push(vertexKey);

            const vec: ObjVertex = {
              key: vertexKey,
              x: positions[p].x,
              y: positions[p].y,
              z: positions[p].z,
              u: t ? textures[t].u : 0,
              v: t ? textures[t].v : 0,
              nx: n ? normals[n].nx : 0,
              ny: n ? normals[n].ny : 0,
              nz: n ? normals[n].nz : 0,
              triangles: [],
            };

            vertices.push(vec);
            indexes.push(vertices.length - 1);
            seenVertices.push(vertices.length - 1);
            addIndexToTriangle(vertexKey, vertices.length - 1, i);
          }

          const triWithNormal = this.getTriangleNormal(
            triangle,
            vertices[triangle.v1.index],
            vertices[triangle.v2.index],
            vertices[triangle.v3.index]
          );

          triangles.push(triWithNormal);

          seenVertices.forEach((vertexIndex) => {
            vertices[vertexIndex].triangles.push(triWithNormal);
          });
        }

        if (!normals.length) {
          for (const vertex of vertices) {
            this.addVertexNormal(vertex);
          }
        }

        mats[material.id] = {
          id: material.id,
          indexes,
          vertices,
          triangles,
          color: mtlColor
            ? [mtlColor[0], mtlColor[1], mtlColor[2], 1]
            : undefined,
          transparency: mtlTransparency,
          dimensions: this.calculateDimensions(vertices),
          texture: mtlTexture
            ? { id: material.id, img: images[mtlTexture] }
            : undefined,
        };
      }

      const groupVertices = Object.values(mats).flatMap((m) => m.vertices);

      obj.groups[group.id] = {
        id: group.id,
        materials: mats,
        vertices: groupVertices,
        dimensions: this.calculateDimensions(groupVertices),
      };
    }

    const objectVertices = Object.values(obj.groups).flatMap((g) => g.vertices);
    obj.vertices = objectVertices;
    obj.dimensions = this.calculateDimensions(objectVertices);

    return obj;
  }

  public move(movement: AnyVec, opts?: TransformOpts) {
    const updatedGroups: { [key: string]: ObjGroup } = {};

    for (const groupName in this.obj.groups) {
      const group = this.obj.groups[groupName];
      const updatedMaterials: { [key: string]: ObjGroupMaterial } = {};

      for (const materialName in group.materials) {
        const material = group.materials[materialName];

        material.vertices.forEach((vertex) => {
          vertex.x = vertex.x + movement[0];
          vertex.y = vertex.y + movement[1];
          vertex.z = vertex.z + movement[2];
        });

        updatedMaterials[materialName] = {
          id: material.id,
          indexes: material.indexes,
          vertices: material.vertices,
          triangles: material.triangles,
          texture: material.texture,
          color: material.color,
          tint: material.tint,
          transparency: material.transparency,
          dimensions: this.calculateDimensions(material.vertices),
        };
      }

      const updatedGroupVertices = Object.values(updatedMaterials).flatMap(
        (m) => m.vertices
      );
      updatedGroups[groupName] = {
        id: group.id,
        color: group.color,
        texture: group.texture,
        tint: group.tint,
        transparency: group.transparency,
        vertices: updatedGroupVertices,
        materials: updatedMaterials,
        dimensions: this.calculateDimensions(updatedGroupVertices),
      };
    }

    const updatedObjectVertices = Object.values(updatedGroups).flatMap(
      (g) => g.vertices
    );
    const newObj: Obj = {
      id: this.obj.id,
      color: this.obj.color,
      tint: this.obj.tint,
      transparency: this.obj.transparency,
      texture: this.obj.texture,
      groups: updatedGroups,
      dimensions: this.calculateDimensions(updatedObjectVertices),
      vertices: updatedObjectVertices,
    };

    if (opts?.noStore) {
      return new Object3D(this.id, newObj, this.vecMat);
    }

    this.obj = newObj;
    return this;
  }

  public scale(scale: number, opts?: TransformOpts) {
    return this.transform((vec) => this.vecMat.vectorMul(vec, scale), opts);
  }

  public center(opts?: TransformOpts) {
    // use obj dimensions to place the center of the object at [0, 0, 0]
    const { centerX, centerY, centerZ } = this.obj.dimensions;
    return this.move([-centerX, -centerY, -centerZ, 0], opts);
  }

  public transform(fn: (vec: Vec4) => Vec4, opts?: TransformOpts): Object3D {
    let updatedObj: Obj = opts?.noStore
      ? { ...this.obj, groups: {} } // empty group needed
      : this.obj;

    for (const groupName in this.obj.groups) {
      const newMaterials: ObjGroup["materials"] = {}; // new object needed

      for (const materialName in this.obj.groups[groupName].materials) {
        const material = this.obj.groups[groupName].materials[materialName];
        const vertices: ObjVertex[] = material.vertices.map((vertex) => {
          // Translate the vertex to the center

          let x = vertex.x - this.obj.dimensions.centerX,
            y = vertex.y - this.obj.dimensions.centerY,
            z = vertex.z - this.obj.dimensions.centerZ;

          const [mx, my, mz] = fn([x, y, z, 1]);

          // Translate the vertex back to the original position
          x = mx + this.obj.dimensions.centerX;
          y = my + this.obj.dimensions.centerY;
          z = mz + this.obj.dimensions.centerZ;

          const [nx, ny, nz] = fn([vertex.nx, vertex.ny, vertex.nz, 0]);

          let { triangles, u, v, key } = vertex;

          if (opts?.recalculateNormals) {
            triangles = [];
          }

          return { key, nx, ny, nz, triangles, x, y, z, u, v };
        });

        if (opts?.noStore) {
          newMaterials[materialName] = {
            id: material.id,
            indexes: material.indexes,
            vertices: vertices,
            triangles: material.triangles,
            texture: material.texture,
            dimensions: this.calculateDimensions(vertices),
            color: material.color,
            tint: material.tint,
          };
        } else {
          newMaterials[materialName] = material;
          newMaterials[materialName].vertices = vertices;
          newMaterials[materialName].dimensions =
            this.calculateDimensions(vertices);
        }
      }

      if (opts?.noStore) {
        updatedObj.groups[groupName] = {
          id: this.obj.groups[groupName].id,
          color: this.obj.groups[groupName].color,
          texture: this.obj.groups[groupName].texture,
          tint: this.obj.groups[groupName].tint,
          transparency: this.obj.groups[groupName].transparency,
          materials: newMaterials,
          vertices: Object.values(newMaterials).flatMap((m) => m.vertices),
          dimensions: this.calculateDimensions(
            Object.values(newMaterials).flatMap((m) => m.vertices)
          ),
        };
      } else {
        updatedObj.groups[groupName] = this.obj.groups[groupName];
        updatedObj.groups[groupName].materials = newMaterials;
        updatedObj.groups[groupName].vertices = Object.values(
          newMaterials
        ).flatMap((m) => m.vertices);
        updatedObj.groups[groupName].dimensions = this.calculateDimensions(
          Object.values(newMaterials).flatMap((m) => m.vertices)
        );
      }
    }

    updatedObj.vertices = Object.values(this.obj.groups).flatMap(
      (g) => g.vertices
    );
    updatedObj.dimensions = this.calculateDimensions(this.obj.vertices);

    if (opts?.recalculateNormals) {
      updatedObj = this.recalculateTriangleNormals(updatedObj);
    }

    if (opts?.noStore) {
      return new Object3D(this.id, updatedObj, this.vecMat);
    }

    this.obj = updatedObj;
    return this;
  }

  private calculateDimensions(vertices: ObjVertex[]): ObjDimensions {
    let i = vertices.length;

    let maxX = -Infinity;
    let minX = Infinity;
    let maxY = -Infinity;
    let minY = Infinity;
    let maxZ = -Infinity;
    let minZ = Infinity;

    while (i--) {
      const { x, y, z } = vertices[i];
      maxX = Math.max(maxX, x);
      minX = Math.min(minX, x);
      maxY = Math.max(maxY, y);
      minY = Math.min(minY, y);
      maxZ = Math.max(maxZ, z);
      minZ = Math.min(minZ, z);
    }

    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;
    const centerZ = (maxZ + minZ) / 2;

    return {
      maxX,
      minX,
      maxY,
      minY,
      maxZ,
      minZ,
      centerX,
      centerY,
      centerZ,
    };
  }

  private recalculateTriangleNormals(obj: Obj): Obj {
    for (const group of Object.values(obj.groups)) {
      for (const material of Object.values(group.materials)) {
        // Recalculate triangle normals and update vertex triangle lists
        for (const triangle of material.triangles) {
          const v1 = material.vertices[triangle.v1.index];
          const v2 = material.vertices[triangle.v2.index];
          const v3 = material.vertices[triangle.v3.index];

          // Recalculate the triangle normal based on the updated vertex normals
          const updatedTriangle = this.getTriangleNormal(triangle, v1, v2, v3);

          // Update the triangle with the recalculated normal
          triangle.nx = updatedTriangle.nx;
          triangle.ny = updatedTriangle.ny;
          triangle.nz = updatedTriangle.nz;

          // Update the list of triangles using each vertex
          v1.triangles.push(triangle);
          v2.triangles.push(triangle);
          v3.triangles.push(triangle);
        }

        for (const vertex of material.vertices) {
          this.addVertexNormal(vertex);
        }
      }
    }
    return obj;
  }

  private addVertexNormal(v: ObjVertex): void {
    let nx = 0;
    let ny = 0;
    let nz = 0;

    let i = v.triangles.length;
    while (i--) {
      const tri = v.triangles[i];
      nx += tri.nx;
      ny += tri.ny;
      nz += tri.nz;
    }

    const l = 1 / v.triangles.length;
    v.nx = nx * l;
    v.ny = ny * l;
    v.nz = nz * l;
  }

  private getTriangleNormal(
    triangle: ObjTriangle,
    ov1: ObjVertex,
    ov2: ObjVertex,
    ov3: ObjVertex
  ): ObjTriangle {
    const e1 = this.vecMat.vectorSub(
      this.vecMat.objVectorToVector(ov2),
      this.vecMat.objVectorToVector(ov1)
    );
    const e2 = this.vecMat.vectorSub(
      this.vecMat.objVectorToVector(ov3),
      this.vecMat.objVectorToVector(ov1)
    );
    const crossProduct = this.vecMat.vectorCrossProduct(e1, e2);
    const [nx, ny, nz] = this.vecMat.vectorNormalize(crossProduct);

    const { id, v1, v2, v3, materialId, groupId } = triangle;
    return { id, v1, v2, v3, nx, ny, nz, materialId, groupId };
  }

  private newTriangle(
    id: string,
    groupId?: string,
    materialId?: string
  ): ObjTriangle {
    return {
      id,
      groupId: groupId || "",
      materialId: materialId || "",
      v1: { index: 0, key: "" },
      v2: { index: 0, key: "" },
      v3: { index: 0, key: "" },
      nx: 0,
      ny: 0,
      nz: 0,
    };
  }

  private initObj(): Obj {
    return {
      id: this.id,
      groups: {},
      color: [0.6, 0.6, 0.6, 1],
      tint: [0, 0, 0, 0],
      transparency: 1,
      texture: undefined,
      dimensions: {} as any,
      vertices: [],
    };
  }
}
