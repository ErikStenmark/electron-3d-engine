import { AnyVec, Obj, Vec4 } from '../engine/types';
import { ObjectStore } from '../obj-store';
import { Object3D } from '../obj';
import VecMat from '../engine/vecmat';
import { Light } from '../engine/renderers';
import { Physics } from '../engine/physics';

export type PlayerModel = {
  object: Object3D;
  height: number;
  scale: number;
};

export interface IScene {
  get(): Obj | Obj[];
  load(): void;
  update(args: { elapsedTime: number, deltaTime: number }): void;
}

type StartPosition = {
  camera: Vec4;
  lookDir: Vec4;
  moveDir: Vec4;
  target: Vec4;
  pitch: number;
  yaw: number;
}

type StartPositionSetter = Partial<{
  camera: AnyVec;
  lookDir: AnyVec;
  moveDir: AnyVec;
  target: AnyVec;
  pitch: number;
  yaw: number;
}>;

export abstract class Scene implements IScene {
  protected loader = new ObjectStore();

  protected vecMat: VecMat;
  protected scene!: Obj | Obj[];
  protected startPosition: StartPosition;

  protected flying: boolean = true;
  protected physics: Physics | null = null;
  protected playerModel: PlayerModel | null = null;
  protected terrainHeightmap: { data: Float32Array; resolution: number } | null = null;
  protected skyboxImage: string | null = null;

  protected light: Light = {
    direction: [0, 1, -1, 1],
    color: [1, 1, 1, 1],
    ambient: [0, 0, 0, 0]
  }

  constructor() {
    this.vecMat = new VecMat();

    this.startPosition = {
      camera: this.vecMat.vectorCreate([0, 1, 0]),
      lookDir: this.vecMat.vectorCreate([0, 0, 1, 1]),
      moveDir: this.vecMat.vectorCreate([0, 0, 1, 1]),
      target: this.vecMat.vectorCreate([0, 0, 1, 1]),
      pitch: 0,
      yaw: 0
    }
  }

  public get() {
    return this.scene;
  }

  public getStartPosition() {
    return this.startPosition;
  }

  public getLight() {
    return this.light;
  }

  public getFlying() {
    return this.flying;
  }

  public getPhysics() {
    return this.physics;
  }

  public getPlayerModel(): PlayerModel | null {
    return this.playerModel;
  }

  public getTerrainHeightmap() {
    return this.terrainHeightmap;
  }

  public getSkyboxImage() {
    return this.skyboxImage;
  }

  protected async setPlayerModel(fileName: string, key: string, scale = 1) {
    const obj = await this.loader.load(fileName, key);
    const dimensions = obj.get().dimensions;
    const height = (dimensions.maxY - dimensions.minY) * scale;
    this.playerModel = { object: obj, height, scale };
  }

  protected setLight(light: Partial<Light>) {
    if (light.direction) {
      this.light.direction = light.direction;
    }

    if (light.color) {
      this.light.color = light.color;
    }

    if (light.ambient) {
      this.light.ambient = light.ambient;
    }
  }

  protected setStartPosition(pos: StartPositionSetter) {
    const { camera, lookDir, moveDir, target, pitch, yaw } = pos;

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

    if (pitch) {
      this.startPosition.pitch = pitch;
    }
  }

  public abstract load(): Promise<void>;
  public abstract update(args: { elapsedTime: number, deltaTime: number }): void;
}
