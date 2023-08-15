import { Vec4 } from '../engine/types';
import { IScene, Scene } from '../scene/scene';

export class TeapotScene extends Scene implements IScene {

  constructor() {
    super();

    this.setStartPosition({
      camera: [0, 30, 0]
    });
  }

  public async load() {
    await this.objLoader.load('mountains.obj', 'mountains');
    await this.objLoader.load('teaPot.obj', 'teapot');
    await this.objLoader.load('axis.obj', 'axis');
    await this.objLoader.load('videoShip.obj', 'ship');

    const axis = this.objLoader.place(this.objLoader.get('axis'), [0, 5, 25, 1]);
    this.objLoader.set('axis', axis);

    let ship = this.objLoader.place(this.objLoader.get('ship'), [-25, 14, -25, 1]);
    const rotX = this.vecMat.matrixRotationX(this.vecMat.degToRad(-20));
    const rotY = this.vecMat.matrixRotationY(this.vecMat.degToRad(35));

    ship = this.objLoader.transform(ship, (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotX,
        this.vecMat.matrixMultiplyVector(rotY, v))
    );

    this.objLoader.set('axis', ship);

    const combined = this.objLoader.combine([this.objLoader.get('mountains'), ship, axis]);

    this.objLoader.set('scene', combined);

    this.scene = combined;
  }

  public update(elapsedTime: number) {
    const sin = 45 * Math.sin(elapsedTime / 20000);
    const cos = 45 * Math.cos(elapsedTime / 20000);

    const rotX = this.vecMat.matrixRotationX(this.vecMat.degToRad(elapsedTime / 100));
    const rotY = this.vecMat.matrixRotationY(this.vecMat.degToRad(elapsedTime / 50));

    let teaPot = this.objLoader.transform(this.objLoader.get('teapot'), (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotX,
        this.vecMat.matrixMultiplyVector(rotY, v))
    );

    teaPot = this.objLoader.place(teaPot, [15 + cos, 20, sin, 1]);

    this.scene = this.objLoader.combine([teaPot, this.objLoader.get('scene')]);
  }
}