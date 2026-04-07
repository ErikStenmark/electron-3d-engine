import { Engine, renderModes } from "./engine/engine";
import { Obj, Vec4 } from "./engine/types";
import VecMat, { Mat4x4 } from "./engine/vecmat";
import { Scene, SceneProvider } from "./scene";
import { ComplexObjectsScene } from "./scenes/complex-objects-scene";
import { LotsOfBoxes } from "./scenes/lots-of-boxes";
import { GiganticAmountOfBoxes } from "./scenes/gigantic-amount-of-boxes";
import { WalkingScene } from "./scenes/walking-scene";
import { isGlRenderer } from "./engine/renderers";
import { Camera } from "./engine/camera";
import { RenderPipeline } from "./engine/render-pipeline";
import { CollisionSystem } from "./engine/collision";
import { buildBVH } from "./engine/bvh";

export default class Game extends Engine {
  private vecMat: VecMat;
  private camera: Camera;
  private pipeline: RenderPipeline;
  private collision: CollisionSystem;
  private scene!: Scene;
  private sceneProvider: SceneProvider;

  private near = 0.1;
  private far = 1000;

  private matProj!: Mat4x4;
  private matView: Mat4x4;
  private matFrustumView: Mat4x4;

  private isMouseLookActive = false;

  constructor() {
    super({ console: { enabled: true }, renderer: "gl" });

    this.vecMat = new VecMat();
    this.camera = new Camera(this.vecMat);
    this.pipeline = new RenderPipeline(this.vecMat);
    this.collision = new CollisionSystem(this.vecMat);

    this.sceneProvider = new SceneProvider({
      complexObjects: new ComplexObjectsScene(),
      boxes: new LotsOfBoxes(),
      giganticBoxes: new GiganticAmountOfBoxes(),
      walking: new WalkingScene(),
    });

    this.matView = this.vecMat.matrixCreate();
    this.matFrustumView = this.vecMat.matrixCreate();
    this.matProj = this.camera.getProjection(this.aspectRatio, this.near, this.far);

    window.addEventListener("resize", () => {
      this.matProj = this.camera.getProjection(this.aspectRatio, this.near, this.far);
      if (isGlRenderer(this.renderer)) {
        this.renderer.setProjectionMatrix(this.matProj);
      }
    });

    this.pipeline.setGlMatrices(this.renderer, this.matView, this.matProj);

    this.addConsoleCustomMethod(() => {
      const [cx, cy, cz] = this.camera.pos.map(
        (val) => Math.round(val * 10) / 10
      );
      const cameraText = `camera: x: ${cx} y: ${cy} z: ${cz}`;
      this.consoleRenderer?.drawText(cameraText, 20, 40, {
        color: this.consoleColor,
      });

      const [lx, ly, lz] = this.camera.lookDir.map((val) => Math.round(val * 10) / 10);
      const lookText = `look: x: ${lx} y: ${ly} z: ${lz}`;
      this.consoleRenderer?.drawText(lookText, 20, 60, {
        color: this.consoleColor,
      });

      const pointingText = `pointing at: ${this.collision.pointingAt || "nothing"}`;
      this.consoleRenderer?.drawText(pointingText, 20, 80, {
        color: this.consoleColor,
      });

      if (this.collision.pointingAt) {
        const groupText = `  group: ${this.collision.pointingAtGroup}`;
        this.consoleRenderer?.drawText(groupText, 20, 95, {
          color: this.consoleColor,
        });
        const materialText = `  material: ${this.collision.pointingAtMaterial}`;
        this.consoleRenderer?.drawText(materialText, 20, 110, {
          color: this.consoleColor,
        });
      }

      let collisionY = 130;
      const camCollText = `camera colliding: ${this.collision.cameraCollidingWith.length ? this.collision.cameraCollidingWith.join(', ') : 'none'}`;
      this.consoleRenderer?.drawText(camCollText, 20, collisionY, {
        color: this.collision.cameraCollidingWith.length ? 'red' : this.consoleColor,
      });

      const debugPhysics = this.scene.getPhysics();
      if (debugPhysics) {
        const grounded = debugPhysics.isGrounded();
        const vy = Math.round(debugPhysics.getVelocityY() * 10000) / 10000;
        const physText = `physics: ${grounded ? 'grounded' : 'airborne'} vy: ${vy}`;
        collisionY += 15;
        this.consoleRenderer?.drawText(physText, 20, collisionY, {
          color: grounded ? this.consoleColor : 'orange',
        });
      }

      if (this.collision.objectCollisions.length) {
        collisionY += 15;
        this.consoleRenderer?.drawText(`object collisions:`, 20, collisionY, {
          color: 'red',
        });
        for (const coll of this.collision.objectCollisions) {
          collisionY += 15;
          this.consoleRenderer?.drawText(`  ${coll}`, 20, collisionY, {
            color: 'red',
          });
        }
      }

      collisionY += 15;
      const { culledCount, totalCount } = this.pipeline;
      const visibleCount = totalCount - culledCount;
      const cullText = `frustum: ${visibleCount}/${totalCount} visible (${culledCount} culled)`;
      this.consoleRenderer?.drawText(cullText, 20, collisionY, {
        color: culledCount > 0 ? 'cyan' : this.consoleColor,
      });
    });
  }

  protected async onLoad(): Promise<void> {
    this.scene = await this.sceneProvider.getCurrent();
    this.resetPosition();
  }

