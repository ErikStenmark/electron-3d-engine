import { Obj, Vec4 } from "../engine/types";
import { Object3D } from "../obj";
import { IScene, Scene } from "../scene/scene";

export class LotsOfBoxes extends Scene implements IScene {
  private objects: { [key: string]: Object3D } = {};
  private cubes: Object3D[] = [];

  private gridSize = 10; // Size of the grid (10x10)
  private spacing = 5; // Spacing between entries
  private numEntries = 100; // Number of entries

  constructor() {
    super();
    this.setStartPosition({
      camera: [0.5, 0.5, 0],
    });

    this.setLight({
      direction: [0, 1, 1, 1],
      ambient: [1, 1, 1, 0.6],
    });
  }

  public async load() {
    this.objects["cube"] = (
      await this.loader.load("cube-tx-n.obj", "cube")
    ).move([0, 0, -15, 0]);
    const texture = await this.loader.loadTexture("crate.png", "crate");
    if (texture) {
      this.objects["cube"].setTexture(texture);
    }

    this.cubes = [];

    for (let i = 0; i < this.numEntries; i++) {
      const row = Math.floor(i / this.gridSize);
      const col = i % this.gridSize;

      const entryX = col * this.spacing;
      const entryY = row * this.spacing;

      const cube = this.objects["cube"].clone(`cube-${i}`); // Clone the cube object
      cube.move([entryX, entryY, 0, 0]);
      this.cubes.push(cube);
    }

    this.scene = [];
  }

  public update({
    elapsedTime,
    deltaTime,
  }: {
    elapsedTime: number;
    deltaTime: number;
  }) {
    const rotationAmount = 0.05 * deltaTime;
    const cubesRotated = this.cubes.map((cube, i) => {
      const iMod = i % 4;

      let cubeTransformed: Obj;
      const rotX = this.vecMat.matrixRotationXDeg(rotationAmount);
      const rotY = this.vecMat.matrixRotationYDeg(rotationAmount);
      const rotZ = this.vecMat.matrixRotationZDeg(rotationAmount);
      const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY, rotZ);

      switch (iMod) {
        case 0:
          cubeTransformed = cube
            .transform((v: Vec4) => {
              return this.vecMat.matrixMultiplyVector(rotX, v);
            })
            .get();
          break;
        case 1:
          cubeTransformed = cube
            .transform((v: Vec4) => {
              return this.vecMat.matrixMultiplyVector(rotY, v);
            })
            .get();
          break;
        case 2:
          cubeTransformed = cube
            .transform((v: Vec4) => {
              return this.vecMat.matrixMultiplyVector(rotZ, v);
            })
            .get();
          break;
        case 3:
          cubeTransformed = cube
            .transform((v: Vec4) => {
              return this.vecMat.matrixMultiplyVector(combined, v);
            })
            .get();
          break;
        default:
          throw new Error("invalid iMod");
      }

      return cubeTransformed;
    });

    this.scene = cubesRotated;
  }
}
