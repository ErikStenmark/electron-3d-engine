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
    const xWing = this.loader.place(this.loader.get("x-wing"), [1, 0.5, -15, 0]);
    this.loader.set("x-wing", xWing);

    this.scene = [xWing];
  }

  public update(elapsedTime: number) {
    const rotX = this.vecMat.matrixRotationX(
      this.vecMat.degToRad(elapsedTime / 100)
    );
    const rotY = this.vecMat.matrixRotationY(
      this.vecMat.degToRad(elapsedTime / 100)
    );
    const combined = this.vecMat.matrixMultiplyMatrices(rotX, rotY);

    const xWing = this.loader.transform(
      this.loader.get("x-wing"),
      (v: Vec4) => {
        return this.vecMat.matrixMultiplyVector(combined, v);
      }
    );

    this.scene = [xWing];
  }
}
