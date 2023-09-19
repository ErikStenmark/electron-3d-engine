import VecMat from './engine/vecmat';
import { AnyVec, ObjTriangle, ObjVertex, Obj, Vec4 } from './engine/types';
import { cloneArray } from './utils';

export type ObjLine = [string, number, number, number];

export interface IObjectStore {
  load(name: string, key: string): Promise<void>;
  get(key: string): Obj;
  set(key: string, obj: Obj): void;
  combine(objects: Obj[]): Obj;
  place(object: Obj, location: AnyVec): Obj;
  transform(obj: Obj, fn: (vec: Vec4) => Vec4): Obj;
}

export class ObjectStore implements IObjectStore {
  private objStore: { [key: string]: Obj } = {};
  private vecMat = new VecMat();

  public async load(name: string, key: string) {
    const data: string = await window.electron.readFile(name);

    const lines = data
      .split("\n")
      .map(line => line.trim().replace("\r", ''))
      .filter(line => line.charAt(0) !== '#')

    const splitLine = (line: string): ObjLine => {
      const values = line.split(' ');
      const [char, one, two, three] = values;

      const nOne = parseFloat(one);
      const nTwo = parseFloat(two);
      const nThree = parseFloat(three);

      return [char, nOne, nTwo, nThree];
    }

    const indexes: number[] = [];
    const vertices: ObjVertex[] = [];
    const triangles: ObjTriangle[] = [];

    const getVertices = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'v') {
        vertices.push({ x: one, y: two, z: three, nx: 0, ny: 0, nz: 0, triangles: [] });
      }
    }

    const getIndexes = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'f') {
        indexes.push(one - 1, two - 1, three - 1);
      }
    }

    const getData = (line: string, i: number) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'f') {
        const i1 = one - 1;
        const i2 = two - 1;
        const i3 = three - 1;

        const v1 = vertices[i1];
        const v2 = vertices[i2];
        const v3 = vertices[i3];

        let triangle: ObjTriangle = {
          id: `${key}-${i}`,
          v1: i1,
          v2: i2,
          v3: i3,
          nx: 0,
          ny: 0,
          nz: 0
        };

        triangle = this.getTriangleNormal(triangle, v1, v2, v3);

        v1.triangles.push(triangle);
        v2.triangles.push(triangle);
        v3.triangles.push(triangle);

        triangles.push(triangle);
      }
    }

    lines.forEach((line) => getVertices(line));
    lines.forEach(line => getIndexes(line));
    lines.forEach((line, i) => getData(line, i));

    vertices.forEach(vert => this.getVertexNormal(vert));

    this.objStore[key] = {
      indexes,
      triangles,
      vertices
    }
  }

  public get(key: string) {
    const obj: Obj = {
      indexes: this.objStore[key].indexes,
      triangles: this.objStore[key].triangles,
      vertices: cloneArray(this.objStore[key].vertices)
    };

    return obj;
  }

  public set(key: string, obj: Obj) {
    delete this.objStore.key;
    this.objStore[key] = obj;
  }

  public combine(objects: Obj[]) {
    const newObj: Obj = {
      indexes: [],
      triangles: [],
      vertices: []
    };

    let vertAmount = 0;

    for (const obj of objects) {
      const numVertices = obj.vertices.length;

      for (let i = 0; i < obj.triangles.length; i++) {
        const tri = obj.triangles[i];
        newObj.triangles.push({
          ...tri,
          v1: tri.v1 + vertAmount,
          v2: tri.v2 + vertAmount,
          v3: tri.v3 + vertAmount
        });
      }

      newObj.vertices.push(...obj.vertices);

      for (let i = 0; i < obj.indexes.length; i++) {
        newObj.indexes.push(obj.indexes[i] + vertAmount);
      }

      vertAmount += numVertices;
    }

    return newObj;
  }

  public place(object: Obj, location: AnyVec) {
    let i = object.vertices.length;

    while (i--) {
      const vertex = object.vertices[i];

      vertex.x = vertex.x + location[0];
      vertex.y = vertex.y + location[1];
      vertex.z = vertex.z + location[2];

      object.vertices[i] = vertex;
    }

    return this.recalculateNormals(object);
  }

  public transform(obj: Obj, fn: (vec: Vec4) => Vec4) {
    let i = obj.vertices.length;

    while (i--) {
      const vertex = obj.vertices[i];
      const [x, y, z] = fn([vertex.x, vertex.y, vertex.z, 1]);

      const { nx, ny, nz, triangles } = vertex;
      obj.vertices[i] = { nx, ny, nz, triangles, x, y, z }
    }

    return this.recalculateNormals(obj);
  }

  private recalculateNormals(obj: Obj): Obj {
    const triMap: Record<string, ObjTriangle> = {};
    const { triangles, vertices } = obj;

    let i = triangles.length - 1;
    for (i - 1; i >= 0; i--) {
      const tri = triangles[i];
      const newTri = this.getTriangleNormal(tri, vertices[tri.v1], vertices[tri.v2], vertices[tri.v3]);
      triMap[newTri.id] = newTri;
      triangles[i] = newTri;
    }

    i = vertices.length - 1;
    for (i - 1; i >= 0; i--) {
      const currentVertex = vertices[i];
      const newVertexTriangles: ObjTriangle[] = [];

      let j = currentVertex.triangles.length - 1;
      for (j - 1; j >= 0; j--) {
        const tri = currentVertex.triangles[j];
        newVertexTriangles.push(triMap[tri.id]);
      }

      currentVertex.triangles = newVertexTriangles;
      this.getVertexNormal(currentVertex);
    }

    return obj;
  }

  /** this should be reverted it is slower now */
  private getTriangleNormal(triangle: ObjTriangle, ov1: ObjVertex, ov2: ObjVertex, ov3: ObjVertex): ObjTriangle {
    const e1 = this.vecMat.vectorSub(this.vecMat.objVectorToVector(ov2), this.vecMat.objVectorToVector(ov1));
    const e2 = this.vecMat.vectorSub(this.vecMat.objVectorToVector(ov3), this.vecMat.objVectorToVector(ov1));
    const crossProduct = this.vecMat.vectorCrossProduct(e1, e2);
    const [nx, ny, nz] = this.vecMat.vectorNormalize(crossProduct);

    const { id, v1, v2, v3 } = triangle
    return { id, v1, v2, v3, nx, ny, nz };
  }

  private getVertexNormal(v: ObjVertex): void {
    let nx = 0;
    let ny = 0;
    let nz = 0;

    const len = v.triangles.length;
    for (let i = 0; i < len; i++) {
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