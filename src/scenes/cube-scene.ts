import { IScene, Scene } from '../scene/scene';

export class CubeScene extends Scene implements IScene {

  constructor() {
    super();

    this.setStartPosition({
      camera: [0.5, 0.5, 5],
    });
  }

  public async load() {
    await this.loader.load('cube.obj', 'cube');
    this.loader.set('cube', this.loader.place(this.loader.get('cube'), [0, 0, 10]));

    const cube1 = this.loader.place(this.loader.get('cube'), [10, 0, 0]);
    const cube2 = this.loader.place(this.loader.get('cube'), [-10, 0, 0]);

    this.scene = this.loader.combine([cube1, cube2]);

    // this.scene = [
    //   // SOUTH
    //   [[0, 0, 0, 1], [0, 1, 0, 1], [1, 1, 0, 1]],
    //   [[0, 0, 0, 1], [1, 1, 0, 1], [1, 0, 0, 1]],

    //   // EAST
    //   [[1, 0, 0, 1], [1, 1, 0, 1], [1, 1, 1, 1]],
    //   [[1, 0, 0, 1], [1, 1, 1, 1], [1, 0, 1, 1]],

    //   //NORTH
    //   [[1, 0, 1, 1], [1, 1, 1, 1], [0, 1, 1, 1]],
    //   [[1, 0, 1, 1], [0, 1, 1, 1], [0, 0, 1, 1]],

    //   // WEST
    //   [[0, 0, 1, 1], [0, 1, 1, 1], [0, 1, 0, 1]],
    //   [[0, 0, 1, 1], [0, 1, 0, 1], [0, 0, 0, 1]],

    //   // TOP
    //   [[0, 1, 0, 1], [0, 1, 1, 1], [1, 1, 1, 1]],
    //   [[0, 1, 0, 1], [1, 1, 1, 1], [1, 1, 0, 1]],

    //   // BOTTOM
    //   [[1, 0, 1, 1], [0, 0, 1, 1], [0, 0, 0, 1]],
    //   [[1, 0, 1, 1], [0, 0, 0, 1], [1, 0, 0, 1]],
    // ]
  }

  public update() {

  }

}