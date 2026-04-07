import { Physics } from "../engine/physics";
import { Object3D } from "../obj";
import { IScene, Scene } from "../scene/scene";

export class WalkingScene extends Scene implements IScene {
  private objects: { [key: string]: Object3D } = {};

  constructor() {
    super();

    this.flying = false;
    this.physics = new Physics();

    this.setStartPosition({
      camera: [0, 1.5, 0],
    });

    this.setLight({
      direction: [0.5, 1, 0.5, 1],
      color: [1, 0.95, 0.9, 1],
      ambient: [0.6, 0.7, 0.9, 0.4],
    });
  }

  public async load() {
    this.objects["floor-border"] = Object3D.createPlane("floor-border", 101, this.vecMat)
      .setName("Floor Border")
      .move([0, -0.01, 0, 0]);
    this.objects["floor-border"].get().color = [0.8, 0.1, 0.1, 1];

    this.objects["floor"] = Object3D.createPlane("floor", 100, this.vecMat)
      .setName("Floor")
      .setSolid(true);

    this.objects["crate1"] = (
      await this.loader.load("cube-tx-n.obj", "cube")
    ).setName("Crate").setSolid(true).move([0, 1.01, -5, 0]);
    const texture = await this.loader.loadTexture("crate.png", "crate");
    if (texture) {
      this.objects["crate1"].setTexture(texture);
    }

    this.objects["crate2"] = this.objects["crate1"].clone("crate2")
      .setName("Crate 2")
      .move([3, 0, 0, 0]);

    this.objects["crate3"] = this.objects["crate1"].clone("crate3")
      .setName("Crate 3")
      .move([-3, 0, 0, 0]);

    this.objects["xwing"] = (
      await this.loader.load("x-wing.obj", "xwing-walk")
    ).setName("X-Wing").move([0, 2, -15, 0]);

    this.objects["teapot"] = (
      await this.loader.load("teaPot.obj", "teapot")
    ).setName("Teapot").setSolid(true).move([6, 1.6, -8, 0]);

    this.scene = Object.values(this.objects).map((o) => o.get());
  }

  public update({
    elapsedTime,
    deltaTime,
  }: {
    elapsedTime: number;
    deltaTime: number;
  }) {
    const rotY = this.vecMat.matrixRotationYDeg(0.02 * deltaTime);
    this.objects["xwing"].applyMatrix(rotY);
  }
}
