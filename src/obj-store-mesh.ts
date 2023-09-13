import { AnyVec, Mesh, Vec4 } from './engine/types';
import { IObjectStore, ObjLine } from './obj-store';
import { cloneArray } from './utils'

export class ObjectStoreMesh implements IObjectStore<Mesh> {
  private objStore: { [key: string]: Mesh } = {};

  public async load(name: string, key: string) {
    const data: string = await window.electron.readFile(name);

    const verts: Vec4[] = [];
    const mesh: Mesh = [];

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

    const getVerts = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'v') {
        verts.push([one, two, three, 1]);
      }
    }

    const getTris = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'f') {
        const vert1 = verts[one - 1];
        const vert2 = verts[two - 1];
        const vert3 = verts[three - 1];

        mesh.push([vert1, vert2, vert3]);
      }
    }

    lines.forEach(line => getVerts(line));
    lines.forEach(line => getTris(line));

    this.objStore[key] = mesh;
  }

  public get(key: string) {
    return cloneArray(this.objStore[key]);
  }

  public set(key: string, obj: Mesh) {
    delete this.objStore.key;
    this.objStore[key] = obj;
  }

  public combine(objects: Mesh[]) {
    const newMesh: Mesh = [];

    let meshIndex = objects.length;
    while (meshIndex--) {
      newMesh.push(...objects[meshIndex]);
    }

    return newMesh;
  }

  public place(object: Mesh, location: AnyVec) {
    let meshIndex = object.length;

    while (meshIndex--) {
      const [p1, p2, p3] = object[meshIndex];

      p1[0] = p1[0] + location[0]; // + seems to be faster than += for first index
      p1[1] += location[1];
      p1[2] += location[2];

      p2[0] = p2[0] + location[0];
      p2[1] += location[1];
      p2[2] += location[2];

      p3[0] = p3[0] + location[0];
      p3[1] += location[1];
      p3[2] += location[2];
    }

    return object;
  }

  public transform(obj: Mesh, fn: (vec: Vec4) => Vec4) {
    let meshIndex = obj.length;
    while (meshIndex--) {
      const triangle = obj[meshIndex];
      triangle[0] = fn(triangle[0]);
      triangle[1] = fn(triangle[1]);
      triangle[2] = fn(triangle[2]);
    }

    return obj;
  }
}