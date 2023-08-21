import { Engine, renderModes } from './engine/engine';
import { Mesh, MeshTriangle, Triangle, Vec4 } from './engine/types';
import VecMat, { Mat4x4, MovementParams } from './engine/vecmat';
import { sort } from 'fast-sort';
import { Scene, SceneProvider } from './scene'
import { TeapotScene } from './scenes/teapot-scene';
import { CubeScene } from './scenes/cube-scene';

export default class Game extends Engine {
  private vecMat: VecMat;
  private scene: Scene;

  private worldMatrix: Mat4x4;
  private near = 0.1;
  private far = 1000;

  private matProj!: Mat4x4;
  private matView: Mat4x4;
  private camera!: Vec4;
  private lookDir!: Vec4;
  private moveDir!: Vec4;
  private vUp!: Vec4;
  private vTarget!: Vec4;
  private yaw!: number;
  private xaw!: number;

  private maxYaw = Math.PI * 2;
  private minYaw = -this.maxYaw;
  private maxXaw = Math.PI / 2 - 0.1;
  private minXaw = -this.maxXaw;

  private lookSpeed = 0.002;
  private upSpeed = 0.005;
  private movementSpeed = 0.005;
  private mouseSensitivity = 3;
  private sceneProvider: SceneProvider

  private isFlying = true;
  private isMouseLookActive = false;

  constructor() {
    super({ console: { enabled: true }, mode: 'test' });

    this.sceneProvider = new SceneProvider({
      cube: new CubeScene(),
      teapot: new TeapotScene(),
    });

    this.vecMat = new VecMat();
    this.scene = this.sceneProvider.getCurrent();
    this.worldMatrix = this.createWorldMatrix();
    this.matView = this.vecMat.matrixCreate();
    this.matProj = this.getProjection(this.aspectRatio);

    this.yaw = 0;
    this.xaw = 0;
    this.vUp = this.vecMat.vectorCreate([0, 1, 0, 1]);

    this.resetPosition();
    // @ts-expect-error
    this.canvas.camera = this.matView;

    window.addEventListener('resize', () => {
      this.matProj = this.getProjection(this.aspectRatio);
    });
  }

  protected async onLoad(): Promise<void> {
    return;
  }

  protected onUpdate(): void {
    this.canvas.fill();
    this.scene.update(this.elapsedTime);
    this.updatePosition();
    this.handleInput();
    this.renderObjToWorld(this.scene.get());
  }

  private createWorldMatrix() {
    const matTrans = this.vecMat.matrixTranslation(0, 0, 8);
    const matIdent = this.vecMat.matrixCreateIdentity();
    return this.vecMat.matrixMultiplyMatrix(matIdent, matTrans);
  }

  private getProjection(aspectRatio: number) {
    return this.vecMat.matrixProjection(90, aspectRatio, this.near, this.far);
  }

