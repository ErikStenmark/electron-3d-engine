import { Obj, Vec4 } from '../engine/types';
import { IScene, Scene } from '../scene/scene';

export class CubesScene extends Scene implements IScene {

  constructor() {
    super();

    this.setStartPosition({
      camera: [0.5, 0.5, 0]
    });

    this.setLight({
      direction: [0, 1, 1, 1],
      ambient: [1, 1, 1, 0.6]
    });
  }

  public async load() {
    await this.loader.load('cube-tx-n.obj', 'cube');
    await this.loader.setTexture({ obj: 'cube', textureKey: 'crate-tx', textureFile: 'crate.png' });
  }

  public update(elapsedTime: number) {
    const cubes: Obj[] = [];

    const gridSize = 10; // Size of the grid (10x10)
    const spacing = 5;   // Spacing between entries
    const numEntries = 100; // Number of entries

    for (let i = 0; i < numEntries; i++) {
      const row = Math.floor(i / gridSize);
      const col = i % gridSize;

      const entryX = col * spacing;
      const entryY = row * spacing;

      cubes.push(this.loader.move(this.loader.get('cube', { clone: true }), [entryX, entryY, -20, 0]));
    }

    const cubesRotated = cubes.map((cube, i) => {
      const iMod = i % 4;

      let cubeTransformed: Obj;
      const rotX = this.vecMat.matrixRotationX(this.vecMat.degToRad(elapsedTime / 100));
      const rotY = this.vecMat.matrixRotationY(this.vecMat.degToRad(elapsedTime / 100));
      const rotZ = this.vecMat.matrixRotationZ(this.vecMat.degToRad(elapsedTime / 100));
      const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY, rotZ);

      switch (iMod) {
        case 0:
          cubeTransformed = this.loader.transform(cube, (v: Vec4) => {
            return this.vecMat.matrixMultiplyVector(rotX, v)
          });
          break;
        case 1:
          cubeTransformed = this.loader.transform(cube, (v: Vec4) => {
            return this.vecMat.matrixMultiplyVector(rotY, v)
          });
          break;
        case 2:
          cubeTransformed = this.loader.transform(cube, (v: Vec4) => {
            return this.vecMat.matrixMultiplyVector(rotZ, v)
          });
          break;
        case 3:
          cubeTransformed = this.loader.transform(cube, (v: Vec4) => {
            return this.vecMat.matrixMultiplyVector(combined, v)
          }
          );
          break;
        default:
          throw new Error('invalid iMod');
      }

      return cubeTransformed;
    });

    this.scene = cubesRotated;
  }
}