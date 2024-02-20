import VecMat from "./engine/vecmat";
import { cloneArray } from "./utils";

import {
  AnyVec,
  ObjTriangle,
  ObjVertex,
  Obj,
  Vec4,
  Position,
  Normal,
  Texture,
  ObjDimensions,
  Vec3,
  ObjGroupMaterial,
  ObjGroup,
  TextureSample,
  EdgeVectors,
} from "./engine/types";

export type ObjLine = ObjLineData | ObjLineFace;

type FaceEntry = [number, number?, number?];
type ObjLineData = [string, number, number, number] | [string, number, number];
type ObjLineFace = [FaceEntry, FaceEntry, FaceEntry, FaceType | undefined];

type Material = {
  name: string;
  // Specular exponent
  Ns?: number;
  // Ambient color
  Ka?: Vec3;
  // Diffuse color
  Kd?: Vec3;
  // Specular color
  Ks?: Vec3;
  // Emissive color
  Ke?: Vec3;
  // Optical density
  Ni?: number;
  // Dissolve (transparency)
  d?: number;
  // Illumination model
  illum?: number;
  // Diffuse texture
  map_Kd?: string;
};

type SetTextureOpts = {
  obj: string | Obj;
  textureKey: string;
  textureFile: string;
  groupId?: string;
  materialId?: string;
};

type TransformOpts = { recalculateNormals?: boolean };

type StoreObj = Obj & {
  move: (location: AnyVec) => StoreObj;
  scale: (scale: number, opts?: TransformOpts) => StoreObj;
  center: () => StoreObj;
  transform: (fn: (vec: Vec4) => Vec4, opts?: TransformOpts) => StoreObj;
  store: () => StoreObj;
};

export interface IObjectStore {
  loadTexture(name: string, key: string): Promise<TextureSample | undefined>;
  setTexture(opts: SetTextureOpts): Promise<void>;
  load(name: string, key: string): Promise<StoreObj>;
  get(key: string): StoreObj;
  set(key: string, obj: Obj): void;
  move(object: Obj, location: AnyVec): Obj;
  transform(obj: Obj, fn: (vec: Vec4) => Vec4, opts?: TransformOpts): Obj;
  scale(obj: Obj, scale: number, opts?: TransformOpts): Obj;
  center(obj: Obj): Obj;
}

/**
 * v = vertex
 * t = texture
 * n = normal
 */
type FaceType = "v" | "vt" | "vn" | "vtn";

type FaceMaterial<T = string | ObjLineFace> = {
  id: string;
  faces: T[];
};

type FaceGroup<T = string | ObjLineFace> = {
  id: string;
  materials: FaceMaterial<T>[];
};

export class ObjectStore implements IObjectStore {
  private objStore: { [key: string]: Obj } = {};
  private textureStore: { [key: string]: HTMLImageElement } = {};

  private vecMat = new VecMat();

  public async loadTexture(
    fileName?: string,
    key?: string
  ): Promise<TextureSample | undefined> {
    if (!fileName) {
      return undefined;
    }

    const id = key || fileName;

    if (this.textureStore[id]) {
      return { id: id, img: this.textureStore[id] };
    }

    const base64 = await window.electron.readFileBase64(fileName);

    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;

    this.textureStore[id] = img;

    return { id: id, img };
  }

  public async setTexture(opts: SetTextureOpts): Promise<void> {
    const { obj, textureFile, textureKey, groupId, materialId } = opts;
    const base64 = await window.electron.readFileBase64(textureFile);

    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;

    this.textureStore[textureKey] = img;

    const textureSample: TextureSample = { id: textureKey, img };
    const object = typeof obj === "string" ? this.objStore[obj] : obj;

    if (groupId && materialId) {
      object.groups[groupId].materials[materialId].texture = textureSample;
      return;
    }

    if (groupId) {
      object.groups[groupId].texture = textureSample;
      return;
    }

    object.texture = textureSample;

    this.objStore[object.id] = object;
  }