  private projectObject(mesh: Mesh) {
    const projectedTriangles: Mesh<Triangle> = [];

    let meshIndex = mesh.length;
    while (meshIndex--) {
      const triangle: MeshTriangle = mesh[meshIndex];
      // const triCopy: MeshTriangle = [...mesh[meshIndex]];

      const triangleTransformed: MeshTriangle = [
        this.vecMat.matrixMultiplyVector(this.worldMatrix, triangle[0]),
        this.vecMat.matrixMultiplyVector(this.worldMatrix, triangle[1]),
        this.vecMat.matrixMultiplyVector(this.worldMatrix, triangle[2])
      ]

      // Calculate triangle normal
      const line1: Vec4 = this.vecMat.vectorSub(triangleTransformed[1], triangleTransformed[0]);
      const line2: Vec4 = this.vecMat.vectorSub(triangleTransformed[2], triangleTransformed[0]);
      const normal = this.vecMat.vectorNormalize(this.vecMat.vectorCrossProduct(line1, line2));

      // Get Ray from triangle to camera
      const cameraRay = this.vecMat.vectorSub(triangleTransformed[0], this.camera);

      // Triangle visible if ray is aligned with normal (a sort of culling done here)
      // if (this.vecMat.vectorDotProd(normal, cameraRay) < 0) {

      // Illumination
      const lightDirection = this.vecMat.vectorNormalize([0, 1, -1, 1]);

      // alignment of light direction and triangle surface normal
      const lightDp = Math.min(Math.max(this.vecMat.vectorDotProd(lightDirection, normal), 0.1), 1);

      const triangleColor = this.renderMode !== '2d'
        ? this.vecMat.vectorCreate([lightDp, lightDp, lightDp, 1])
        : this.canvas.RGBGrayScale(lightDp);

      if (this.renderMode === 'test') {
        projectedTriangles.push([...triangle, triangleColor]);
        continue;
      }

      // Convert world space --> View space
      const triViewed: Triangle = [
        this.vecMat.matrixMultiplyVector(this.matView, triangleTransformed[0]),
        this.vecMat.matrixMultiplyVector(this.matView, triangleTransformed[1]),
        this.vecMat.matrixMultiplyVector(this.matView, triangleTransformed[2]),
        triangleColor
      ];

      const clippedTriangles = this.vecMat.triangleClipAgainstPlane(
        [0, 0, 0.1, 1],
        [0, 0, 1, 1],
        triViewed
      );

      if (this.renderMode !== '2d') {
        projectedTriangles.push(...clippedTriangles);
        continue;
      }

      let lClippedTriangles = clippedTriangles.length;
      while (lClippedTriangles--) {
        const clipped = clippedTriangles[lClippedTriangles];

        // Project from 3D --> 2D
        const triProjected: Triangle = [
          this.vecMat.matrixMultiplyVector(this.matProj, clipped[0]),
          this.vecMat.matrixMultiplyVector(this.matProj, clipped[1]),
          this.vecMat.matrixMultiplyVector(this.matProj, clipped[2]),
          clipped[3]
        ];

        // normalize into cartesian space
        triProjected[0] = this.vecMat.vectorDiv(triProjected[0], triProjected[0][3]);
        triProjected[1] = this.vecMat.vectorDiv(triProjected[1], triProjected[1][3]);
        triProjected[2] = this.vecMat.vectorDiv(triProjected[2], triProjected[2][3]);

        // Offset verts into visible normalized space
        const offsetView = this.vecMat.vectorCreate([1, 1, 0, 1]);
        triProjected[0] = this.vecMat.vectorAdd(triProjected[0], offsetView);
        triProjected[1] = this.vecMat.vectorAdd(triProjected[1], offsetView);
        triProjected[2] = this.vecMat.vectorAdd(triProjected[2], offsetView);

        triProjected[0][0] *= this.screenXCenter;
        triProjected[0][1] *= this.screenYCenter;
        triProjected[1][0] *= this.screenXCenter;
        triProjected[1][1] *= this.screenYCenter;
        triProjected[2][0] *= this.screenXCenter;
        triProjected[2][1] *= this.screenYCenter;

        // Store triangles for sorting
        projectedTriangles.push(triProjected);
      }
    }
    // }
    return projectedTriangles;
  }

  private clipAgainstScreenEdges(triangles: Triangle[]) {
    let newTriangles = 1;
    let i = 4; // for each side of screen

    if (!triangles[0]) {
      return;
    }

    while (i--) {
      let trianglesToAdd: Triangle[] = [];

      while (newTriangles > 0) {
        const test = triangles.shift() as Triangle;
        newTriangles--;

        switch (i) {
          case 0: // Top
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([0, 1, 0, 1], [0, 1, 0, 1], test) as Triangle[];
            break;

          case 1: // Bottom
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([0, this.screenHeight - 1, 0, 1], [0, -1, 0, 1], test) as Triangle[];
            break;

          case 2: // Left
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([1, 0, 0, 1], [1, 0, 0, 1], test) as Triangle[];
            break;

          case 3: // Right
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([this.screenWidth - 1, 0, 0, 1], [-1, 0, 0, 1], test) as Triangle[];
            break;
        }
        triangles.push(...trianglesToAdd);
      }
      newTriangles = triangles.length;
    }
  }

  private renderObjToWorld(mesh: Mesh) {
    const projected = this.projectObject(mesh);

    if (this.renderMode !== '2d') {
      return this.canvas.drawMesh(projected);
    }

    const sortCondition = (tri: Triangle) => tri[0][2] + tri[1][2] + tri[2][2] / 3;
    const sorted = sort(projected).by([{ desc: sortCondition }]);

    let rasterIndex = sorted.length;
    while (rasterIndex--) {
      const triangleList: Triangle[] = [sorted[rasterIndex]];
      this.clipAgainstScreenEdges(triangleList);

      let triangleIndex = triangleList.length;
      while (triangleIndex--) {
        this.canvas.drawTriangle(triangleList[triangleIndex]);
      }
    }
  }

