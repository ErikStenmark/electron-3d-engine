import { AnyVec, ObjTriangle, ObjVertex, Obj, Vec4 } from './engine/types';
import VecMat from './engine/vecmat';
import { IObjectStore, ObjLine } from './obj-store';
import { cloneArray } from './utils';

export class ObjectStoreObj implements IObjectStore<Obj> {
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

    const getVerts = (line: string) => {
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

        const dv1 = vertices[i1];
        const dv2 = vertices[i2];
        const dv3 = vertices[i3];

        let dataTriangle: ObjTriangle = {
          id: i,
          v1: i1,
          v2: i2,
          v3: i3,
          nx: 0,
          ny: 0,
          nz: 0
        };

        dataTriangle = this.getTriangleNormal(dataTriangle, dv1, dv2, dv3);

        dv1.triangles.push(dataTriangle);
        dv2.triangles.push(dataTriangle);
        dv3.triangles.push(dataTriangle);

        triangles.push(dataTriangle);
      }
    }

    lines.forEach((line) => getVerts(line));
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
      newObj.triangles.push(...obj.triangles);
      newObj.vertices.push(...obj.vertices);
      newObj.indexes.push(...obj.indexes.map(idx => idx + vertAmount));
      vertAmount += obj.vertices.length;
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

      obj.vertices[i] = { ...obj.vertices[i], x, y, z }
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

      for (const tri of currentVertex.triangles) {
        newVertexTriangles.push(triMap[tri.id]);
      }

      currentVertex.triangles = newVertexTriangles;
      this.getVertexNormal(currentVertex);
    }

    return obj;
  }

  private getTriangleNormal(triangle: ObjTriangle, v1: ObjVertex, v2: ObjVertex, v3: ObjVertex): ObjTriangle {

    // Edges
    const e1x = v2.x - v1.x;
    const e1y = v2.y - v1.y;
    const e1z = v2.z - v1.z;

    const e3x = v3.x - v1.x;
    const e3y = v3.y - v1.y;
    const e3z = v3.z - v1.z;

    // Get the cross product of 2 of them, to create a
    // vector that is perpendicular to all 3 edge vectors:
    const cx = e1y * e3z - e1z * e3y;
    const cy = e1z * e3x - e1x * e3z;
    const cz = e1x * e3y - e1y * e3x;

    let [nx, ny, nz] = this.vecMat.vectorNormalize([cx, cy, cz]);

    if (isNaN(nx)) {
      nx = 0;
    }

    if (isNaN(ny)) {
      ny = 0;
    }

    if (isNaN(nz)) {
      nz = 0;
    }

    return { ...triangle, nx, ny, nz };
  }

  private getVertexNormal(v: ObjVertex): void {
    let nx = 0;
    let ny = 0;
    let nz = 0;

    for (const tri of v.triangles) {
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