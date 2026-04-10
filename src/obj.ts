import VecMat, { Mat4x4 } from "./engine/vecmat";
import {
  AnyVec,
  NewObj,
  Obj,
  ObjDimensions,
  ObjGroup,
  ObjGroupMaterial,
  ObjTriangle,
  ObjVertex,
  TextureSample,
} from "./engine/types";

export class Object3D {
  public static createPlane(id: string, size: number, vecMat: VecMat, thickness = 0.2): Object3D {
    const half = size / 2;
    const halfT = thickness / 2;
    const vertices: ObjVertex[] = [
      { key: '0', x: -half, y: 0, z: -half, nx: 0, ny: 1, nz: 0, u: 0, v: 0, triangles: [] },
      { key: '1', x: half, y: 0, z: -half, nx: 0, ny: 1, nz: 0, u: 1, v: 0, triangles: [] },
      { key: '2', x: half, y: 0, z: half, nx: 0, ny: 1, nz: 0, u: 1, v: 1, triangles: [] },
      { key: '3', x: -half, y: 0, z: half, nx: 0, ny: 1, nz: 0, u: 0, v: 1, triangles: [] },
    ];

    const triangles: ObjTriangle[] = [
      { id: 'tri-0', groupId: 'default', materialId: 'default', v1: { key: '0', index: 0 }, v2: { key: '1', index: 1 }, v3: { key: '2', index: 2 }, nx: 0, ny: 1, nz: 0 },
      { id: 'tri-1', groupId: 'default', materialId: 'default', v1: { key: '0', index: 0 }, v2: { key: '2', index: 2 }, v3: { key: '3', index: 3 }, nx: 0, ny: 1, nz: 0 },
    ];

    vertices[0].triangles = [triangles[0], triangles[1]];
    vertices[1].triangles = [triangles[0]];
    vertices[2].triangles = [triangles[0], triangles[1]];
    vertices[3].triangles = [triangles[1]];

    const obj: Obj = {
      id,
      name: id,
      color: [0.4, 0.6, 0.3, 1],
      tint: [0, 0, 0, 0],
      transparency: 1,
      texture: undefined,
      solid: false,
      ground: false,
      meshCollision: false,
      collisionMargin: 0.3,
      modelMatrix: vecMat.matrixCreateIdentity(),
      vertices,
      dimensions: { minX: -half, maxX: half, minY: -halfT, maxY: halfT, minZ: -half, maxZ: half, centerX: 0, centerY: 0, centerZ: 0 },
      groups: {
        default: {
          id: 'default',
          name: 'default',
          vertices,
          dimensions: { minX: -half, maxX: half, minY: -halfT, maxY: halfT, minZ: -half, maxZ: half, centerX: 0, centerY: 0, centerZ: 0 },
          materials: {
            default: {
              id: 'default',
              name: 'default',
              vertices,
              indexes: [0, 1, 2, 0, 2, 3],
              triangles,
              dimensions: { minX: -half, maxX: half, minY: -halfT, maxY: halfT, minZ: -half, maxZ: half, centerX: 0, centerY: 0, centerZ: 0 },
            }
          }
        }
      }
    };

    return new Object3D(id, obj, vecMat);
  }

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

  public setName(name: string): this {
    this.obj.name = name;
    return this;
  }

  public setSolid(solid: boolean): this {
    this.obj.solid = solid;
    return this;
  }

  public setMeshCollision(meshCollision: boolean): this {
    this.obj.meshCollision = meshCollision;
    return this;
  }

  public setGround(ground: boolean): this {
    this.obj.ground = ground;
    return this;
  }

  public setCollisionMargin(margin: number): this {
    this.obj.collisionMargin = margin;
    return this;
  }

  public getGroups(): { id: string; name: string; materials: { id: string; name: string }[] }[] {
    return Object.values(this.obj.groups).map((g) => ({
      id: g.id,
      name: g.name,
      materials: Object.values(g.materials).map((m) => ({ id: m.id, name: m.name })),
    }));
  }

  public setGroupName(groupId: string, name: string): this {
    const group = this.obj.groups[groupId];
    if (group) group.name = name;
    return this;
  }

  public setMaterialName(groupId: string, materialId: string, name: string): this {
    const material = this.obj.groups[groupId]?.materials[materialId];
    if (material) material.name = name;
    return this;
  }

  public getModelMatrix(): Mat4x4 {
    return this.obj.modelMatrix;
  }

  public setModelMatrix(mat: Mat4x4): this {
    this.obj.modelMatrix = mat;
    return this;
  }

  public applyMatrix(mat: Mat4x4): this {
    this.obj.modelMatrix = this.vecMat.matrixMultiplyMatrix(mat, this.obj.modelMatrix);
    return this;
  }

