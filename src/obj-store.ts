import VecMat from "./engine/vecmat";

import {
  Position,
  Normal,
  Texture,
  Vec3,
  TextureSample,
  NewObj,
} from "./engine/types";
import { Object3D } from "./obj";

export type ObjLine = ObjLineData | ObjLineFace;

type FaceEntry = [number, number?, number?];
type ObjLineData = [string, number, number, number] | [string, number, number];
export type ObjLineFace = [
  FaceEntry,
  FaceEntry,
  FaceEntry,
  FaceType | undefined
];

export type Material = {
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

export interface IObjectStore {
  loadTexture(name: string, key: string): Promise<TextureSample | undefined>;
  getTexture(key: string): TextureSample | undefined;
  load(name: string, key: string): Promise<Object3D>;
  get(key: string): Object3D;
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

export type FaceGroup<T = string | ObjLineFace> = {
  id: string;
  materials: FaceMaterial<T>[];
};

export class ObjectStore implements IObjectStore {
  private objStore: { [key: string]: NewObj } = {};
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

    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    const img = new Image();
    img.src = `data:${mimeType};base64,${base64}`;

    this.textureStore[id] = img;

    return { id, img };
  }

  public getTexture(key: string): TextureSample | undefined {
    const texture = this.textureStore[key];
    if (!texture) {
      return;
    }

    return { id: key, img: texture };
  }

  private async buildTextureSamples(
    mtlData: Material[]
  ): Promise<TextureSample[]> {
    const texturesFiles = mtlData.reduce((acc: string[], m) => {
      if (m.map_Kd && !acc.includes(m.map_Kd)) {
        acc.push(m.map_Kd);
      }
      return acc;
    }, []);

    const samples: TextureSample[] = [];

    for (const textureFile of texturesFiles) {
      try {
        const sample = await this.loadTexture(textureFile);
        if (sample) {
          samples.push(sample);
        }
      } catch {
        console.warn(`Texture not found, skipping: ${textureFile}`);
      }
    }

    return samples;
  }

  /**
   * @TODO load could create an array of ALL the vertices with proper id:s that could be referenced
   * by the groups and materials instead of them having their own arrays. This might make
   * dimension calculations faster, and make transforming placing the object easier. Not sure
   * if an obj wide vertex can store all the triangles that uses it. or if the triangles needs to
   * be group->material specific.
   */
  public async load(name: string, key: string) {
    if (this.objStore[key]) {
      return new Object3D(key, this.objStore[key], this.vecMat);
    }

    const lines = await this.loadFile(name);
    const mtlData = await this.checkForMtlFile(lines);
    const { lineData, faceData } = this.separateFacesAndData(lines);
    const { positions, normals, textures } = this.separateData(lineData);
    const textureSamples = mtlData
      ? await this.buildTextureSamples(mtlData)
      : [];

    const images: { [key: string]: HTMLImageElement } = {};
    textureSamples.forEach((t) => {
      images[t.id] = t.img;
    });

    const newObj: NewObj = {
      faces: faceData,
      positions,
      normals,
      textures,
      images,
      materials: mtlData || [],
    };

    this.objStore[key] = newObj;
    return new Object3D(key, newObj, this.vecMat);
  }

  public get(key: string): Object3D {
    return new Object3D(key, this.objStore[key], this.vecMat);
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
}
