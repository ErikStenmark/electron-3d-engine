import { Vec4 } from '../engine/types';
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
    await this.loader.loadTexture('crate.png', 'crate-tx');

    const cube = this.loader.get('cube');
    cube.texture = this.loader.getTexture('crate-tx');

    this.loader.set('cube', cube);

    const cube1 = this.loader.place(this.loader.get('cube'), [-5, -5, -20, 0]);
    const cube2 = this.loader.place(this.loader.get('cube'), [5, 5, -20, 0]);
    const cube3 = this.loader.place(this.loader.get('cube'), [5, -5, -20, 0]);
    const cube4 = this.loader.place(this.loader.get('cube'), [-5, 5, -20, 0]);

    this.loader.set('cube1', cube1);
    this.loader.set('cube2', cube2);
    this.loader.set('cube3', cube3);
    this.loader.set('cube4', cube4);
  }

  public update(elapsedTime: number) {
    const rotX = this.vecMat.matrixRotationX(this.vecMat.degToRad(elapsedTime / 10));
    const rotY = this.vecMat.matrixRotationY(this.vecMat.degToRad(elapsedTime / 10));
    const rotZ = this.vecMat.matrixRotationZ(this.vecMat.degToRad(elapsedTime / 10));

    const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY, rotZ);

    const cube1 = this.loader.transform(this.loader.get('cube1'), (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotX, v)
    );

    const cube2 = this.loader.transform(this.loader.get('cube2'), (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotY, v)
    );

    const cube3 = this.loader.transform(this.loader.get('cube3'), (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotZ, v)
    );

    const cube4 = this.loader.transform(this.loader.get('cube4'), (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(combined, v)
    );

    this.scene = [cube1, cube2, cube3, cube4];
  }
}