  public clone(id: string): Object3D {
    // First, create a clone without HTMLImageElement that would cause problems
    // Store references to all textures before they're lost
    const textureRefs = this.extractTextureReferences(this.obj);

    // Create deep clone without textures
    const objWithoutTextures = { ...this.obj };
    this.removeTextureReferences(objWithoutTextures);

    // Use structuredClone for everything except textures
    const clonedObj = structuredClone(objWithoutTextures);

    // Restore all texture references before updating the id, as the
    // texture map was keyed on the original id
    this.restoreTextureReferences(clonedObj, textureRefs);
    clonedObj.id = id;
    clonedObj.sourceId = this.obj.sourceId ?? this.obj.id;

    return new Object3D(id, clonedObj, this.vecMat);
  }

  private extractTextureReferences(obj: Obj): Map<string, TextureSample> {
    const textureMap = new Map<string, TextureSample>();

    // Store object texture
    if (obj.texture) {
      const path = `obj:${obj.id}`;
      textureMap.set(path, obj.texture);
    }

    // Store group textures
    for (const groupId in obj.groups) {
      const group = obj.groups[groupId];
      if (group.texture) {
        const path = `group:${groupId}`;
        textureMap.set(path, group.texture);
      }

      // Store material textures
      for (const materialId in group.materials) {
        const material = group.materials[materialId];
        if (material.texture) {
          const path = `material:${groupId}:${materialId}`;
          textureMap.set(path, material.texture);
        }
      }
    }

    return textureMap;
  }

  private removeTextureReferences(obj: Obj): void {
    // Remove object texture
    obj.texture = undefined;

    // Remove group textures
    for (const groupId in obj.groups) {
      const group = obj.groups[groupId];
      group.texture = undefined;

      // Remove material textures
      for (const materialId in group.materials) {
        const material = group.materials[materialId];
        material.texture = undefined;
      }
    }
  }

  private restoreTextureReferences(
    obj: Obj,
    textureMap: Map<string, TextureSample>
  ): void {
    // Restore object texture
    const objTexture = textureMap.get(`obj:${obj.id}`);
    if (objTexture) {
      obj.texture = objTexture;
    }

    // Restore group textures
    for (const groupId in obj.groups) {
      const group = obj.groups[groupId];
      const groupTexture = textureMap.get(`group:${groupId}`);
      if (groupTexture) {
        group.texture = groupTexture;
      }

      // Restore material textures
      for (const materialId in group.materials) {
        const material = group.materials[materialId];
        const materialTexture = textureMap.get(
          `material:${groupId}:${materialId}`
        );
        if (materialTexture) {
          material.texture = materialTexture;
        }
      }
    }
  }

  private isObj(obj: NewObj | Obj): obj is Obj {
    return (obj as Obj).vertices !== undefined;
  }

  private buildObject3D(): Obj {
    if (this.isObj(this.props)) {
      if (!this.props.modelMatrix) {
        this.props.modelMatrix = this.vecMat.matrixCreateIdentity();
      }
      if (!this.props.name) {
        this.props.name = this.props.id;
      }
      if (this.props.solid === undefined) {
        this.props.solid = false;
      }
      if (this.props.ground === undefined) {
        this.props.ground = false;
      }
      if (this.props.meshCollision === undefined) {
        this.props.meshCollision = false;
      }
      if (this.props.collisionMargin === undefined) {
        this.props.collisionMargin = 0.3;
      }
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
            vertices[triangle.v3.index],
            normals.length > 0,
          );

          triangles.push(triWithNormal);

          if (!normals.length) {
            seenVertices.forEach((vertexIndex) => {
              vertices[vertexIndex].triangles.push(triWithNormal);
            });
          }
        }

        if (!normals.length) {
          for (const vertex of vertices) {
            this.addVertexNormal(vertex);
          }
        }

