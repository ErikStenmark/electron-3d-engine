import { AnyVec, DataTriangle, DataVert, Mesh, ObjStoreObj, Vec4 } from './engine/types';
import VecMat from './engine/vecmat';
import { IObjectStore, ObjLine } from './obj-store';
import { cloneArray } from './utils';

const vecMat = new VecMat();

function getTriangleNormal(triangle: DataTriangle, v1: DataVert, v2: DataVert, v3: DataVert): DataTriangle {

  // Edges
  const e1x = v2.x - v1.x;
  const e1y = v2.y - v1.y;
  const e1z = v2.z - v1.z;

  // const e2x = v3.x - v2.x;
  // const e2y = v3.y - v2.y;
  // const e2z = v3.z - v2.z;

  const e3x = v3.x - v1.x;
  const e3y = v3.y - v1.y;
  const e3z = v3.z - v1.z;

  // Get the cross product of 2 of them, to create a
  // vector that is perpendicular to all 3 edge vectors:
  const cx = e1y * e3z - e1z * e3y;
  const cy = e1z * e3x - e1x * e3z;
  const cz = e1x * e3y - e1y * e3x;

  let [nx, ny, nz] = vecMat.vectorNormalize([cx, cy, cz]);

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

function getVertexNormal(v: DataVert): void {
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

export class ObjectStoreObj implements IObjectStore<ObjStoreObj> {
  private objStore: { [key: string]: ObjStoreObj } = {};

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

    const verts: Vec4[] = [];
    const indexes: number[] = [];

    const mesh: Mesh = [];

    const dataVerts: DataVert[] = [];
    const dataTris: DataTriangle[] = [];

    const getVerts = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'v') {
        verts.push([one, two, three, 1]);
        dataVerts.push({ x: one, y: two, z: three, nx: 0, ny: 0, nz: 0, triangles: [] });
      }
    }

    const getIndexes = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'f') {
        indexes.push(one - 1, two - 1, three - 1);
      }
    }

    const getData = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'f') {
        const i1 = one - 1;
        const i2 = two - 1;
        const i3 = three - 1;

        const vert1 = verts[i1];
        const vert2 = verts[i2];
        const vert3 = verts[i3];

        const dv1 = dataVerts[i1];
        const dv2 = dataVerts[i2];
        const dv3 = dataVerts[i3];

        let dataTriangle: DataTriangle = {
          v1: i1,
          v2: i2,
          v3: i3,
          nx: 0,
          ny: 0,
          nz: 0
        };

        dataTriangle = getTriangleNormal(dataTriangle, dv1, dv2, dv3);

        dv1.triangles.push(dataTriangle);
        dv2.triangles.push(dataTriangle);
        dv3.triangles.push(dataTriangle);

        dataTris.push(dataTriangle);
        mesh.push([vert1, vert2, vert3]);
      }
    }

    lines.forEach((line) => getVerts(line));
    lines.forEach(line => getIndexes(line));
    lines.forEach((line) => getData(line));
    dataVerts.forEach(vert => getVertexNormal(vert));

    this.objStore[key] = {
      indexes,
      verts,
      dataTris,
      dataVerts
    }

  }

  public get(key: string) {
    const obj: ObjStoreObj = {
      verts: cloneArray(this.objStore[key].verts),
      indexes: cloneArray(this.objStore[key].indexes),
      dataTris: cloneArray(this.objStore[key].dataTris),
      dataVerts: cloneArray(this.objStore[key].dataVerts)
    };

    return obj;
  }

  public set(key: string, obj: ObjStoreObj) {
    delete this.objStore.key;
    this.objStore[key] = obj;
  }

  public combine(objects: ObjStoreObj[]) {
    const newObj: ObjStoreObj = {
      verts: [],
      indexes: [],
      dataTris: [],
      dataVerts: []
    };

    objects.forEach((obj, i) => {
      if (!i) {
        newObj.verts = obj.verts;
        newObj.indexes = obj.indexes;
        newObj.dataTris = obj.dataTris;
        newObj.dataVerts = obj.dataVerts;
      } else {
        const vertAmount = newObj.verts.length;

        obj.verts.forEach(vert => newObj.verts.push(vert));
        obj.dataTris.forEach(tri => newObj.dataTris.push(tri));
        obj.dataVerts.forEach(vert => newObj.dataVerts.push(vert));
        obj.indexes.forEach(idx => newObj.indexes.push(idx + vertAmount));
      }
    })

    return newObj;
  }

  public place(object: ObjStoreObj, location: AnyVec) {
    let vertIndex = object.verts.length;

    while (vertIndex--) {
      const point = object.verts[vertIndex];
      const dataPoint = object.dataVerts[vertIndex];

      point[0] = point[0] + location[0]; // + seems to be faster than += for first index
      point[1] += location[1];
      point[2] += location[2];

      dataPoint.x = dataPoint.x + location[0];
      dataPoint.y = dataPoint.y + location[1];
      dataPoint.z = dataPoint.z + location[2];

      object.dataVerts[vertIndex] = dataPoint;
    }

    return this.recalculateNormals(object);
  }

  public transform(obj: ObjStoreObj, fn: (vec: Vec4) => Vec4) {
    let vertIndex = obj.verts.length;

    while (vertIndex--) {
      const point = fn(obj.verts[vertIndex]);

      const dataVert = obj.dataVerts[vertIndex];
      const dv = fn([dataVert.x, dataVert.y, dataVert.z, 1]);

      obj.dataVerts[vertIndex] = { ...obj.dataVerts[vertIndex], x: dv[0], y: dv[1], z: dv[2] }
      obj.verts[vertIndex] = point;
    }

    return this.recalculateNormals(obj);
  }

  private recalculateNormals(obj: ObjStoreObj): ObjStoreObj {
    let i = obj.dataTris.length;

    while (i--) {
      const tri = obj.dataTris[i];
      obj.dataTris[i] = getTriangleNormal(tri, obj.dataVerts[tri.v1], obj.dataVerts[tri.v2], obj.dataVerts[tri.v3]);
    }

    i = obj.dataVerts.length;

    while (i--) {
      getVertexNormal(obj.dataVerts[i]);
    }

    return obj;
  }
}