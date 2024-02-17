import { IScene, Scene } from '../scene/scene';

export class CubeScene extends Scene implements IScene {

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
    await this.loader.load('cube.obj', 'cube');
    const cube = this.loader.move(this.loader.get('cube'), [0, 0, -20, 0]);

    this.scene = [cube];
  }

  public update(elapsedTime: number) {

  }
}

// [
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