  /**
   * @TODO load could create an array of ALL the vertices with proper id:s that could be referenced
   * by the groups and materials instead of them having their own arrays. This might make
   * dimension calculations faster, and make transforming placing the object easier. Not sure
   * if an obj wide vertex can store all the triangles that uses it. or if the triangles needs to
   * be group->material specific.
   */
  public async load(name: string, key: string): Promise<StoreObj> {
    const lines = await this.loadFile(name);
    const mtlData = await this.checkForMtlFile(lines);
    const { lineData, faceData } = this.separateFacesAndData(lines);
    const { positions, normals, textures } = this.separateData(lineData);

    const obj = this.initObj(key);

    for (const group of faceData) {
      const materials: { [key: string]: ObjGroupMaterial } = {};

      for (const material of group.materials) {
        const seenKeys: string[] = [];
        const vertices: ObjVertex[] = [];
        const indexes: number[] = [];
        const triangles: ObjTriangle[] = [];

        const materialData = mtlData?.find((m) => m.name === material.id);
        const mtlColor = materialData?.Kd;
        const mtlTransparency = materialData?.d || 1;
        const mtlTexture = materialData?.map_Kd;

        for (const face of material.faces) {
          const [v1, v2, v3] = face;

          const triangle = this.newTriangle(
            `${key}-${triangles.length}`,
            group.id,
            material.id
          );

          const addIndexToTriangle = (vertexIndex: number, i: number) => {
            if (i === 0) triangle.v1 = vertexIndex;
            if (i === 1) triangle.v2 = vertexIndex;
            if (i === 2) triangle.v3 = vertexIndex;
          };

          const seenVertices: number[] = [];

          // Loop through the vertices of a face (v1, v2, v3)
          // and create a unique key for each vertex based on its position, texture, and normal.
          // If a vertex with the same key has already been seen, reuse its index.
          // Otherwise, create a new vertex and add it to the vertices array.
          // Update the indexes and triangles arrays accordingly.
          for (let i = 0; i < 3; i++) {
            const [p, t, n] = [v1, v2, v3][i];

            let vertexKey = `${p}`;
            if (t || t === 0) vertexKey += `/${t}`;
            if (n || n === 0) vertexKey += `/${n}`;

            if (seenKeys.includes(vertexKey)) {
              const index = seenKeys.indexOf(vertexKey);

              indexes.push(index);
              addIndexToTriangle(index, i);

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
              normalMinMax: {
                min: { nx: 0, ny: 0, nz: 0 },
                mid: { nx: 0, ny: 0, nz: 0 },
                max: { nx: 0, ny: 0, nz: 0 },
              },
            };

            vertices.push(vec);
            indexes.push(vertices.length - 1);
            seenVertices.push(vertices.length - 1);
            addIndexToTriangle(vertices.length - 1, i);
          }

          const triWithNormal = this.getTriangleNormal(
            triangle,
            vertices[triangle.v1],
            vertices[triangle.v2],
            vertices[triangle.v3]
          );

          triangles.push(triWithNormal);

          seenVertices.forEach((vertexIndex) => {
            vertices[vertexIndex].triangles.push(triWithNormal);
          });
        }

        if (!normals.length) {
          for (const vertex of vertices) {
            this.addVertexNormalFunction(vertex);
          }
        }

        materials[material.id] = {
          id: material.id,
          indexes,
          vertices,
          triangles,
          color: mtlColor
            ? [mtlColor[0], mtlColor[1], mtlColor[2], 1]
            : undefined,
          transparency: mtlTransparency,
          dimensions: this.calculateDimensions(vertices),
          texture: await this.loadTexture(mtlTexture),
        };
      }

      const groupVertices = Object.values(materials).flatMap((m) => m.vertices);

      obj.groups[group.id] = {
        id: group.id,
        materials,
        vertices: groupVertices,
        dimensions: this.calculateDimensions(groupVertices),
      };
    }

    const objectVertices = Object.values(obj.groups).flatMap((g) => g.vertices);
    obj.vertices = objectVertices;
    obj.dimensions = this.calculateDimensions(objectVertices);

    this.objStore[key] = this.center(obj);
    return this.objToStoreObj(this.objStore[key]);
  }

