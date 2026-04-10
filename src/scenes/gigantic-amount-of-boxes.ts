import { Object3D } from "../obj";
import { IScene, Scene } from "../scene/scene";

export class GiganticAmountOfBoxes extends Scene implements IScene {
  private objects: { [key: string]: Object3D } = {};
  private cubes: Object3D[] = [];

  private gridSize = 10;
  private numGrids = 10;
  private spacing = 5;

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
    await this.setPlayerModel("camera.obj", "player-camera");

    this.objects["cube"] = (
      await this.loader.load("cube-tx-n.obj", "cube")
    ).setName("Crate").move([0, 0, -7, 0]);
    this.objects["cube"].get().color = [0, 1, 0, 1];
    const texture = await this.loader.loadTexture("crate.png", "crate");
    if (texture) {
      this.objects["cube"].setTexture(texture);
    }

    this.cubes = [];

    const numEntries = this.gridSize * this.gridSize;
    for (let g = 0; g < this.numGrids; g++) {
      const entryZ = g * this.spacing;
      for (let i = 0; i < numEntries; i++) {
        const row = Math.floor(i / this.gridSize);
        const col = i % this.gridSize;
        const cube = this.objects["cube"].clone(`cube-${g}-${i}`);
        cube.move([col * this.spacing, row * this.spacing, entryZ, 0]);
        this.cubes.push(cube);
      }
    }

    this.scene = [];
  }

  public update({
    deltaTime,
  }: {
    elapsedTime: number;
    deltaTime: number;
  }) {
    const rotationAmount = 0.05 * deltaTime;
    const rotX = this.vecMat.matrixRotationXDeg(rotationAmount);
    const rotY = this.vecMat.matrixRotationYDeg(rotationAmount);
    const rotZ = this.vecMat.matrixRotationZDeg(rotationAmount);
    const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY, rotZ);

    for (let i = 0; i < this.cubes.length; i++) {
      switch (i % 4) {
        case 0: this.cubes[i].applyMatrix(rotX); break;
        case 1: this.cubes[i].applyMatrix(rotY); break;
        case 2: this.cubes[i].applyMatrix(rotZ); break;
        case 3: this.cubes[i].applyMatrix(combined); break;
      }
    }

    this.scene = this.cubes.map((c) => c.get());
  }
}
