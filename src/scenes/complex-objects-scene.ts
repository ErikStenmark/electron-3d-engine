import { Vec4 } from "../engine/types";
import { Object3D } from "../obj";
import { IScene, Scene } from "../scene/scene";

export class ComplexObjectsScene extends Scene implements IScene {
  private keys = {
    xWing: "x-wing",
    car: "car",
    airplane: "airplane",
    sailShip: "sailship",
  };

  private objects: { [key: string]: Object3D } = {};

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
    const { keys } = this;

    this.objects[keys.xWing] = (
      await this.loader.load("x-wing.obj", keys.xWing)
    ).move([0, 0, -15, 0]);
    this.objects[keys.car] = (await this.loader.load("1377 Car.obj", keys.car))
      .scale(0.01, { recalculateNormals: true })
      .move([-3, 0, -15, 0]);
    this.objects[keys.airplane] = (
      await this.loader.load("Airplane.obj", keys.airplane)
    )
      .scale(0.0025, { recalculateNormals: true })
      .move([3, 0, -15, 0]);
    this.objects[keys.sailShip] = (
      await this.loader.load("sailship.obj", keys.sailShip)
    ).move([0, -5, -15, 0]);

    this.scene = [
      this.objects[keys.xWing].get(),
      this.objects[keys.car].get(),
      this.objects[keys.airplane].get(),
      this.objects[keys.sailShip].get(),
    ];
  }

  public update({
    elapsedTime,
    deltaTime,
  }: {
    elapsedTime: number;
    deltaTime: number;
  }) {
    const { keys } = this;

    const rotationAmount = 0.05 * deltaTime;
    const rotX = this.vecMat.matrixRotationXDeg(rotationAmount);
    const rotY = this.vecMat.matrixRotationYDeg(rotationAmount);
    const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY);

    const xWing = this.objects[keys.xWing].transform((v: Vec4) =>
      this.vecMat.matrixMultiplyVector(combined, v)
    );

    const car = this.objects[keys.car].transform((v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotX, v)
    );

    const airplane = this.objects[keys.airplane].transform((v: Vec4) =>
      this.vecMat.matrixMultiplyVector(rotY, v)
    );

    const waveAmplitude = 10;
    const waveSpeed = 0.0005;
    const wave = Math.sin(elapsedTime * waveSpeed) * waveAmplitude;
    const wave2 = (Math.cos(elapsedTime * waveSpeed * 0.7) * waveAmplitude) / 2;

    const waveX = this.vecMat.matrixRotationXDeg(wave);
    const waveZ = this.vecMat.matrixRotationZDeg(wave2);
    const waveXZ = this.vecMat.matrixMultiplyMatrices(waveX, waveZ);

    const sailship = this.objects[keys.sailShip].transform(
      (v: Vec4) => this.vecMat.matrixMultiplyVector(waveXZ, v),
      { noStore: true }
    );

    this.scene = [
      airplane.get(),
      car.get(),
      xWing.get(),
      sailship.get(),
    ];
  }
}