  public get(key: string, opts: { clone?: boolean } = {}): StoreObj {
    const obj = this.objStore[key];

    const groups: { [key: string]: ObjGroup } = {};
    for (const groupName in obj.groups) {
      if (obj.groups.hasOwnProperty(groupName)) {
        const group = obj.groups[groupName];
        const materials: { [key: string]: ObjGroupMaterial } = {};

        for (const materialName in group.materials) {
          if (group.materials.hasOwnProperty(materialName)) {
            const material = group.materials[materialName];
            materials[materialName] = {
              id: material.id,
              indexes: material.indexes,
              triangles: material.triangles,
              vertices: opts.clone
                ? cloneArray(material.vertices)
                : material.vertices,
              texture: material.texture,
              dimensions: material.dimensions,
              color: material.color,
              tint: material.tint,
              transparency: material.transparency,
            };
          }
        }

        groups[groupName] = {
          id: group.id,
          materials: materials,
          color: group.color,
          tint: group.tint,
          texture: group.texture,
          transparency: group.transparency,
          dimensions: group.dimensions,
          vertices: group.vertices,
        };
      }
    }

    return this.objToStoreObj({
      id: obj.id,
      groups: groups,
      color: obj.color,
      tint: obj.tint,
      texture: obj.texture,
      transparency: obj.transparency,
      dimensions: obj.dimensions,
      vertices: obj.vertices,
    });
  }

  public set(key: string, obj: Obj) {
    delete this.objStore.key;
    this.objStore[key] = obj;
  }

  public move(object: Obj, movement: AnyVec): Obj {
    const updatedGroups: { [key: string]: ObjGroup } = {};

    for (const groupName in object.groups) {
      if (object.groups.hasOwnProperty(groupName)) {
        const group = object.groups[groupName];
        const updatedMaterials: { [key: string]: ObjGroupMaterial } = {};

        for (const materialName in group.materials) {
          if (group.materials.hasOwnProperty(materialName)) {
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
              dimensions: this.calculateDimensions(material.vertices),
              color: material.color,
              tint: material.tint,
              transparency: material.transparency,
            };
          }
        }

        const updatedGroupVertices = Object.values(updatedMaterials).flatMap(
          (m) => m.vertices
        );

        updatedGroups[groupName] = {
          id: group.id,
          materials: updatedMaterials,
          color: group.color,
          tint: group.tint,
          texture: group.texture,
          transparency: group.transparency,
          dimensions: this.calculateDimensions(updatedGroupVertices),
          vertices: updatedGroupVertices,
        };
      }
    }

    const updatedObjectVertices = Object.values(updatedGroups).flatMap(
      (g) => g.vertices
    );

