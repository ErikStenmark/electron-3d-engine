import { Camera } from './camera';
import { Vec4 } from './types';
import VecMat, { Mat4x4 } from './vecmat';
import { Renderer } from './renderers';

export type CameraMode = 'first-person' | 'third-person' | 'free';

export const CAMERA_MODES: readonly CameraMode[] = ['first-person', 'third-person', 'free'] as const;

export type ModeChangeEvent = {
  mode: CameraMode;
  previousMode: CameraMode;
};

export class CameraController {
  private playerCamera: Camera;
  private freeCamera: Camera;
  private vecMat: VecMat;
  private mode: CameraMode = 'first-person';
  private isMouseLookActive = false;

  // Third-person orbit state
  private tpDistance = 5;
  private readonly tpDistanceMin = 1.5;
  private readonly tpDistanceMax = 20;
  private readonly tpHeightOffset = 1;
  private tpYawOffset = 0;
  private tpPitchOffset = 0;
  private readonly tpPitchMin = -Math.PI / 3;
  private readonly tpPitchMax = Math.PI / 3;
  private readonly tpOrbitSensitivity = 0.005;
  private readonly tpZoomSpeed = 0.005;
  private readonly tpResetSpeed = 0.003;

  private playerHeight = 1;
  private freeCameraInitialized = false;

  private onModeChangeCallbacks: ((event: ModeChangeEvent) => void)[] = [];

  constructor(vecMat: VecMat) {
    this.vecMat = vecMat;
    this.playerCamera = new Camera(vecMat);
    this.freeCamera = new Camera(vecMat);
    this.freeCamera.isFlying = true;
  }

  /** The camera currently receiving input (free camera in free mode, player camera otherwise). */
  getActiveCamera(): Camera {
    return this.mode === 'free' ? this.freeCamera : this.playerCamera;
  }

  /** The player camera — always stays with the player regardless of mode. */
  getPlayerCamera(): Camera {
    return this.playerCamera;
  }

  getMode(): CameraMode {
    return this.mode;
  }

  isThirdPerson(): boolean {
    return this.mode === 'third-person';
  }

  isFree(): boolean {
    return this.mode === 'free';
  }

  /** Whether the player model should be rendered (third-person and free). */
  showPlayerModel(): boolean {
    return this.mode !== 'first-person';
  }

  getMouseLookActive(): boolean {
    return this.isMouseLookActive;
  }

  setPlayerHeight(height: number) {
    this.playerHeight = height;
  }

  /** Reset the free camera so it re-initializes from the player on next use. */
  resetFreeCamera() {
    this.freeCameraInitialized = false;
  }

  onModeChange(callback: (event: ModeChangeEvent) => void) {
    this.onModeChangeCallbacks.push(callback);
  }

  setCameraMode(newMode: CameraMode, renderer?: Renderer) {
    if (newMode === this.mode) return;

    const previousMode = this.mode;
    this.mode = newMode;

    if (newMode === 'third-person') {
      this.tpYawOffset = 0;
      this.tpPitchOffset = 0;
    }

    // First time entering free: initialize from player position
    if (newMode === 'free' && !this.freeCameraInitialized) {
      const pc = this.playerCamera;
      this.freeCamera.setPosition(
        [...pc.pos] as Vec4,
        [...pc.lookDir] as Vec4,
        [...pc.moveDir] as Vec4,
        [...pc.vTarget] as Vec4,
        pc.pitch,
        pc.yaw
      );
      this.freeCamera.isFlying = true;
      this.freeCameraInitialized = true;
    }

    // Disable mouse look when leaving first-person
    if (previousMode === 'first-person' && this.isMouseLookActive && renderer) {
      this.setMouseLook(false, renderer);
    }

    for (const cb of this.onModeChangeCallbacks) {
      cb({ mode: newMode, previousMode });
    }
  }

  cycleMode(renderer?: Renderer) {
    const idx = CAMERA_MODES.indexOf(this.mode);
    const next = CAMERA_MODES[(idx + 1) % CAMERA_MODES.length];
    this.setCameraMode(next, renderer);
  }

  setMouseLook(enabled: boolean, renderer: Renderer) {
    if (enabled) {
      this.isMouseLookActive = true;
      renderer.addPointerLockListener();
      renderer.lockPointer();
    } else {
      this.isMouseLookActive = false;
      renderer.exitPointerLock();
      renderer.removePointerLockListener();
    }
  }

  toggleMouseLook(renderer: Renderer) {
    this.setMouseLook(!this.isMouseLookActive, renderer);
  }

  /**
   * Update camera directions and build the view matrix for the current mode.
   */
  updateView(shouldInvertForward: boolean, isGl: boolean): { matView: Mat4x4; matFrustumView: Mat4x4 } {
    // Always update player camera directions (needed for player model facing / TP orbit)
    const playerView = this.playerCamera.update(shouldInvertForward);

    if (this.mode === 'third-person') {
      const tpView = this.buildThirdPersonView(true);
      return { matView: tpView, matFrustumView: tpView };
    }

    // In free mode use the free camera; in first-person reuse the player update
    const viewMatrix = this.mode === 'free'
      ? this.freeCamera.update(shouldInvertForward).viewMatrix
      : playerView.viewMatrix;

    if (isGl) {
      const invView = this.vecMat.matrixQuickInverse(viewMatrix);
      return { matView: invView, matFrustumView: invView };
    }

    // CPU renderer
    const cam = this.getActiveCamera();
    const matView = this.vecMat.matrixInverse(viewMatrix) as Mat4x4;
    const matFrustumView = this.vecMat.matrixQuickInverse(
      this.vecMat.matrixPointAt(
        cam.pos,
        this.vecMat.vectorSub(cam.pos, cam.aimDir),
        cam.vUp,
        true
      )
    );
    return { matView, matFrustumView };
  }