  protected onUpdate(): void {
    this.renderer.fill();
    this.scene.update({ elapsedTime: this.elapsedTime, deltaTime: this.delta });
    this.handleInput();
    this.updatePosition();

    if (isGlRenderer(this.renderer)) {
      this.renderer.setLight(this.scene.getLight());
    }

    const sceneData = this.scene.get();
    const objects = Array.isArray(sceneData) ? sceneData : [sceneData];

    const bvh = buildBVH(objects, this.vecMat);

    this.collision.updatePointingAt(objects, this.camera);
    this.collision.updateCollisions(objects, this.camera, bvh);

    this.pipeline.render(
      sceneData,
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
      bvh,
    );
  }

  private updatePosition() {
    const shouldInvertForward = this.renderMode !== "cpu";
    const { viewMatrix } = this.camera.update(shouldInvertForward);

    if (isGlRenderer(this.renderer)) {
      const invView = this.vecMat.matrixQuickInverse(viewMatrix);
      this.renderer.setViewMatrix(invView);
      this.matView = invView;
      this.matFrustumView = invView;
      return;
    }

    // CPU: original view matrix for rendering (matrixInverse mutates input but result is correct)
    this.matView = this.vecMat.matrixInverse(viewMatrix) as Mat4x4;

    // Frustum culling needs GL convention (invertForward=true)
    const target = this.vecMat.vectorSub(this.camera.pos, this.camera.aimDir);
    this.matFrustumView = this.vecMat.matrixQuickInverse(
      this.vecMat.matrixPointAt(this.camera.pos, target, this.camera.vUp, true)
    );
  }

  private setMouseLook(val: boolean) {
    if (val) {
      this.isMouseLookActive = true;
      this.renderer.addPointerLockListener();
      this.renderer.lockPointer();
    } else {
      this.isMouseLookActive = false;
      this.renderer.exitPointerLock();
      this.renderer.removePointerLockListener();
    }
  }

  private resetPosition() {
    const { camera, lookDir, moveDir, target, pitch, yaw } =
      this.scene.getStartPosition();
    this.camera.setPosition(camera, lookDir, moveDir, target, pitch, yaw);
    this.camera.isFlying = this.scene.getFlying();

    const physics = this.scene.getPhysics();
    if (physics) {
      physics.reset();
    }

    const sceneData = this.scene.get();
    const objects = Array.isArray(sceneData) ? sceneData : [sceneData];

    this.collision.savePrevCameraPos(this.camera);
    this.collision.enforceGroundCollision(objects, this.camera, physics);
    if (physics) {
      physics.land();
    }
  }

  private async nextScene() {
    const scene = await this.sceneProvider.getNext();
    if (scene) {
      this.scene = scene;
    }
  }

  private handleInput() {
    const physics = this.scene.getPhysics();

    // Move Up
    if (this.isKeyPressed("e")) {
      this.camera.applyMovement('up', this.delta);
    }

    // Move Down / Jump
    if (this.isKeyPressed(" ")) {
      if (physics) {
        physics.jump();
      } else {
        this.camera.applyMovement('down', this.delta);
      }
    }

    // Gravity
    if (physics) {
      this.camera.pos[1] += physics.update(this.delta);
    }

    // Move Left
    if (this.isKeyPressed("a")) {
      this.camera.applyMovement('left', this.delta);
    }

    // Move Right
    if (this.isKeyPressed("d")) {
      this.camera.applyMovement('right', this.delta);
    }

    // Move Forward
    if (this.isKeyPressed("w")) {
      this.camera.applyMovement('forward', this.delta);
    }

    // Move Backwards
    if (this.isKeyPressed("s")) {
      this.camera.applyMovement('back', this.delta);
    }

    // Arrow look
    if (this.isKeyPressed("ArrowRight")) {
      this.camera.applyArrowLook('right', this.delta);
    }
    if (this.isKeyPressed("ArrowLeft")) {
      this.camera.applyArrowLook('left', this.delta);
    }
    if (this.isKeyPressed("ArrowUp")) {
      this.camera.applyArrowLook('up', this.delta);
    }
    if (this.isKeyPressed("ArrowDown")) {
      this.camera.applyArrowLook('down', this.delta);
    }

    // Speed
    this.camera.setFastSpeed(this.isKeyPressed("Shift"));

    // Mouse look
    if (this.isMouseLookActive) {
      this.camera.applyMouseLook(this.mouseMovementX, this.mouseMovementY, this.delta);
    }

    // Toggle flying
    this.handleToggle("t", () => {
      this.camera.isFlying = !this.camera.isFlying;
    });

    // Toggle mouse look
    this.handleToggle("m", () => {
      this.setMouseLook(!this.isMouseLookActive);
    });

    // Toggle renderer
    this.handleToggle("p", async () => {
      const currentIndex = renderModes.findIndex(
        (val) => val === this.renderMode
      );
      const mode =
        currentIndex < renderModes.length - 1
          ? renderModes[currentIndex + 1]
          : renderModes[0];
      this.setRenderMode(mode);
      this.pipeline.setGlMatrices(this.renderer, this.matView, this.matProj);
    });

    // Next scene
    this.handleToggle("n", async () => {
      await this.nextScene();
      this.resetPosition();
    });

    // Collision enforcement
    const sceneData = this.scene.get();
    const objects = Array.isArray(sceneData) ? sceneData : [sceneData];

    this.collision.enforceSolidCollisions(objects, this.camera, physics);
    this.collision.enforceGroundCollision(objects, this.camera, physics);

    // Correct over steering
    this.camera.clampAngles();
    this.resetMouseMovement();
  }
}
