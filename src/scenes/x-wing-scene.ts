import { Vec4 } from "../engine/types";
import { IScene, Scene } from "../scene/scene";

export class XWingScene extends Scene implements IScene {
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
    await this.loader.load("x-wing.obj", "x-wing");
    await this.loader.load("1377 Car.obj", "car");
    await this.loader.load("Airplane.obj", "airplane");

    let xWing = this.loader.center(this.loader.get("x-wing"));
    xWing = this.loader.move(xWing, [0, 0, -15, 0]);

    let car = this.loader.scale(this.loader.get("car"), 0.01);
    car = this.loader.move(car, [-3, 0, -15, 0]);

    let airplane = this.loader.scale(this.loader.get("airplane"), 0.0025);
    airplane = this.loader.move(airplane, [3, 0, -15, 0]);

    this.loader.set("x-wing", xWing);
    this.loader.set("car", car);
    this.loader.set("airplane", airplane);

    this.scene = [xWing, car, airplane];
  }

  public update(elapsedTime: number) {
    const rotationAmount = elapsedTime / 100;

    const rotX = this.vecMat.matrixRotationX(
      this.vecMat.degToRad(rotationAmount)
    );
    const rotY = this.vecMat.matrixRotationY(
      this.vecMat.degToRad(rotationAmount)
    );
    const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY);

    const xWing = this.loader.transform(
      this.loader.get("x-wing"),
      (v: Vec4) => {
        return this.vecMat.matrixMultiplyVector(combined, v);
      }
    );

    const car = this.loader.transform(this.loader.get("car"), (v: Vec4) => {
      return this.vecMat.matrixMultiplyVector(rotX, v);
    });

    const airplane = this.loader.transform(
      this.loader.get("airplane"),
      (v: Vec4) => {
        return this.vecMat.matrixMultiplyVector(rotY, v);
      }
    );

    this.scene = [xWing, car, airplane];
  }
}
