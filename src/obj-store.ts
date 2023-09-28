import VecMat from './engine/vecmat';
import { AnyVec, ObjTriangle, ObjVertex, Obj, Vec4, Position, Normal, Texture, ObjDimensions } from './engine/types';
import { cloneArray } from './utils';

type FaceEntry = [number, number?, number?];

type ObjLineData = [string, number, number, number] | [string, number, number];
type ObjLineFace = [FaceEntry, FaceEntry, FaceEntry, FaceType | undefined];

export type ObjLine = ObjLineData | ObjLineFace;

export interface IObjectStore {
  load(name: string, key: string): Promise<void>;
  loadTexture(name: string, key: string): Promise<void>;
  get(key: string): Obj;
  getTexture(key: string): HTMLImageElement;
  set(key: string, obj: Obj): void;
  combine(objects: Obj[]): Obj;
  place(object: Obj, location: AnyVec): Obj;
  transform(obj: Obj, fn: (vec: Vec4) => Vec4): Obj;
}

type FaceType = 'v' | 'vt' | 'vn' | 'vtn';

export class ObjectStore implements IObjectStore {
  private objStore: { [key: string]: Obj } = {};
  private textureStore: { [key: string]: HTMLImageElement } = {};

  private vecMat = new VecMat();

  private shouldRecalculateTriangleNormals = true;

  private splitDataToLines(data: string): string[] {
    return data
      .split("\n")
      .map(line => line.trim().replace("\r", ''))
      .filter(line => line.charAt(0) !== '#')
  }

  private separateFacesAndData(lines: string[]) {
    const lineData: ObjLineData[] = [];
    const lineFaces: ObjLineFace[] = [];

    lines.forEach((line: string) => {
      const values = line.split(' ');
      const [char, d1, d2, d3] = values;

      if (char !== 'f') {
        const n1f = parseFloat(d1);
        const n2f = parseFloat(d2);

        const arr: ObjLineData = [char, n1f, n2f];

        if (d3) {
          const n3f = parseFloat(d3);
          arr.push(n3f);
        }

        lineData.push(arr);

      } else {
        const d1p = d1.split('/').map(n => parseFloat(n) - 1) as FaceEntry;
        const d2p = d2.split('/').map(n => parseFloat(n) - 1) as FaceEntry;
        const d3p = d3.split('/').map(n => parseFloat(n) - 1) as FaceEntry;

        lineFaces.push([d1p, d2p, d3p, this.checkFaceType(d1)]);
      }
    });

    return { lineData, lineFaces };
  }

  private separateData(data: ObjLineData[]) {
    const positions: Position[] = [];
    const normals: Normal[] = [];
    const textures: Texture[] = [];

    data.forEach(line => {
      const [char, n1, n2, n3] = line;

      if (char === 'v') {
        positions.push({ x: n1, y: n2, z: n3 as number });
      }

      if (char === 'vn') {
        normals.push({ nx: n1, ny: n2, nz: n3 as number });
      }

      if (char === 'vt') {
        textures.push({ u: n1, v: n2 });
      }
    });

    return { positions, normals, textures };
  }

  public async loadTexture(name: string, key: string): Promise<void> {
    const base64 = await window.electron.readFileBase64(name);

    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;

    this.textureStore[key] = img;
  }

