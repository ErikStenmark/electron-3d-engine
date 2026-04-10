import { Engine, renderModes } from './engine';
import { Obj, Vec4 } from './types';
import VecMat, { Mat4x4 } from './vecmat';
import { isGlRenderer } from './renderers';
import { CameraController, CameraMode } from './camera-controller';
import { Camera } from './camera';
import { RenderPipeline } from './render-pipeline';
import { CollisionSystem } from './collision';
import { buildBVH } from './bvh';
import { PlayerModel, Scene } from '../scene/scene';

export type GameOpts = Partial<{
  near: number;
  far: number;
}>;

const EDIT_HOVER_COLOR: Vec4 = [0.0, 0.9, 1.0, 1.0];
const EDIT_SELECT_COLOR: Vec4 = [1.0, 0.5, 0.0, 1.0];

export abstract class Game extends Engine {
  protected vecMat: VecMat;
  protected cameraCtrl: CameraController;
  protected pipeline: RenderPipeline;
  protected collision: CollisionSystem;
  protected scene!: Scene;

  private near: number;
  private far: number;
  private matProj!: Mat4x4;
  private matView: Mat4x4;
  private matFrustumView: Mat4x4;
  private playerModel: PlayerModel | null = null;

  // Edit mode
  private _editMode = false;
  private editSelectedId: string | null = null;
  private modeBeforeEdit: CameraMode = 'first-person';
  private editTool: 'select' | 'grab' = 'select';
  private editToolbar: HTMLDivElement | null = null;

  /** Camera currently receiving input. */
  protected get camera(): Camera { return this.cameraCtrl.getActiveCamera(); }
  /** Player camera — always at player position. */
  protected get playerCamera(): Camera { return this.cameraCtrl.getPlayerCamera(); }
  /** Whether edit mode is active. */
  protected get editMode(): boolean { return this._editMode; }

  constructor(gameOpts?: GameOpts) {
    super({ console: { enabled: true }, renderer: 'gl' });

    this.near = gameOpts?.near ?? 0.1;
    this.far = gameOpts?.far ?? 1000;

    this.vecMat = new VecMat();
    this.cameraCtrl = new CameraController(this.vecMat);
    this.pipeline = new RenderPipeline(this.vecMat);
    this.collision = new CollisionSystem(this.vecMat);

    this.matView = this.vecMat.matrixCreate();
    this.matFrustumView = this.vecMat.matrixCreate();
    this.matProj = this.camera.getProjection(this.aspectRatio, this.near, this.far);

    window.addEventListener('resize', () => {
      this.matProj = this.camera.getProjection(this.aspectRatio, this.near, this.far);
      if (isGlRenderer(this.renderer)) {
        this.renderer.setProjectionMatrix(this.matProj);
      }
    });

    this.pipeline.setGlMatrices(this.renderer, this.matView, this.matProj);
    this.registerConsoleHUD();
  }

  // --- Subclass hooks ---

  protected abstract onGameLoad(): Promise<void>;
  protected abstract onGameUpdate(): void;

  // --- Edit mode ---

  protected setEditMode(enabled: boolean) {
    if (enabled === this._editMode) return;
    this._editMode = enabled;

    if (enabled) {
      this.modeBeforeEdit = this.cameraCtrl.getMode();
      this.cameraCtrl.setCameraMode('free', this.renderer);
      // Release pointer lock and remove the click-to-lock listener
      if (this.cameraCtrl.getMouseLookActive()) {
        this.cameraCtrl.setMouseLook(false, this.renderer);
      }
      this.renderer.exitPointerLock();
      this.renderer.removePointerLockListener();
      this.buildEditToolbar();
      this.showMenu();
    } else {
      this.editSelectedId = null;
      this.editToolbar = null;
      this.menuClear();
      this.hideMenu();
      this.renderer.addPointerLockListener();
      this.cameraCtrl.setCameraMode(this.modeBeforeEdit, this.renderer);
    }
  }

  protected toggleEditMode() {
    this.setEditMode(!this._editMode);
  }

  // --- Engine hooks (sealed) ---

  protected async onLoad(): Promise<void> {
    await this.onGameLoad();
  }

