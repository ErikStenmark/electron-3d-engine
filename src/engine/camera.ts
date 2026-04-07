import { Vec4 } from './types';
import VecMat, { Mat4x4, MovementParams } from './vecmat';

export class Camera {
  pos: Vec4;
  lookDir: Vec4;
  aimDir: Vec4;
  moveDir: Vec4;
  pitch: number;
  yaw: number;
  vUp: Vec4;
  vTarget: Vec4;
  isFlying: boolean;

  private maxYaw = Math.PI * 2;
  private minYaw = -this.maxYaw;
  private maxPitch = Math.PI / 2 - 0.1;
  private minPitch = -this.maxPitch;

  private lookSpeed = 0.002;

  private upSpeedFast = 0.015;
  private upSpeedSlow = 0.005;
  private upSpeed = this.upSpeedSlow;

  private movementSpeedFast = 0.015;
  private movementSpeedSlow = 0.005;
  private movementSpeed = this.movementSpeedFast;

  private mouseSensitivity = 3;

  constructor(private vecMat: VecMat) {
    this.pos = vecMat.vectorCreate([0, 0, 0, 1]);
    this.lookDir = vecMat.vectorCreate([0, 0, 1, 1]);
    this.aimDir = vecMat.vectorCreate([0, 0, 1, 1]);
    this.moveDir = vecMat.vectorCreate([0, 0, 1, 1]);
    this.vUp = vecMat.vectorCreate([0, 1, 0, 1]);
    this.vTarget = vecMat.vectorCreate([0, 0, 1, 1]);
    this.pitch = 0;
    this.yaw = 0;
    this.isFlying = true;
  }

  setPosition(pos: Vec4, lookDir: Vec4, moveDir: Vec4, target: Vec4, pitch: number, yaw: number) {
    this.vTarget = [...target] as Vec4;
    this.pos = [...pos] as Vec4;
    this.lookDir = [...lookDir] as Vec4;
    this.aimDir = [...lookDir] as Vec4;
    this.moveDir = [...moveDir] as Vec4;
    this.pitch = pitch;
    this.yaw = yaw;
  }

  getProjection(aspectRatio: number, near: number, far: number): Mat4x4 {
    return this.vecMat.matrixProjection(90, aspectRatio, near, far);
  }

  update(shouldInvertForward: boolean): { viewMatrix: Mat4x4 } {
    const params: MovementParams = {
      vCamera: this.pos,
      vTarget: this.vTarget,
      vUp: this.vUp,
      pitch: this.pitch,
      yaw: this.yaw,
      shouldInvertForward,
    };

    const { lookDir, cameraView, moveDir, aimDir } = this.isFlying
      ? this.vecMat.movementFly(params)
      : this.vecMat.movementWalk(params);

    this.lookDir = lookDir;
    this.aimDir = aimDir;
    this.moveDir = moveDir;

    return { viewMatrix: cameraView };
  }

  applyMovement(direction: 'forward' | 'back' | 'left' | 'right' | 'up' | 'down', delta: number) {
    switch (direction) {
      case 'up':
        this.pos[1] += this.upSpeed * delta;
        break;
      case 'down':
        this.pos[1] -= this.upSpeed * delta;
        break;
      case 'forward':
        this.pos = this.vecMat.vectorSub(this.pos, this.calculateForwardMovement(delta));
        break;
      case 'back':
        this.pos = this.vecMat.vectorAdd(this.pos, this.calculateForwardMovement(delta));
        break;
      case 'left':
        this.pos = this.vecMat.vectorAdd(this.pos, this.calculateSidewaysMovement(delta));
        break;
      case 'right':
        this.pos = this.vecMat.vectorSub(this.pos, this.calculateSidewaysMovement(delta));
        break;
    }
  }

  applyLook(dyaw: number, dpitch: number) {
    this.yaw += dyaw;
    this.pitch += dpitch;
  }

  applyArrowLook(direction: 'up' | 'down' | 'left' | 'right', delta: number) {
    switch (direction) {
      case 'right':
        this.yaw += this.lookSpeed * delta;
        break;
      case 'left':
        this.yaw -= this.lookSpeed * delta;
        break;
      case 'up':
        this.pitch -= this.lookSpeed * delta;
        break;
      case 'down':
        this.pitch += this.lookSpeed * delta;
        break;
    }
  }

  applyMouseLook(movementX: number, movementY: number, delta: number) {
    if (movementX) {
      this.yaw += (movementX / 10000) * this.mouseSensitivity * delta;
    }
    if (movementY) {
      this.pitch -= (-movementY / 10000) * this.mouseSensitivity * delta;
    }
  }

  setFastSpeed(fast: boolean) {
    if (fast) {
      this.movementSpeed = this.movementSpeedFast;
      this.upSpeed = this.upSpeedFast;
    } else {
      this.movementSpeed = this.movementSpeedSlow;
      this.upSpeed = this.upSpeedSlow;
    }
  }

  clampAngles() {
    if (this.yaw >= this.maxYaw || this.yaw <= this.minYaw) {
      this.yaw = 0;
    }
    if (this.pitch > this.maxPitch) {
      this.pitch = this.maxPitch;
    }
    if (this.pitch < this.minPitch) {
      this.pitch = this.minPitch;
    }
  }

  getViewRay(): { origin: Vec4; direction: Vec4 } {
    const direction: Vec4 = this.vecMat.vectorNegate(this.aimDir);
    return { origin: [this.pos[0], this.pos[1], this.pos[2], 1], direction };
  }

  private calculateForwardMovement(delta: number) {
    return this.vecMat.vectorMul(this.lookDir, this.movementSpeed * delta);
  }

  private calculateSidewaysMovement(delta: number) {
    const vForwardWithoutTilt = this.vecMat.vectorMul(
      this.moveDir,
      this.movementSpeed * delta
    );
    return this.vecMat.vectorCrossProduct(vForwardWithoutTilt, this.vUp);
  }
}