  public async setTexture(obj: string | Obj, textureKey: string, textureFile: string) {
    const base64 = await window.electron.readFileBase64(textureFile);

    const img = new Image();
    img.src = `data:image/png;base64,${base64}`;

    this.textureStore[textureKey] = img;

    if (typeof obj === 'string') {
      this.objStore[obj].texture = { id: textureKey, img };
    } else {
      obj.texture = { id: textureKey, img };
      this.objStore[obj.id] = obj;
    }
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
      maxX, minX, maxY, minY, maxZ, minZ, centerX, centerY, centerZ
    };
  }

  public async load(name: string, key: string) {
    const data: string = await window.electron.readFile(name);
    const lines = this.splitDataToLines(data);

    const { lineData, lineFaces } = this.separateFacesAndData(lines);
    const { positions, normals, textures } = this.separateData(lineData);

    const seenKeys: string[] = [];
    const vertices: ObjVertex[] = [];
    const indexes: number[] = [];
    const triangles: ObjTriangle[] = [];

    for (const face of lineFaces) {
      const [v1, v2, v3] = face;

      const triangle: ObjTriangle = {
        id: `${v1.join('/')}-${v2.join('/')}-${v3.join('/')}`,
        v1: 0,
        v2: 0,
        v3: 0,
        nx: 0,
        ny: 0,
        nz: 0
      };

      const addIndexToTriangle = (vertexIndex: number, i: number) => {
        if (i === 0) triangle.v1 = vertexIndex;
        if (i === 1) triangle.v2 = vertexIndex;
        if (i === 2) triangle.v3 = vertexIndex;
      }

      const seenVertices: number[] = [];

      for (let i = 0; i < 3; i++) {
        const [p, t, n] = [v1, v2, v3][i];

        let key = `${p}`;
        if (t || t === 0) key += `/${t}`;
        if (n || n === 0) key += `/${n}`;

        if (seenKeys.includes(key)) {
          const index = seenKeys.indexOf(key);

          indexes.push(index);
          addIndexToTriangle(index, i);

          seenVertices.push(index);
          continue;
        }

        seenKeys.push(key);

        const vec: ObjVertex = {
          key,
          x: positions[p].x,
          y: positions[p].y,
          z: positions[p].z,
          u: t ? textures[t].u : 0,
          v: t ? textures[t].v : 0,
          nx: n ? normals[n].nx : 0,
          ny: n ? normals[n].ny : 0,
          nz: n ? normals[n].nz : 0,
          triangles: []
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

      seenVertices.forEach(vertexIndex => {
        vertices[vertexIndex].triangles.push(triWithNormal);
      });
    }

    if (!normals.length) {
      for (const vertex of vertices) {
        this.addVertexNormal(vertex);
      }
    }

    this.objStore[key] = {
      id: key,
      indexes,
      triangles,
      vertices,
      dimensions: this.calculateDimensions(vertices),
      texture: undefined,
      color: [0.6, 0.6, 0.6, 1],
      tint: [0, 0, 0, 0]
    };

  }

  public get(key: string) {
    const obj = this.objStore[key];

    return {
      id: obj.id,
      indexes: obj.indexes,
      triangles: obj.triangles,
      vertices: cloneArray(obj.vertices),
      texture: obj.texture,
      dimensions: obj.dimensions,
      color: obj.color,
      tint: obj.tint
    };

  }

  public getTexture(key: string) {
    return this.textureStore[key];
  }

  public set(key: string, obj: Obj) {
    delete this.objStore.key;
    this.objStore[key] = obj;
  }

  /**
   * @deprecated Should be updated to support some other way of
   * grouping objects with individual textures, colors and tints and so on.
   */
  public combine(objects: Obj[]) {
    const key = objects.map(obj => obj.id).join('-');
    const newObj: Obj = {
      id: key,
      indexes: [],
      triangles: [],
      vertices: [],
      texture: undefined,
      color: [1, 1, 1, 0],
      tint: [0, 0, 0, 0],
      dimensions: {
        maxX: 0,
        maxY: 0,
        maxZ: 0,
        minX: 0,
        minY: 0,
        minZ: 0,
        centerX: 0,
        centerY: 0,
        centerZ: 0
      }
    };

    let vertAmount = 0;

    for (const obj of objects) {
      const numTriangles = obj.triangles.length;
      for (let i = 0; i < numTriangles; i++) {
        const tri = obj.triangles[i];
        const { id, nx, ny, nz } = tri;

        newObj.triangles.push({
          id, nx, ny, nz,
          v1: tri.v1 + vertAmount,
          v2: tri.v2 + vertAmount,
          v3: tri.v3 + vertAmount
        });
      }

      newObj.vertices.push(...obj.vertices);

      const numIndexes = obj.indexes.length;
      for (let i = 0; i < numIndexes; i++) {
        newObj.indexes.push(obj.indexes[i] + vertAmount);
      }

      vertAmount += obj.vertices.length;
    }

    return newObj;
  }

  public place(object: Obj, location: AnyVec) {
    let i = object.vertices.length;

    let maxX = -Infinity;
    let minX = Infinity;
    let maxY = -Infinity;
    let minY = Infinity;
    let maxZ = -Infinity;
    let minZ = Infinity;

    while (i--) {
      const vertex = object.vertices[i];

      vertex.x = vertex.x + location[0];
      vertex.y = vertex.y + location[1];
      vertex.z = vertex.z + location[2];

      object.vertices[i] = vertex;

      maxX = Math.max(maxX, vertex.x);
      minX = Math.min(minX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
      minY = Math.min(minY, vertex.y);
      maxZ = Math.max(maxZ, vertex.z);
      minZ = Math.min(minZ, vertex.z);
    }

    const centerX = (maxX + minX) / 2;
    const centerY = (maxY + minY) / 2;
    const centerZ = (maxZ + minZ) / 2;

    object.dimensions = {
      maxX, minX, maxY, minY, maxZ, minZ, centerX, centerY, centerZ
    };

    return object;
  }

  public transform(obj: Obj, fn: (vec: Vec4) => Vec4) {
    let i = obj.vertices.length;

    const { centerX, centerY, centerZ } = obj.dimensions;

    while (i--) {
      const vertex = obj.vertices[i];

      // Translate the vertex to the center
      let [x, y, z] = [vertex.x - centerX, vertex.y - centerY, vertex.z - centerZ];

      [x, y, z] = fn([x, y, z, 1]);

      // Translate the vertex back to the original position
      x = x + centerX;
      y = y + centerY;
      z = z + centerZ;

      const [nx, ny, nz] = fn([vertex.nx, vertex.ny, vertex.nz, 0]);

      let { triangles, u, v, key } = vertex;

      if (this.shouldRecalculateTriangleNormals) {
        triangles = [];
      }

      obj.vertices[i] = { key, nx, ny, nz, triangles, x, y, z, u, v }
    }

    return this.recalculateTriangleNormals(obj);
  }

  // The vertex normals should always recalculated when the object is transformed.
  // If the triangles array in the object is actually used for rendering, the triangle 
  // normals might need be recalculated. In this case shouldRecalculateTriangleNormals 
  // needs to be set to true and this function will update the triangle normals.
  private recalculateTriangleNormals(obj: Obj): Obj {

    // If we don't need to recalculate triangle normals, return the object
    if (!this.shouldRecalculateTriangleNormals) {
      return obj;
    }

    // Recalculate triangle normals and update vertex triangle lists
    for (const triangle of obj.triangles) {
      const v1 = obj.vertices[triangle.v1];
      const v2 = obj.vertices[triangle.v2];
      const v3 = obj.vertices[triangle.v3];

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

    return obj;
  }

  private checkFaceType(face: string): FaceType | undefined {
    const vertexPattern = /^(\d+)\/(\d*)\/(\d+)$/; // Matches format n/n/n
    const vertexTexturePattern = /^(\d+)\/(\d+)$/; // Matches format n/n
    const vertexNormalPattern = /^(\d+)\/\/(\d+)$/; // Matches format n//n
    const vertexOnlyPattern = /^(\d+)$/; // Matches format n

    if (vertexPattern.test(face)) {
      return 'vtn';
    }

    if (vertexTexturePattern.test(face)) {
      return 'vt';
    }

    if (vertexNormalPattern.test(face)) {
      return 'vn';
    }

    if (vertexOnlyPattern.test(face)) {
      return 'v';
    }
  }

  private getTriangleNormal(triangle: ObjTriangle, ov1: ObjVertex, ov2: ObjVertex, ov3: ObjVertex): ObjTriangle {
    const e1 = this.vecMat.vectorSub(this.vecMat.objVectorToVector(ov2), this.vecMat.objVectorToVector(ov1));
    const e2 = this.vecMat.vectorSub(this.vecMat.objVectorToVector(ov3), this.vecMat.objVectorToVector(ov1));
    const crossProduct = this.vecMat.vectorCrossProduct(e1, e2);
    const [nx, ny, nz] = this.vecMat.vectorNormalize(crossProduct);

    const { id, v1, v2, v3 } = triangle
    return { id, v1, v2, v3, nx, ny, nz };
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
}