        mats[material.id] = {
          id: material.id,
          name: material.id,
          indexes,
          vertices,
          triangles,
          color: mtlColor
            ? [mtlColor[0], mtlColor[1], mtlColor[2], 1]
            : undefined,
          transparency: mtlTransparency,
          dimensions: this.calculateDimensions(vertices),
          texture: mtlTexture && images[mtlTexture]
            ? { id: material.id, img: images[mtlTexture] }
            : undefined,
        };
      }

      const groupVertices = Object.values(mats).flatMap((m) => m.vertices);

      obj.groups[group.id] = {
        id: group.id,
        name: group.id,
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

  public move(movement: AnyVec): this {
    const translation = this.vecMat.matrixTranslation(movement[0], movement[1], movement[2]);
    this.obj.modelMatrix = this.vecMat.matrixMultiplyMatrix(this.obj.modelMatrix, translation);
    return this;
  }

  public scale(s: number): this {
    const scaleMat = this.vecMat.matrixScale(s);
    this.obj.modelMatrix = this.vecMat.matrixMultiplyMatrix(this.obj.modelMatrix, scaleMat);
    return this;
  }

  public center(): this {
    const { centerX, centerY, centerZ } = this.obj.dimensions;
    this.moveVertices([-centerX, -centerY, -centerZ]);
    return this;
  }

  private moveVertices(movement: AnyVec): void {
    for (const group of Object.values(this.obj.groups)) {
      for (const material of Object.values(group.materials)) {
        for (const vertex of material.vertices) {
          vertex.x += movement[0];
          vertex.y += movement[1];
          vertex.z += movement[2];
        }
        material.dimensions = this.calculateDimensions(material.vertices);
      }
      group.dimensions = this.calculateDimensions(group.vertices);
    }
    this.obj.dimensions = this.calculateDimensions(this.obj.vertices);
  }


  public setTexture(
    texture: TextureSample,
    groupId?: string,
    materialId?: string
  ): void {
    // Apply the texture based on specificity (material, group, or entire object)
    if (groupId && materialId) {
      // Find the specific group and material
      const group = this.obj.groups[groupId];
      if (group) {
        const material = group.materials[materialId];
        if (material) {
          // Apply texture to specific material in a group
          material.texture = texture;
        }
      }
      return;
    }

    if (groupId) {
      // Find the specific group
      const group = this.obj.groups[groupId];
      if (group) {
        // Apply texture to the group
        group.texture = texture;
      }
      return;
    }

    // Apply texture to the entire object
    this.obj.texture = texture;
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

    for (const tri of v.triangles) {
      const wn = tri.weightedNormals;
      if (!wn) {
        nx += tri.nx;
        ny += tri.ny;
        nz += tri.nz;
        continue;
      }
      if (v.key === tri.v1.key) {
        nx += wn.v1.nx; ny += wn.v1.ny; nz += wn.v1.nz;
      } else if (v.key === tri.v2.key) {
        nx += wn.v2.nx; ny += wn.v2.ny; nz += wn.v2.nz;
      } else {
        nx += wn.v3.nx; ny += wn.v3.ny; nz += wn.v3.nz;
      }
    }

    const len = this.vecMat.vectorLength([nx, ny, nz]);
    if (len > 0) {
      const inv = 1 / len;
      v.nx = nx * inv;
      v.ny = ny * inv;
      v.nz = nz * inv;
    }
  }

  private getTriangleNormal(
    triangle: ObjTriangle,
    ov1: ObjVertex,
    ov2: ObjVertex,
    ov3: ObjVertex,
    normalsProvided = false,
  ): ObjTriangle {
    const vv1 = this.vecMat.objVectorToVector(ov1);
    const vv2 = this.vecMat.objVectorToVector(ov2);
    const vv3 = this.vecMat.objVectorToVector(ov3);

    const e1 = this.vecMat.vectorSub(vv2, vv1);
    const e2 = this.vecMat.vectorSub(vv3, vv1);
    const e3 = this.vecMat.vectorSub(vv3, vv2);

    const crossProduct = this.vecMat.vectorCrossProduct(e1, e2);
    const [nx, ny, nz] = this.vecMat.vectorNormalize(crossProduct);

    // Angle-weighted normals: weight = angle at each vertex
    const dotNorm = (a: AnyVec, b: AnyVec) => {
      const la = this.vecMat.vectorLength(a);
      const lb = this.vecMat.vectorLength(b);
      if (la === 0 || lb === 0) return 0;
      return this.vecMat.vectorDotProd(a, b) / (la * lb);
    };
    const ne1: AnyVec = [-e1[0], -e1[1], -e1[2]];
    const ne2: AnyVec = [-e2[0], -e2[1], -e2[2]];
    const ne3: AnyVec = [-e3[0], -e3[1], -e3[2]];

    // Weight at v1: angle between e1 and e2 (edges from v1)
    const w1 = Math.acos(Math.max(-1, Math.min(1, dotNorm(e1, e2))));
    // Weight at v2: angle between -e1 and e3 (edges from v2)
    const w2 = Math.acos(Math.max(-1, Math.min(1, dotNorm(ne1, e3))));
    // Weight at v3: angle between -e2 and -e3 (edges from v3)
    const w3 = Math.acos(Math.max(-1, Math.min(1, dotNorm(ne2, ne3))));

    const { id, v1, v2, v3, materialId, groupId } = triangle;

    if (normalsProvided) {
      return { id, v1, v2, v3, nx, ny, nz, materialId, groupId };
    }

    return {
      id, v1, v2, v3, nx, ny, nz, materialId, groupId,
      weightedNormals: {
        v1: { nx: nx * w1, ny: ny * w1, nz: nz * w1 },
        v2: { nx: nx * w2, ny: ny * w2, nz: nz * w2 },
        v3: { nx: nx * w3, ny: ny * w3, nz: nz * w3 },
      },
    };
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
      name: this.id,
      groups: {},
      color: [0.6, 0.6, 0.6, 1],
      tint: [0, 0, 0, 0],
      transparency: 1,
      texture: undefined,
      dimensions: {} as any,
      vertices: [],
      modelMatrix: this.vecMat.matrixCreateIdentity(),
      solid: false,
      ground: false,
      meshCollision: false,
      collisionMargin: 0.3,
    };
  }
}