  protected onUpdate(): void {
    this.renderer.fill();
    if (isGlRenderer(this.renderer)) {
      this.renderer.drawSkybox();
    }

    this.scene.update({ elapsedTime: this.elapsedTime, deltaTime: this.delta });
    this.handleCameraInput();
    this.onGameUpdate();
    this.updateView();

    if (isGlRenderer(this.renderer)) {
      this.renderer.setLight(this.scene.getLight());
    }

    const sceneData = this.scene.get();
    const objects = Array.isArray(sceneData) ? sceneData : [sceneData];
    const bvh = buildBVH(objects, this.vecMat);

    // In edit mode, ray-cast from mouse cursor; otherwise from player camera center
    if (this._editMode) {
      const ray = this.screenToWorldRay(this.mouseX, this.mouseY);
      if (ray) {
        this.collision.updatePointingAtFromRay(objects, ray.origin, ray.direction);
      }
      this.handleEditSelection();
    } else {
      this.collision.updatePointingAt(objects, this.playerCamera);
    }
    this.collision.updateCollisions(objects, this.playerCamera, bvh);

    if (this.cameraCtrl.showPlayerModel() && this.playerModel) {
      this.updatePlayerModelMatrix();
    }

    const renderObjects: Obj[] = this.cameraCtrl.showPlayerModel() && this.playerModel
      ? [...objects, this.playerModel.object.get()]
      : objects;

    this.pipeline.render(
      renderObjects,
      this.camera,
      this.renderer,
      this.renderMode as 'gl' | 'wgpu' | 'cpu',
      this.matView,
      this.matProj,
      this.matFrustumView,
      this.scene.getLight(),
      this.screenWidth,
      this.screenHeight,
      this.screenXCenter,
      this.screenYCenter,
      this.cameraCtrl.shouldUseBVH() ? bvh : undefined,
    );

    // Edit mode: apply edge glow after scene render
    if (this._editMode && isGlRenderer(this.renderer)) {
      this.applyEditGlow(renderObjects);
    }
  }

  // --- Scene management ---

  protected loadScene(scene: Scene) {
    this.scene = scene;
    this.resetPosition();
  }

  protected resetPosition() {
    const { camera, lookDir, moveDir, target, pitch, yaw } = this.scene.getStartPosition();
    this.playerCamera.setPosition(camera, lookDir, moveDir, target, pitch, yaw);
    this.playerCamera.isFlying = this.scene.getFlying();

    this.playerModel = this.scene.getPlayerModel();
    this.cameraCtrl.resetFreeCamera();
    this.cameraCtrl.setCameraMode('first-person', this.renderer);

    if (this.playerModel) {
      this.cameraCtrl.setPlayerHeight(this.playerModel.height);
    }

    if (isGlRenderer(this.renderer)) {
      const skybox = this.scene.getSkyboxImage();
      if (skybox) {
        this.renderer.setSkyboxTexture(skybox);
      } else {
        this.renderer.clearSkyboxTexture();
      }
    }

    const physics = this.scene.getPhysics();
    if (physics) physics.reset();

    const sceneData = this.scene.get();
    const objects = Array.isArray(sceneData) ? sceneData : [sceneData];

    this.collision.savePrevCameraPos(this.playerCamera);
    this.collision.snapToGround(objects, this.playerCamera);
    if (physics) physics.land();
  }

  // --- Camera input (standard WASD/look/physics) ---

  private handleCameraInput() {
    const physics = this.scene.getPhysics();
    const runPhysics = this.cameraCtrl.shouldRunPhysics();
    const cam = this.camera;

    if (this.isKeyPressed('e')) cam.applyMovement('up', this.delta);

    if (this.isKeyPressed(' ')) {
      if (runPhysics && physics) physics.jump();
      else cam.applyMovement('down', this.delta);
    }

    if (runPhysics && physics) this.playerCamera.pos[1] += physics.update(this.delta);

    if (this.isKeyPressed('a')) cam.applyMovement('left', this.delta);
    if (this.isKeyPressed('d')) cam.applyMovement('right', this.delta);
    if (this.isKeyPressed('w')) cam.applyMovement('forward', this.delta);
    if (this.isKeyPressed('s')) cam.applyMovement('back', this.delta);

    if (this.isKeyPressed('ArrowRight')) cam.applyArrowLook('right', this.delta);
    if (this.isKeyPressed('ArrowLeft')) cam.applyArrowLook('left', this.delta);
    if (this.isKeyPressed('ArrowUp')) cam.applyArrowLook('up', this.delta);
    if (this.isKeyPressed('ArrowDown')) cam.applyArrowLook('down', this.delta);

    cam.setFastSpeed(this.isKeyPressed('Shift'));

    // Right-click look always works
    this.cameraCtrl.applyMouseLookInput(this.mouseMovementX, this.mouseMovementY, this.delta, this.mouseButtonsDown);

    // Grab tool: left-drag strafes, scroll moves forward/back
    if (this._editMode && this.editTool === 'grab') {
      this.cameraCtrl.applyGrabInput(this.mouseMovementX, this.mouseMovementY, this.scrollDeltaY, this.mouseButtonsDown);
    }

    this.handleToggle('t', () => { cam.isFlying = !cam.isFlying; });
    this.handleToggle('m', () => { this.cameraCtrl.toggleMouseLook(this.renderer); });
    this.handleToggle('v', () => {
      if (!this._editMode) this.cameraCtrl.cycleMode(this.renderer);
    });
    this.handleToggle('f2', () => { this.toggleEditMode(); });

    this.handleToggle('p', () => {
      const currentIndex = renderModes.findIndex((val) => val === this.renderMode);
      const mode = currentIndex < renderModes.length - 1 ? renderModes[currentIndex + 1] : renderModes[0];
      this.setRenderMode(mode);
      this.pipeline.setGlMatrices(this.renderer, this.matView, this.matProj);
    });

    const isMoving = this.isKeyPressed('w') || this.isKeyPressed('a') ||
      this.isKeyPressed('s') || this.isKeyPressed('d');
    this.cameraCtrl.updateOrbitInput(
      this.mouseMovementX, this.mouseMovementY, this.scrollDeltaY,
      this.mouseButtonsDown, isMoving, this.delta
    );

    // Collision enforcement (skip in free mode)
    if (runPhysics) {
      const sceneData = this.scene.get();
      const objects = Array.isArray(sceneData) ? sceneData : [sceneData];
      this.collision.enforceSolidCollisions(objects, this.playerCamera, physics);
      this.collision.enforceGroundCollision(objects, this.playerCamera, physics);
      this.collision.enforceMeshCollisions(objects, this.playerCamera);
    }

    cam.clampAngles();
    this.resetMouseMovement();
  }

