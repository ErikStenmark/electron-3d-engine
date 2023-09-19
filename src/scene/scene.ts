import { AnyVec, Obj, Vec4 } from '../engine/types';
import { ObjectStore } from '../obj-store-obj';
import VecMat from '../engine/vecmat';

export interface IScene {
  get(): Obj | Obj[];
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

export abstract class Scene implements IScene {
  protected loader = new ObjectStore();

  protected vecMat: VecMat;
  protected scene!: Obj | Obj[];
  protected startPosition: StartPosition;

  constructor() {
    this.vecMat = new VecMat();

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
    return this.scene;
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
}