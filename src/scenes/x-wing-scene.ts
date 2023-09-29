import { IScene, Scene } from '../scene/scene';

export class XWingScene extends Scene implements IScene {

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
    await this.loader.load('x-wing.obj', 'x-wing');
    const xWing = this.loader.place(this.loader.get('x-wing'), [0, 0, -20, 0]);

    this.scene = [xWing];
  }

  public update(elapsedTime: number) {

  }
}