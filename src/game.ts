import { Engine, renderModes } from './engine/engine';
import { Mesh, MeshTriangle, Obj, ObjTriangle, Triangle, Vec3, Vec4 } from './engine/types';
import VecMat, { Mat4x4, MovementParams } from './engine/vecmat';
import { sort } from 'fast-sort';
import { Scene, SceneProvider } from './scene'
import { TeapotScene } from './scenes/teapot-scene';
import { CubesScene } from './scenes/cubes-scene';
import { CubeScene } from './scenes/cube-scene';
import { isCpuRenderer, isGlRenderer } from './engine/renderers';

export default class Game extends Engine {
  private vecMat: VecMat;
  private scene!: Scene;

  private matWorld: Mat4x4;
  private near = 0.1;
  private far = 1000;

  private matProj!: Mat4x4;
  private matView: Mat4x4;
  private cameraPos!: Vec4;
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

  private upSpeedFast = 0.015;
  private upSpeedSlow = 0.005;
  private upSpeed = this.upSpeedSlow;

  private movementSpeedFast = 0.015;
  private movementSpeedSlow = 0.005;
  private movementSpeed = this.movementSpeedFast;


  private mouseSensitivity = 3;
  private sceneProvider: SceneProvider

  private isFlying = true;
  private isMouseLookActive = false;

  constructor() {
    super({ console: { enabled: true }, renderer: 'light' });

    this.sceneProvider = new SceneProvider({
      teapot: new TeapotScene(),
      cubes: new CubesScene(),
      cube: new CubeScene()
    });

    this.vecMat = new VecMat();
    this.matView = this.vecMat.matrixCreate();
    this.matProj = this.getProjection(this.aspectRatio);
    this.matWorld = this.createWorldMatrix();

    this.yaw = 0;
    this.xaw = 0;
    this.vUp = this.vecMat.vectorCreate([0, 1, 0, 1]);

    window.addEventListener('resize', () => {
      this.matProj = this.getProjection(this.aspectRatio);

      if (isGlRenderer(this.renderer)) {
        this.renderer.setProjectionMatrix(this.matProj);
      }
    });

    this.setGlMatrices();

    this.addConsoleCustomMethod(() => {
      const [cx, cy, cz] = this.cameraPos.map(val => Math.round(val * 10) / 10);
      const cameraText = `camera: x: ${cx} y: ${cy} z: ${cz}`;
      this.consoleRenderer?.drawText(cameraText, 20, 40, { color: this.consoleColor });

      const [lx, ly, lz] = this.lookDir.map(val => Math.round(val * 10) / 10);
      const lookText = `look: x: ${lx} y: ${ly} z: ${lz}`;
      this.consoleRenderer?.drawText(lookText, 20, 60, { color: this.consoleColor });
    });
  }

  protected async onLoad(): Promise<void> {
    this.scene = await this.sceneProvider.getCurrent();
    this.resetPosition();
  }

  protected onUpdate(): void {
    this.renderer.fill();
    this.scene.update(this.elapsedTime);
    this.handleInput();
    this.updatePosition();

    if (isGlRenderer(this.renderer)) {
      this.renderer.setLight(this.scene.getLight());
    }

    this.renderObjToWorld(this.scene.get());
  }

  private createWorldMatrix() {
    const matTrans = this.vecMat.matrixTranslation(0, 0, 8)
    const matIdent = this.vecMat.matrixCreateIdentity();

    return this.vecMat.matrixMultiplyMatrix(matIdent, matTrans);
  }

  private getProjection(aspectRatio: number) {
    return this.vecMat.matrixProjection(90, aspectRatio, this.near, this.far);
  }

  private RGBGrayScale(value: number): Vec4 {
    const col = value * 255;
    const col2 = col + 1 > 255 ? 255 : col;
    const col3 = col + 2 > 255 ? 255 : col;

    return [col, col2, col3, 1];
  }

  private objTriToMeshTri = (tri: ObjTriangle, object: Obj, color?: Vec3): Triangle<Vec3> => {
    return [
      this.vecMat.objVectorToVector(object.vertices[tri.v1]),
      this.vecMat.objVectorToVector(object.vertices[tri.v2]),
      this.vecMat.objVectorToVector(object.vertices[tri.v3]),
      color || [1, 1, 1]
    ]
  }