  /**
   * Handle third-person orbit input (right-drag, scroll zoom, spring-back).
   */
  updateOrbitInput(
    mouseMovementX: number,
    mouseMovementY: number,
    scrollDeltaY: number,
    mouseButtonsDown: Set<number>,
    isMoving: boolean,
    delta: number
  ) {
    if (this.mode !== 'third-person') return;

    const isDragging = mouseButtonsDown.has(2);

    if (isDragging && (mouseMovementX || mouseMovementY)) {
      this.tpYawOffset += mouseMovementX * this.tpOrbitSensitivity;
      this.tpPitchOffset -= mouseMovementY * this.tpOrbitSensitivity;
      this.tpPitchOffset = Math.max(this.tpPitchMin, Math.min(this.tpPitchMax, this.tpPitchOffset));
    }

    if (scrollDeltaY) {
      this.tpDistance += scrollDeltaY * this.tpZoomSpeed;
      this.tpDistance = Math.max(this.tpDistanceMin, Math.min(this.tpDistanceMax, this.tpDistance));
    }

    if (isMoving && !isDragging) {
      const lerpFactor = this.tpResetSpeed * delta;
      this.tpYawOffset *= Math.max(0, 1 - lerpFactor);
      this.tpPitchOffset *= Math.max(0, 1 - lerpFactor);
      if (Math.abs(this.tpYawOffset) < 0.001) this.tpYawOffset = 0;
      if (Math.abs(this.tpPitchOffset) < 0.001) this.tpPitchOffset = 0;
    }
  }

  /**
   * Handle mouse look input.
   * First-person: requires pointer lock (isMouseLookActive).
   * Free: right-click drag (no pointer lock needed).
   */
  applyMouseLookInput(movementX: number, movementY: number, delta: number, mouseButtonsDown?: Set<number>) {
    if (this.mode === 'first-person') {
      if (this.isMouseLookActive) {
        this.playerCamera.applyMouseLook(movementX, movementY, delta);
      }
    } else if (this.mode === 'free') {
      // In free mode: right-click drag to look around (boosted sensitivity)
      if (mouseButtonsDown?.has(2)) {
        this.freeCamera.applyMouseLook(movementX * 2, movementY * 2, delta);
      }
    }
  }

  /**
   * Handle grab-tool input in free mode.
   * Left-drag strafes (mouse X → left/right, mouse Y → up/down).
   * Scroll moves forward/backward.
   */
  applyGrabInput(movementX: number, movementY: number, scrollDeltaY: number, mouseButtonsDown: Set<number>) {
    if (this.mode !== 'free') return;

    const strafeSensitivity = 5;
    const scrollSensitivity = 8;

    // Left-drag → strafe (pass scaled pixel amount as "delta" to applyMovement)
    if (mouseButtonsDown.has(0) && (movementX || movementY)) {
      if (movementX) {
        this.freeCamera.applyMovement(movementX > 0 ? 'right' : 'left', Math.abs(movementX) * strafeSensitivity);
      }
      if (movementY) {
        this.freeCamera.applyMovement(movementY > 0 ? 'down' : 'up', Math.abs(movementY) * strafeSensitivity);
      }
    }

    // Scroll → forward/back
    if (scrollDeltaY) {
      this.freeCamera.applyMovement(scrollDeltaY < 0 ? 'forward' : 'back', Math.abs(scrollDeltaY) * scrollSensitivity);
    }
  }

  /** Whether BVH occlusion is safe to use (only in first-person). */
  shouldUseBVH(): boolean {
    return this.mode === 'first-person';
  }

  /** Whether physics and collision should run (not in free mode). */
  shouldRunPhysics(): boolean {
    return this.mode !== 'free';
  }

  private buildThirdPersonView(invertForward: boolean): Mat4x4 {
    const lookTarget: Vec4 = [
      this.playerCamera.pos[0],
      this.playerCamera.pos[1] - this.playerHeight * 0.25,
      this.playerCamera.pos[2],
      1,
    ];

    const baseYaw = Math.atan2(this.playerCamera.lookDir[0], this.playerCamera.lookDir[2]);
    const orbitYaw = baseYaw + this.tpYawOffset;
    const orbitPitch = this.tpPitchOffset;

    const cosP = Math.cos(orbitPitch);
    const eyePos: Vec4 = [
      lookTarget[0] + Math.sin(orbitYaw) * cosP * this.tpDistance,
      lookTarget[1] + (Math.sin(orbitPitch) * this.tpDistance) + this.tpHeightOffset,
      lookTarget[2] + Math.cos(orbitYaw) * cosP * this.tpDistance,
      1,
    ];

    const pointAt = this.vecMat.matrixPointAt(eyePos, lookTarget, this.playerCamera.vUp, invertForward);
    return this.vecMat.matrixQuickInverse(pointAt);
  }
}
