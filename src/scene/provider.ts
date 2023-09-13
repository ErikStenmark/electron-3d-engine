import { ObjLoader, Scene } from './scene';

type SceneMap = { [key: string]: Scene };

export class SceneProvider {
  private map: SceneMap;
  private current: string;

  constructor(map: SceneMap) {
    this.map = map;
    this.current = Object.keys(map).at(0) || '';
  }

  public async getCurrent() {
    if (!Object.keys(this.map).includes(this.current) || this.current === '') {
      throw new Error('no current scene');
    }

    const scene = this.map[this.current];
    await scene.load();

    return scene;
  }

  public async getNext() {
    const index = Object.keys(this.map).indexOf(this.current);
    const length = Object.keys(this.map).length;

    if (!Object.keys(this.map).length) {
      throw new Error('no scenes in map');
    }

    this.current = Object.keys(this.map).at(index + 1 === length ? 0 : index + 1) as string;
    return await this.getCurrent();
  }

  public get(key: string) {
    if (!Object.keys(this.map).includes(key)) {
      throw new Error(`scene '${key}' not found`);
    }

    this.current = key;
    return this.getCurrent();
  }

  public getKeys() {
    return Object.keys(this.map);
  }

  public getCurrentKey() {
    return this.current;
  }

  public async setObjLoader(loader: ObjLoader) {

    await Promise.all(Object.values(this.map).map(scene => new Promise(res => scene.setLoader(loader).then(res))));

    return this.getCurrent();
  }

}