  private projectObject(obj: Obj) {
    const projectedTriangles: Mesh<Triangle> = [];

    let triIndex = obj.triangles.length;
    while (triIndex--) {
      const objTriangle = obj.triangles[triIndex];

      const v1v = obj.vertices[objTriangle.v1];
      const v2v = obj.vertices[objTriangle.v2];
      const v3v = obj.vertices[objTriangle.v3];

      const triangleTransformed: MeshTriangle = [
        this.vecMat.matrixMultiplyVector(this.matWorld, [v1v.x, v1v.y, v1v.z, 1]),
        this.vecMat.matrixMultiplyVector(this.matWorld, [v2v.x, v2v.y, v2v.z, 1]),
        this.vecMat.matrixMultiplyVector(this.matWorld, [v3v.x, v3v.y, v3v.z, 1])
      ];

      // Calculate triangle normal
      const line1: Vec4 = this.vecMat.vectorSub(triangleTransformed[1], triangleTransformed[0]);
      const line2: Vec4 = this.vecMat.vectorSub(triangleTransformed[2], triangleTransformed[0]);
      const normal = this.vecMat.vectorNormalize(this.vecMat.vectorCrossProduct(line1, line2));

      if (isCpuRenderer(this.renderer)) {
        // Get Ray from triangle to camera
        const cameraRay = this.vecMat.vectorSub(triangleTransformed[0], this.cameraPos);

        // Triangle visible if ray is aligned with normal (a sort of culling done here)
        if (this.vecMat.vectorDotProd(normal, cameraRay) > 0) {
          continue;
        }
      }

      // Illumination
      let [r, g, b, a] = this.scene.getLight().direction;
      r = r * a;
      g = g * a;
      b = b * a;

      const lightDp = Math.min(Math.max(this.vecMat.vectorDotProd([r, g, b, 1], normal), 0.1), 1);

      const triangleColor = isGlRenderer(this.renderer)
        ? this.vecMat.vectorCreate([lightDp, lightDp, lightDp, 1])
        : this.RGBGrayScale(lightDp);

      if (this.renderMode === 'gl' || this.renderMode === 'wgpu') {
        projectedTriangles.push(this.objTriToMeshTri(objTriangle, obj, [triangleColor[0], triangleColor[1], triangleColor[2]]));
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

      if (isGlRenderer(this.renderer)) {
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

  private setGlMatrices() {
    if (!isGlRenderer(this.renderer)) {
      return;
    }

    this.renderer.setViewMatrix(this.matView);
    this.renderer.setProjectionMatrix(this.matProj);
    this.renderer.setWorldMatrix(this.matWorld);
  }

  private flattenMeshArray<T extends Triangle | MeshTriangle = MeshTriangle>(
    meshArray: Mesh<T>[] = []
  ): Mesh<T> {
    // Use the concat method to flatten the array of arrays
    return ([] as Mesh<T>).concat(...meshArray);
  }

  private drawMeshWithCPU(projected: Mesh<Triangle>) {
    if (!isCpuRenderer(this.renderer)) {
      return;
    }

    const sortCondition = (tri: Triangle) => tri[0][2] + tri[1][2] + tri[2][2] / 3;
    const sorted = sort(projected).by([{ desc: sortCondition }]);

    let rasterIndex = sorted.length;
    while (rasterIndex--) {
      const triangleList: Triangle[] = [sorted[rasterIndex]];
      this.clipAgainstScreenEdges(triangleList);

      let triangleIndex = triangleList.length;
      while (triangleIndex--) {
        this.renderer.drawTriangle(triangleList[triangleIndex]);
      }
    }
  }

  private renderObjToWorld(mesh: Obj | Obj[]) {
    const meshes = Array.isArray(mesh) ? mesh : [mesh];

    if (this.renderMode === 'light' && isGlRenderer(this.renderer)) {
      return this.renderer.drawObjects(meshes);
    }

    const projected = meshes.map((obj) => this.projectObject(obj));

    if (isGlRenderer(this.renderer)) {
      return this.renderer.drawMeshes(projected);
    }

    this.drawMeshWithCPU(this.flattenMeshArray(projected));
  }

  private updatePosition() {
    const params: MovementParams = {
      vCamera: this.cameraPos,
      vTarget: this.vTarget,
      vUp: this.vUp,
      xaw: this.xaw,
      yaw: this.yaw,
      shouldInvertForward: this.renderMode !== 'cpu'
    }

    const { lookDir, cameraView: camera, moveDir } = this.isFlying
      ? this.vecMat.movementFly(params)
      : this.vecMat.movementWalk(params);

    this.lookDir = lookDir;
    this.moveDir = moveDir;

    if (isGlRenderer(this.renderer)) {
      this.renderer.setViewMatrix(camera);
      return;
    }

    this.matView = this.vecMat.matrixInverse(camera) as Mat4x4;
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
    this.cameraPos = camera;
    this.lookDir = lookDir;
    this.moveDir = moveDir;
    this.xaw = xaw;
    this.yaw = yaw;
  }

  private async nextScene() {
    const scene = await this.sceneProvider.getNext();

    if (scene) {
      this.scene = scene;
    }
  }

  private calculateForwardMovement() {
    return this.vecMat.vectorMul(this.lookDir, this.movementSpeed * this.delta);
  }

  private calculateSidewaysMovement() {
    const vForwardWithoutTilt = this.vecMat.vectorMul(this.moveDir, this.movementSpeed * this.delta);
    return this.vecMat.vectorCrossProduct(vForwardWithoutTilt, this.vUp);
  }

  private handleInput() {
    const vForward = this.vecMat.vectorMul(this.lookDir, this.movementSpeed * this.delta);

    // Move Up
    if (this.isKeyPressed('e')) {
      this.cameraPos[1] += this.upSpeed * this.delta;
    }

    // Move Down
    if (this.isKeyPressed(' ')) {
      this.cameraPos[1] -= this.upSpeed * this.delta;
    }

    // Move Left
    if (this.isKeyPressed('a')) {
      this.cameraPos = this.vecMat.vectorAdd(this.cameraPos, this.calculateSidewaysMovement());
    }

    // Move Right
    if (this.isKeyPressed('d')) {
      this.cameraPos = this.vecMat.vectorSub(this.cameraPos, this.calculateSidewaysMovement());
    }

    // Move Forward
    if (this.isKeyPressed('w')) {
      this.cameraPos = this.vecMat.vectorSub(this.cameraPos, this.calculateForwardMovement());
    }

    // Move Backwards
    if (this.isKeyPressed('s')) {
      this.cameraPos = this.vecMat.vectorAdd(this.cameraPos, this.calculateForwardMovement());
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
      this.xaw -= this.lookSpeed * this.delta;
    }

    // Look down
    if (this.isKeyPressed('ArrowDown')) {
      this.xaw += this.lookSpeed * this.delta;
    }

    if (this.isKeyPressed('Shift')) {
      this.movementSpeed = this.movementSpeedFast;
      this.upSpeed = this.upSpeedFast;
    } else {
      this.movementSpeed = this.movementSpeedSlow;
      this.upSpeed = this.upSpeedSlow;
    }

    // Mouse look
    if (this.isMouseLookActive) {
      if (this.mouseMovementX) {
        this.yaw += this.mouseMovementX / 10000 * this.mouseSensitivity * this.delta;
      }

      if (this.mouseMovementY) {
        this.xaw -= (-this.mouseMovementY / 10000 * this.mouseSensitivity * this.delta);
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
    this.handleToggle('p', async () => {
      const currentIndex = renderModes.findIndex((val) => val === this.renderMode);

      const mode = currentIndex < (renderModes.length - 1)
        ? renderModes[currentIndex + 1]
        : renderModes[0];

      this.setRenderMode(mode);
      this.setGlMatrices();
    });

    // Next scene
    this.handleToggle('n', async () => {
      await this.nextScene();
      this.resetPosition();
    });

    // Correct over steering
    this.correctOverSteering();
    this.resetMouseMovement();
  }

}