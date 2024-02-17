import { Vec4 } from "../engine/types";
import { IScene, Scene } from "../scene/scene";

export class ComplexObjectsScene extends Scene implements IScene {

  private keys = {
    xWing: 'x-wing',
    car: 'car',
    airplane: 'airplane'
  };

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
    const { keys } = this

    const xWing = (await this.loader.load("x-wing.obj", keys.xWing)).move([0, 0, -15, 0]).store();
    const car = (await this.loader.load("1377 Car.obj", keys.car)).scale(0.01).move([-3, 0, -15, 0]).store();
    const airplane = (await this.loader.load("Airplane.obj", keys.airplane)).scale(0.0025).move([3, 0, -15, 0]).store();

    this.scene = [xWing, car, airplane];
  }

  public update(elapsedTime: number) {
    const { keys } = this

    const rotationAmount = elapsedTime / 100;
    const rotX = this.vecMat.matrixRotationXDeg(rotationAmount);
    const rotY = this.vecMat.matrixRotationYDeg(rotationAmount);
    const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY);

    const xWing = this.loader.get(keys.xWing).transform((v: Vec4) =>
      this.vecMat.matrixMultiplyVector(combined, v));

    const car = this.loader.get(keys.car).transform((v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotX, v));

    const airplane = this.loader.get(keys.airplane).transform((v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotY, v));

    this.scene = [xWing, car, airplane];
  }
}
