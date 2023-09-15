import { AnyVec, Mesh, Obj, Vec4 } from '../engine/types';
import VecMat from '../engine/vecmat';
import { IObjectStore, ObjStoreType } from '../obj-store';
import { ObjectStoreMesh } from '../obj-store-mesh';
import { ObjectStoreObj } from '../obj-store-obj';

export interface IScene<T = Obj | Mesh> {
  get(): T
  load(): void;
  update(elapsedTime: number): void;
}

type StartPosition = {
  camera: Vec4;
  lookDir: Vec4;
  moveDir: Vec4;
  target: Vec4;
  xaw: number;
  yaw: number;
}

type StartPositionSetter = Partial<{
  camera: AnyVec;
  lookDir: AnyVec;
  moveDir: AnyVec;
  target: AnyVec;
  xaw: number;
  yaw: number;
}>;



export type ObjLoader = 'obj' | 'mesh';
export type ObjLoaders = { [key in ObjLoader]: IObjectStore };

export type SceneConstructorArgs = { loader: ObjLoader };

export abstract class Scene<T = Obj | Mesh> implements IScene<T> {

  private loaders: ObjLoaders = {
    obj: new ObjectStoreObj(),
    mesh: new ObjectStoreMesh()
  }

  protected loader: IObjectStore;

  protected vecMat: VecMat;
  protected scene!: ObjStoreType;
  protected startPosition: StartPosition;

  constructor(opts: SceneConstructorArgs = { loader: 'obj' }) {
    this.vecMat = new VecMat();

    this.loader = this.loaders[opts.loader];

    this.startPosition = {
      camera: this.vecMat.vectorCreate([0, 1, 0]),
      lookDir: this.vecMat.vectorCreate([0, 0, 1, 1]),
      moveDir: this.vecMat.vectorCreate([0, 0, 1, 1]),
      target: this.vecMat.vectorCreate([0, 0, 1, 1]),
      xaw: 0,
      yaw: 0
    }
  }

  public get() {
    return this.scene as T;
  }

  public getStartPosition() {
    return this.startPosition;
  }

  protected setStartPosition(pos: StartPositionSetter) {
    const { camera, lookDir, moveDir, target, xaw, yaw } = pos;

    if (camera) {
      this.startPosition.camera = this.vecMat.vectorCreate(camera);
    }

    if (lookDir) {
      this.startPosition.lookDir = this.vecMat.vectorCreate(lookDir);
    }

    if (moveDir) {
      this.startPosition.moveDir = this.vecMat.vectorCreate(moveDir);
    }

    if (target) {
      this.startPosition.target = this.vecMat.vectorCreate(target);
    }

    if (yaw) {
      this.startPosition.yaw = yaw;
    }

    if (xaw) {
      this.startPosition.xaw = xaw;
    }
  }

  public abstract load(): Promise<void>;
  public abstract update(elapsedTime: number): void;

  public async setLoader(loader: ObjLoader) {
    this.loader = this.loaders[loader];
    await this.load();
  }
}