    return {
      id: object.id,
      groups: updatedGroups,
      color: object.color,
      tint: object.tint,
      texture: object.texture,
      transparency: object.transparency,
      dimensions: this.calculateDimensions(updatedObjectVertices),
      vertices: updatedObjectVertices,
    };
  }

  public transform(
    obj: Obj,
    fn: (vec: Vec4) => Vec4,
    opts?: { recalculateNormals?: boolean }
  ): Obj {
    const updatedObj = obj;

    for (const groupName in updatedObj.groups) {
      if (updatedObj.groups.hasOwnProperty(groupName)) {
        const group = updatedObj.groups[groupName];
        group.materials = { ...group.materials }; // Make a shallow copy of the materials

        for (const materialName in group.materials) {
          if (group.materials.hasOwnProperty(materialName)) {
            const material = group.materials[materialName];

            const updatedVertices: ObjVertex[] = material.vertices.map(
              (vertex) => {
                // Translate the vertex to the center
                let [x, y, z] = [
                  vertex.x - obj.dimensions.centerX,
                  vertex.y - obj.dimensions.centerY,
                  vertex.z - obj.dimensions.centerZ,
                ];

                [x, y, z] = fn([x, y, z, 1]);

                // Translate the vertex back to the original position
                x = x + obj.dimensions.centerX;
                y = y + obj.dimensions.centerY;
                z = z + obj.dimensions.centerZ;

                const [nx, ny, nz] = fn([vertex.nx, vertex.ny, vertex.nz, 0]);

                let { triangles, u, v, key } = vertex;

                if (opts?.recalculateNormals) {
                  triangles = [];
                }

                return { ...vertex, key, nx, ny, nz, triangles, x, y, z, u, v };
              }
            );

            group.materials[materialName] = {
              id: material.id,
              indexes: material.indexes,
              vertices: updatedVertices,
              triangles: material.triangles,
              texture: material.texture,
              dimensions: this.calculateDimensions(updatedVertices),
              color: material.color,
              tint: material.tint,
            };
          }
        }
        group.vertices = Object.values(group.materials).flatMap(
          (m) => m.vertices
        );
        group.dimensions = this.calculateDimensions(group.vertices);
      }
    }

    updatedObj.vertices = Object.values(obj.groups).flatMap((g) => g.vertices);
    updatedObj.dimensions = this.calculateDimensions(obj.vertices);

    return opts?.recalculateNormals
      ? this.recalculateTriangleNormals(updatedObj)
      : updatedObj;
  }

  public scale(obj: Obj, scale: number, opts?: TransformOpts): Obj {
    return this.transform(
      obj,
      (vec) => this.vecMat.vectorMul(vec, scale),
      opts
    );
  }

  public center(obj: Obj): Obj {
    // use obj dimensions to place the center of the object at [0, 0, 0]
    const { centerX, centerY, centerZ } = obj.dimensions;
    return this.move(obj, [-centerX, -centerY, -centerZ, 0]);
  }

  private recalculateTriangleNormals(obj: Obj): Obj {
    for (const group of Object.values(obj.groups)) {
      for (const material of Object.values(group.materials)) {
        // Recalculate triangle normals and update vertex triangle lists
        for (const triangle of material.triangles) {
          const v1 = material.vertices[triangle.v1];
          const v2 = material.vertices[triangle.v2];
          const v3 = material.vertices[triangle.v3];

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
          this.addVertexNormalFunction(vertex);
        }
      }
    }
    return obj;
  }

  private checkFaceType(face: string): FaceType | undefined {
    const vertexPattern = /^(\d+)\/(\d*)\/(\d+)$/; // Matches format n/n/n
    const vertexTexturePattern = /^(\d+)\/(\d+)$/; // Matches format n/n
    const vertexNormalPattern = /^(\d+)\/\/(\d+)$/; // Matches format n//n
    const vertexOnlyPattern = /^(\d+)$/; // Matches format n

    if (vertexPattern.test(face)) {
      return "vtn";
    }

    if (vertexTexturePattern.test(face)) {
      return "vt";
    }

    if (vertexNormalPattern.test(face)) {
      return "vn";
    }

    if (vertexOnlyPattern.test(face)) {
      return "v";
    }
  }

  private getTriangleNormal(
    triangle: ObjTriangle,
    ov1: ObjVertex,
    ov2: ObjVertex,
    ov3: ObjVertex
  ): ObjTriangle {
    const vv1 = this.vecMat.objVectorToVector(ov1);
    const vv2 = this.vecMat.objVectorToVector(ov2);
    const vv3 = this.vecMat.objVectorToVector(ov3);

    const e1 = this.vecMat.vectorSub(vv2, vv1);
    const e2 = this.vecMat.vectorSub(vv3, vv2);
    const e3 = this.vecMat.vectorSub(vv3, vv1);

    const crossProduct = this.vecMat.vectorCrossProduct(e1, e2);
    const [nx, ny, nz] = this.vecMat.vectorNormalize(crossProduct);

    const { id, v1, v2, v3, materialId, groupId } = triangle;

    const edgeVectors: EdgeVectors = {
      e1: this.vecMat.vectorToPosition(e1),
      e2: this.vecMat.vectorToPosition(e2),
      e3: this.vecMat.vectorToPosition(e3),
    };

    const aw1 = 2 - (1 + this.vecMat.dotProduct3dNormalized(e1, e3));
    const aw2 = 2 - (1 + this.vecMat.dotProduct3dNormalized(this.vecMat.vectorNegate(e1), e2));
    const aw3 = 2 - (1 + this.vecMat.dotProduct3dNormalized(this.vecMat.vectorNegate(e3),this.vecMat.vectorNegate(e2)));

    const weightedNormals: EdgeVectors<Normal> = {
      e1: {
        nx: triangle.nx * aw1,
        ny: triangle.ny * aw1,
        nz: triangle.nz * aw1,
      },
      e2: {
        nx: triangle.nx * aw2,
        ny: triangle.ny * aw2,
        nz: triangle.nz * aw2,
      },
      e3: {
        nx: triangle.nx * aw3,
        ny: triangle.ny * aw3,
        nz: triangle.nz * aw3,
      },
    };

    return {
      id,
      v1,
      v2,
      v3,
      nx,
      ny,
      nz,
      materialId,
      groupId,
      edgeVectors,
      weightedNormals,
    };
  }

  private addVertexNormalFunction = this.addVertexNormalMinMaxMid;

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

  private addVertexNormalMinMaxMid(v: ObjVertex): void {
    v.normalMinMax.max = { nx: Infinity, ny: Infinity, nz: Infinity };
    v.normalMinMax.min = { nx: -Infinity, ny: -Infinity, nz: -Infinity };

    let i = v.triangles.length;
    while (i--) {
      const tri = v.triangles[i];
      v.normalMinMax.max.nx = Math.max(v.normalMinMax.min.nx, tri.nx);
      v.normalMinMax.max.ny = Math.max(v.normalMinMax.min.ny, tri.ny);
      v.normalMinMax.max.nz = Math.max(v.normalMinMax.min.nz, tri.nz);
      v.normalMinMax.min.nx = Math.min(v.normalMinMax.max.nx, tri.nx);
      v.normalMinMax.min.ny = Math.min(v.normalMinMax.max.ny, tri.ny);
      v.normalMinMax.min.nz = Math.min(v.normalMinMax.max.nz, tri.nz);
    }

    v.normalMinMax.mid.nx =
      (v.normalMinMax.min.nx + v.normalMinMax.max.nx) * 0.5;
    v.normalMinMax.mid.ny =
      (v.normalMinMax.min.ny + v.normalMinMax.max.ny) * 0.5;
    v.normalMinMax.mid.nz =
      (v.normalMinMax.min.nz + v.normalMinMax.max.nz) * 0.5;

    const l = 1 / this.vecMat.pointDistance3d([0, 0, 0], [
          v.normalMinMax.mid.nx,
          v.normalMinMax.mid.ny,
          v.normalMinMax.mid.nz
        ]
      );

    v.nx = v.normalMinMax.mid.nx * l;
    v.ny = v.normalMinMax.mid.ny * l;
    v.nz = v.normalMinMax.mid.nz * l;
  }

  private splitDataToLines(data: string): string[] {
    return data
      .split("\n")
      .map((line) => line.trim().replace("\r", ""))
      .filter((line) => line.charAt(0) !== "#");
  }

  private separateFacesAndData(lines: string[]) {
    const lineData: ObjLineData[] = [];
    const faceData: FaceGroup<ObjLineFace>[] = [];

    const groups = this.splitFacesByGroupAndMaterial(lines);

    lines.forEach((line: string) => {
      const values = line.split(" ");
      const [char, d1, d2, d3] = values;

      if (char !== "f") {
        const n1f = parseFloat(d1);
        const n2f = parseFloat(d2);

        const arr: ObjLineData = [char, n1f, n2f];

        if (d3) {
          const n3f = parseFloat(d3);
          arr.push(n3f);
        }

        lineData.push(arr);
      }
    });

    groups.forEach((group) => {
      group.materials.forEach((material) => {
        const lineFaces: ObjLineFace[] = [];

        material.faces.forEach((face) => {
          const vertices = face
            .split(" ")
            .map(
              (vertex) =>
                vertex.split("/").map((v) => parseFloat(v) - 1) as FaceEntry
            );

          // Triangulate the polygonal face
          for (let i = 1; i < vertices.length - 1; i++) {
            lineFaces.push([
              vertices[0],
              vertices[i],
              vertices[i + 1],
              this.checkFaceType(face),
            ]);
          }
        });

        if (lineFaces.length) {
          faceData.push({
            id: group.id,
            materials: [{ id: material.id, faces: lineFaces }],
          });
        }
      });
    });

    return { lineData, faceData };
  }

  private separateData(data: ObjLineData[]) {
    const positions: Position[] = [];
    const normals: Normal[] = [];
    const textures: Texture[] = [];

    data.forEach((line) => {
      const [char, n1, n2, n3] = line;

      if (char === "v") {
        positions.push({ x: n1, y: n2, z: n3 as number });
      }

      if (char === "vn") {
        normals.push({ nx: n1, ny: n2, nz: n3 as number });
      }

      if (char === "vt") {
        textures.push({ u: n1, v: n2 });
      }
    });

    return { positions, normals, textures };
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

  private parseMTL(mtlData: string[]): Material[] {
    const materials: Material[] = [];
    let currentMaterial: Material | null = null;

    mtlData.forEach((line) => {
      const tokens = line.trim().split(/\s+/);
      const cmd = tokens[0];

      switch (cmd) {
        case "newmtl": // New material
          if (currentMaterial !== null) {
            materials.push(currentMaterial);
          }
          currentMaterial = { name: tokens[1] };
          break;
        case "Ns": // Specular exponent/highlights
          if (currentMaterial) currentMaterial.Ns = parseFloat(tokens[1]);
          break;
        case "Ka": // Ambient color
          if (currentMaterial)
            currentMaterial.Ka = tokens.slice(1).map(parseFloat) as Vec3;
          break;
        case "Kd": // Diffuse color
          if (currentMaterial)
            currentMaterial.Kd = tokens.slice(1).map(parseFloat) as Vec3;
          break;
        case "Ks": // Specular color
          if (currentMaterial)
            currentMaterial.Ks = tokens.slice(1).map(parseFloat) as Vec3;
          break;
        case "Ke": // Emissive color
          if (currentMaterial)
            currentMaterial.Ke = tokens.slice(1).map(parseFloat) as Vec3;
          break;
        case "Ni": // Optical density
          if (currentMaterial) currentMaterial.Ni = parseFloat(tokens[1]);
          break;
        case "d": // Dissolve (transparency)
          if (currentMaterial) currentMaterial.d = parseFloat(tokens[1]);
          break;
        case "illum": // Illumination model
          if (currentMaterial) currentMaterial.illum = parseInt(tokens[1], 10);
          break;
        case "map_Kd": // Diffuse texture
          if (currentMaterial)
            currentMaterial.map_Kd = tokens.slice(1).join(" ");
          break;
      }
    });

    // Push the last material encountered, if any.
    if (currentMaterial !== null) {
      materials.push(currentMaterial);
    }

    return materials;
  }

  private async loadFile(name: string): Promise<string[]> {
    const data: string = await window.electron.readFile(name);
    return this.splitDataToLines(data);
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
      v1: 0,
      v2: 0,
      v3: 0,
      nx: 0,
      ny: 0,
      nz: 0,
      weightedNormals: {
        e1: { nx: 0, ny: 0, nz: 0 },
        e2: { nx: 0, ny: 0, nz: 0 },
        e3: { nx: 0, ny: 0, nz: 0 },
      },
      edgeVectors: {
        e1: { x: 0, y: 0, z: 0 },
        e2: { x: 0, y: 0, z: 0 },
        e3: { x: 0, y: 0, z: 0 },
      },
    };
  }

  private async checkForMtlFile(
    lines: string[]
  ): Promise<Material[] | undefined> {
    for (const line of lines) {
      if (line.startsWith("mtllib")) {
        const [_, ...mtlFile] = line.split(" ");
        try {
          const mtlData = await this.loadFile(mtlFile.join(" "));
          return this.parseMTL(mtlData);
        } catch (e) {
          return undefined;
        }
      }
    }
  }

  private splitFacesByGroupAndMaterial(lines: string[]): FaceGroup<string>[] {
    let currentGroup = "default";
    let currentMaterial = "default";

    const groups: FaceGroup<string>[] = [];

    for (const line of lines) {
      if (line.startsWith("g ")) {
        const [_, group] = line.split(" ");
        currentGroup = group;
      }

      if (line.startsWith("usemtl ")) {
        const [_, material] = line.split(" ");
        currentMaterial = material;
      }

      if (line.startsWith("f ")) {
        const [_, ...faces] = line.split(" ");

        const group = groups.find((g) => g.id === currentGroup);

        if (group) {
          const material = group.materials.find(
            (f) => f.id === currentMaterial
          );

          if (material) {
            material.faces.push(faces.join(" "));
          } else {
            group.materials.push({
              id: currentMaterial,
              faces: [faces.join(" ")],
            });
          }
        } else {
          groups.push({
            id: currentGroup,
            materials: [{ id: currentMaterial, faces: [faces.join(" ")] }],
          });
        }
      }
    }

    return groups;
  }

  private initObj(id: string): Obj {
    return {
      id,
      groups: {},
      color: [0.6, 0.6, 0.6, 1],
      tint: [0, 0, 0, 0],
      transparency: 1,
      texture: undefined,
      dimensions: {} as any,
      vertices: [],
    };
  }

  private objToStoreObj(obj: Obj): StoreObj {
    return {
      ...obj,
      move: (location: AnyVec) => this.objToStoreObj(this.move(obj, location)),
      scale: (scale: number, opts?: TransformOpts) =>
        this.objToStoreObj(this.scale(obj, scale, opts)),
      center: () => this.objToStoreObj(this.center(obj)),
      transform: (fn: (vec: Vec4) => Vec4, opts?: TransformOpts) =>
        this.objToStoreObj(this.transform(obj, fn, opts)),
      store: () => {
        this.set(obj.id, obj);
        return this.objToStoreObj(obj);
      },
    };
  }
}
