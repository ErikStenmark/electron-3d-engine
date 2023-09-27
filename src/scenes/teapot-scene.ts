import { Obj, Vec4 } from '../engine/types';
import { IScene, Scene } from '../scene/scene';

export class TeapotScene extends Scene implements IScene {

  constructor() {
    super();

    this.setStartPosition({
      camera: [0, 30, 75]
    });

    this.setLight({
      color: [1, 1, 1, 0.6],
      ambient: [1, 1, 1, 0.2],
    })
  }

  private staticObjects: Obj[] = [];

  public async load() {
    await this.loader.load('mountains.obj', 'mountains');
    await this.loader.load('teaPot.obj', 'teapot');
    await this.loader.load('axis-right-handed.obj', 'axis');
    await this.loader.load('videoShip.obj', 'ship');
    await this.loader.load('cube-tx-n.obj', 'cube');
    await this.loader.loadTexture('crate.png', 'crate-tx');

    this.loader.set('teapot', { ...this.loader.get('teapot'), tint: [1, 0, 0, 0.7] });

    const cube = this.loader.place(this.loader.get('cube'), [-40, 2, 25, 0]);

    cube.texture = this.loader.getTexture('crate-tx');
    this.loader.set('cube', cube);

    const axis = this.loader.place(this.loader.get('axis'), [0, 5, 25, 1]);
    this.loader.set('axis', axis);

    let ship = this.loader.place(this.loader.get('ship'), [-13, 1.5, -40, 1]);
    const rotX = this.vecMat.matrixRotationX(this.vecMat.degToRad(-20));
    const rotY = this.vecMat.matrixRotationY(this.vecMat.degToRad(35));

    ship = this.loader.transform(ship, (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotX,
        this.vecMat.matrixMultiplyVector(rotY, v))
    );

    this.loader.set('ship', ship);

    this.staticObjects = [this.loader.get('mountains'), cube, ship, axis];
    this.scene = this.staticObjects;
  }

  public update(elapsedTime: number) {
    const sin = 45 * Math.sin(elapsedTime / 20000);
    const cos = 45 * Math.cos(elapsedTime / 20000);

    const rotX = this.vecMat.matrixRotationX(this.vecMat.degToRad(elapsedTime / 100));
    const rotY = this.vecMat.matrixRotationY(this.vecMat.degToRad(elapsedTime / 50));

    let teaPot = this.loader.transform(this.loader.get('teapot'), (v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotX,
        this.vecMat.matrixMultiplyVector(rotY, v))
    );

    teaPot = this.loader.place(teaPot, [15 + cos, 20, sin, 1]);

    this.scene = [...this.staticObjects, teaPot];
  }
}