  private updatePosition() {
    const params: MovementParams = {
      vCamera: this.camera,
      vTarget: this.vTarget,
      vUp: this.vUp,
      xaw: this.xaw,
      yaw: this.yaw
    }

    const { lookDir, camera, moveDir } = this.isFlying
      ? this.vecMat.movementFly(params)
      : this.vecMat.movementWalk(params);

    this.lookDir = lookDir;
    this.moveDir = moveDir;
    this.matView = this.vecMat.matrixQuickInverse(camera);
    // @ts-expect-error
    this.canvas.camera = this.matView;
  }

  private setMouseLook(val: boolean) {
    if (val) {
      this.isMouseLookActive = true;
      this.canvas.addPointerLockListener();
      this.canvas.lockPointer();
    } else {
      this.isMouseLookActive = false;
      this.canvas.exitPointerLock();
      this.canvas.removePointerLockListener();
    }
  }

  private correctOverSteering() {
    if (this.yaw >= this.maxYaw || this.yaw <= this.minYaw) {
      this.yaw = 0;
    }

    if (this.xaw > this.maxXaw) {
      this.xaw = this.maxXaw;
    }

    if (this.xaw < this.minXaw) {
      this.xaw = this.minXaw;
    }
  }

  private resetPosition() {
    const { camera, lookDir, moveDir, target, xaw, yaw } = this.scene.getStartPosition();
    this.vTarget = target;
    this.camera = camera;
    this.lookDir = lookDir;
    this.moveDir = moveDir;
    this.xaw = xaw;
    this.yaw = yaw;
  }

  private nextScene() {
    const scene = this.sceneProvider.getNext();

    if (scene) {
      this.scene = scene;
    }
  }

  private handleInput() {
    const vForward = this.vecMat.vectorMul(this.lookDir, this.movementSpeed * this.delta);
    const vForwardWithoutTilt = this.vecMat.vectorMul(this.moveDir, this.movementSpeed * this.delta);
    const vSideways = this.vecMat.vectorCrossProduct(vForwardWithoutTilt, this.vUp);

    // Move Up
    if (this.isKeyPressed('e')) {
      this.camera[1] += this.upSpeed * this.delta;
    }

    // Move Down
    if (this.isKeyPressed(' ')) {
      this.camera[1] -= this.upSpeed * this.delta;
    }

    // Move Left
    if (this.isKeyPressed('a')) {
      this.camera = this.vecMat.vectorSub(this.camera, vSideways);
    }

    // Move Right
    if (this.isKeyPressed('d')) {
      this.camera = this.vecMat.vectorAdd(this.camera, vSideways);
    }

    // Move Forward
    if (this.isKeyPressed('w')) {
      this.camera = this.vecMat.vectorAdd(this.camera, vForward);
    }

    // Move Backwards
    if (this.isKeyPressed('s')) {
      this.camera = this.vecMat.vectorSub(this.camera, vForward);
    }

    // Look Right
    if (this.isKeyPressed('ArrowRight')) {
      this.yaw += this.lookSpeed * this.delta;
    }

    // Look left
    if (this.isKeyPressed('ArrowLeft')) {
      this.yaw -= this.lookSpeed * this.delta;
    }

    // Look up
    if (this.isKeyPressed('ArrowUp')) {
      this.xaw += this.lookSpeed * this.delta;
    }

    // Look down
    if (this.isKeyPressed('ArrowDown')) {
      this.xaw -= this.lookSpeed * this.delta;
    }

    // Mouse look
    if (this.isMouseLookActive) {
      if (this.mouseMovementX) {
        this.yaw += this.mouseMovementX / 10000 * this.mouseSensitivity * this.delta;
      }

      if (this.mouseMovementY) {
        this.xaw += (-this.mouseMovementY / 10000 * this.mouseSensitivity * this.delta);
      }
    }

    // Toggle flying
    this.handleToggle('t', () => {
      this.isFlying = !this.isFlying;
    })

    // Toggle mouse look
    this.handleToggle('m', () => {
      this.setMouseLook(!this.isMouseLookActive);
    });

    // Toggle renderer
    this.handleToggle('p', () => {
      const currentIndex = renderModes.findIndex((val) => val === this.renderMode);

      const mode = currentIndex < (renderModes.length - 1)
        ? renderModes[currentIndex + 1]
        : renderModes[0];

      this.setRenderMode(mode);
    });

    // Next scene
    this.handleToggle('n', () => {
      this.nextScene();
      this.resetPosition();
    });

    // Correct over steering
    this.correctOverSteering();
    this.resetMouseMovement();
  }

}