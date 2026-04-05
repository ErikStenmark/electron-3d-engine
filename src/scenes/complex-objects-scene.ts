import { Object3D } from "../obj";
import { IScene, Scene } from "../scene/scene";
import { Mat4x4 } from "../engine/vecmat";

export class ComplexObjectsScene extends Scene implements IScene {
  private keys = {
    xWing: "x-wing",
    car: "car",
    airplane: "airplane",
    sailShip: "sailship",
  };

  private objects: { [key: string]: Object3D } = {};
  private sailshipBaseMatrix!: Mat4x4;

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
    ).move([0, 0, -7, 0]);
    this.objects[keys.car] = (await this.loader.load("1377 Car.obj", keys.car))
      .scale(0.01)
      .move([-3, 0, -7, 0]);
    this.objects[keys.airplane] = (
      await this.loader.load("Airplane.obj", keys.airplane)
    )
      .scale(0.0025)
      .move([3, 0, -7, 0]);
    this.objects[keys.sailShip] = (
      await this.loader.load("sailship.obj", keys.sailShip)
    ).move([0, -5, -7, 0]);

    this.sailshipBaseMatrix = this.objects[keys.sailShip].getModelMatrix();

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

    this.objects[keys.xWing].applyMatrix(combined);
    this.objects[keys.car].applyMatrix(rotX);
    this.objects[keys.airplane].applyMatrix(rotY);

    const waveAmplitude = 10;
    const waveSpeed = 0.0005;
    const wave = Math.sin(elapsedTime * waveSpeed) * waveAmplitude;
    const wave2 = (Math.cos(elapsedTime * waveSpeed * 0.7) * waveAmplitude) / 2;

    const waveX = this.vecMat.matrixRotationXDeg(wave);
    const waveZ = this.vecMat.matrixRotationZDeg(wave2);
    const waveXZ = this.vecMat.matrixMultiplyMatrices(waveX, waveZ);

    this.objects[keys.sailShip].setModelMatrix(
      this.vecMat.matrixMultiplyMatrix(waveXZ, this.sailshipBaseMatrix)
    );
  }
}