  // --- View matrix ---

  private updateView() {
    const shouldInvertForward = this.renderMode !== 'cpu';
    const { matView, matFrustumView } = this.cameraCtrl.updateView(shouldInvertForward, isGlRenderer(this.renderer));

    if (isGlRenderer(this.renderer)) {
      this.renderer.setViewMatrix(matView);
    }

    this.matView = matView;
    this.matFrustumView = matFrustumView;
  }

  // --- Player model ---

  private updatePlayerModelMatrix() {
    if (!this.playerModel) return;
    const { scale, height } = this.playerModel;
    const pc = this.playerCamera;
    const scaleMat = scale !== 1 ? this.vecMat.matrixScale(scale) : null;
    const rot = this.vecMat.matrixRotationY(pc.yaw);
    const trans = this.vecMat.matrixTranslation(pc.pos[0], pc.pos[1] - height / 2, pc.pos[2]);
    this.playerModel.object.setModelMatrix(
      scaleMat
        ? this.vecMat.matrixMultiplyMatrices(scaleMat, rot, trans)
        : this.vecMat.matrixMultiplyMatrices(rot, trans)
    );
  }

  // --- Edit mode toolbar ---

  private buildEditToolbar() {
    this.menuClear();

    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      position: absolute; top: 50%; left: 12px; transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 6px;
    `;

    const makeButton = (label: string, tool: 'select' | 'grab') => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.dataset.tool = tool;
      btn.style.cssText = `
        width: 64px; height: 40px; border: 1px solid #555; border-radius: 4px;
        background: ${this.editTool === tool ? '#3a3a3a' : '#1a1a1a'};
        color: ${this.editTool === tool ? '#fff' : '#888'};
        font-size: 12px; cursor: pointer; font-family: monospace;
      `;
      btn.onmouseenter = () => { if (this.editTool !== tool) btn.style.background = '#2a2a2a'; };
      btn.onmouseleave = () => { btn.style.background = this.editTool === tool ? '#3a3a3a' : '#1a1a1a'; };
      btn.onclick = () => { this.setEditTool(tool); };
      return btn;
    };

    toolbar.appendChild(makeButton('Select', 'select'));
    toolbar.appendChild(makeButton('Grab', 'grab'));

    this.editToolbar = toolbar;
    this.menuAdd(toolbar);
  }

  private setEditTool(tool: 'select' | 'grab') {
    this.editTool = tool;
    // Re-render toolbar to update active state
    if (this._editMode) {
      this.buildEditToolbar();
    }
  }

  // --- Edit mode helpers ---

  private screenToWorldRay(screenX: number, screenY: number): { origin: Vec4; direction: Vec4 } | null {
    if (screenX < 0 || screenY < 0) return null;

    // Screen → NDC [-1, 1]
    const ndcX = (screenX / this.screenWidth) * 2 - 1;
    const ndcY = 1 - (screenY / this.screenHeight) * 2; // flip Y

    // Unproject near and far points through inverse(view * proj)
    // matrixInverse mutates its input, so pass copies
    const invProj = this.vecMat.matrixInverse([...this.matProj] as Mat4x4);
    const invView = this.vecMat.matrixInverse([...this.matView] as Mat4x4);
    if (!invProj || !invView) return null;

    const invVP = this.vecMat.matrixMultiplyMatrix(invProj, invView);

    const nearPoint = this.vecMat.matrixMultiplyVector(invVP, [ndcX, ndcY, -1, 1]);
    const farPoint = this.vecMat.matrixMultiplyVector(invVP, [ndcX, ndcY, 1, 1]);

    // Perspective divide
    const near: Vec4 = [nearPoint[0] / nearPoint[3], nearPoint[1] / nearPoint[3], nearPoint[2] / nearPoint[3], 1];
    const far: Vec4 = [farPoint[0] / farPoint[3], farPoint[1] / farPoint[3], farPoint[2] / farPoint[3], 1];

    const dir = this.vecMat.vectorSub(far, near);
    const len = this.vecMat.vectorLength(dir);
    const direction: Vec4 = [dir[0] / len, dir[1] / len, dir[2] / len, 0];
    return { origin: near, direction };
  }

  private handleEditSelection() {
    if (this.mouseButtonsDown.has(0)) {
      const id = this.collision.pointingAtId || null;
      this.editSelectedId = id;
    }
  }

  private applyEditGlow(objects: Obj[]) {
    if (!isGlRenderer(this.renderer)) return;

    const hoveredId = this.collision.pointingAtId || null;

    // Hover glow (skip if same as selected)
    if (hoveredId && hoveredId !== this.editSelectedId) {
      const hovered = objects.filter(o => o.id === hoveredId);
      this.renderer.applyEdgeGlow(hovered, EDIT_HOVER_COLOR);
    }

    // Selection glow
    if (this.editSelectedId) {
      const selected = objects.filter(o => o.id === this.editSelectedId);
      this.renderer.applyEdgeGlow(selected, EDIT_SELECT_COLOR);
    }
  }

  // --- Console HUD ---

  private registerConsoleHUD() {
    this.addConsoleCustomMethod(() => {
      const [cx, cy, cz] = this.camera.pos.map((v) => Math.round(v * 10) / 10);
      this.consoleRenderer?.drawText(`camera: x: ${cx} y: ${cy} z: ${cz}`, 20, 40, { color: this.consoleColor });

      const [lx, ly, lz] = this.camera.lookDir.map((v) => Math.round(v * 10) / 10);
      this.consoleRenderer?.drawText(`look: x: ${lx} y: ${ly} z: ${lz}`, 20, 60, { color: this.consoleColor });

      this.consoleRenderer?.drawText(`pointing at: ${this.collision.pointingAt || 'nothing'}`, 20, 80, { color: this.consoleColor });

      if (this.collision.pointingAt) {
        this.consoleRenderer?.drawText(`  group: ${this.collision.pointingAtGroup}`, 20, 95, { color: this.consoleColor });
        this.consoleRenderer?.drawText(`  material: ${this.collision.pointingAtMaterial}`, 20, 110, { color: this.consoleColor });
      }

      let y = 130;
      const colliding = this.collision.cameraCollidingWith;
      this.consoleRenderer?.drawText(`camera colliding: ${colliding.length ? colliding.join(', ') : 'none'}`, 20, y, {
        color: colliding.length ? 'red' : this.consoleColor,
      });

      const physics = this.scene?.getPhysics();
      if (physics) {
        y += 15;
        const grounded = physics.isGrounded();
        const vy = Math.round(physics.getVelocityY() * 10000) / 10000;
        this.consoleRenderer?.drawText(`physics: ${grounded ? 'grounded' : 'airborne'} vy: ${vy}`, 20, y, {
          color: grounded ? this.consoleColor : 'orange',
        });
      }

      if (this.collision.objectCollisions.length) {
        y += 15;
        this.consoleRenderer?.drawText(`object collisions:`, 20, y, { color: 'red' });
        for (const coll of this.collision.objectCollisions) {
          y += 15;
          this.consoleRenderer?.drawText(`  ${coll}`, 20, y, { color: 'red' });
        }
      }

      y += 15;
      const { culledCount, totalCount } = this.pipeline;
      this.consoleRenderer?.drawText(`frustum: ${totalCount - culledCount}/${totalCount} visible (${culledCount} culled)`, 20, y, {
        color: culledCount > 0 ? 'cyan' : this.consoleColor,
      });

      y += 15;
      const mode = this.cameraCtrl.getMode();
      this.consoleRenderer?.drawText(`view: ${mode} [V]`, 20, y, {
        color: mode !== 'first-person' ? 'yellow' : this.consoleColor,
      });

      if (this._editMode) {
        y += 15;
        this.consoleRenderer?.drawText(`EDIT MODE [F2]`, 20, y, { color: 'orange' });
        if (this.editSelectedId) {
          y += 15;
          this.consoleRenderer?.drawText(`selected: ${this.editSelectedId}`, 20, y, { color: 'orange' });
        }
      }
    });
  }
}
