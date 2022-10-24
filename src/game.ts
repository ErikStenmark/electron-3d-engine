import { Engine } from './engine/engine';
import { Mesh, MeshTriangle, Triangle, Vec3d } from './engine/types';
import VecMat, { Mat4x4, MovementParams } from './engine/vecmat';
import { sort } from 'fast-sort';
import { ObjectLoader } from './obj-loader';

export default class Game extends Engine {
  private vecMat: VecMat;
  private objLoader: ObjectLoader;
  private meshObj: Mesh = [];

  private worldMatrix: Mat4x4;
  private near = 0.1;
  private far = 1000;

  private matProj: Mat4x4;
  private matView: Mat4x4;
  private camera: Vec3d;
  private lookDir: Vec3d;
  private moveDir: Vec3d;
  private vUp: Vec3d;
  private vTarget: Vec3d;
  private yaw: number;
  private xaw: number;

  private maxYaw = Math.PI * 2;
  private minYaw = -this.maxYaw;
  private maxXaw = Math.PI / 2 - 0.1;
  private minXaw = -this.maxXaw;

  private lookSpeed = 0.002;
  private upSpeed = 0.005;
  private movementSpeed = 0.005;
  private mouseSensitivity = 3;

  private isFlying = true;
  private isMouseLookActive = false;

  constructor() {
    super({ console: { enabled: true }, mode: 'gl' });
    this.vecMat = new VecMat();
    this.objLoader = new ObjectLoader();
    this.yaw = 0;
    this.xaw = 0;
    this.camera = this.vecMat.vectorCreate(0);
    this.lookDir = this.vecMat.vectorCreate([0, 0, 1]);
    this.moveDir = this.vecMat.vectorCreate([0, 0, 1]);
    this.vUp = this.vecMat.vectorCreate([0, 1, 0]);
    this.vTarget = this.vecMat.vectorCreate([0, 0, 1]);
    this.matProj = this.getProjection(this.aspectRatio);
    this.worldMatrix = this.createWorldMatrix();
    this.matView = this.vecMat.matrixCreate();

    window.addEventListener('resize', () => {
      this.matProj = this.getProjection(this.aspectRatio);
    });
  }

  protected async onLoad(): Promise<void> {
    this.meshObj = await this.objLoader.load('mountains.obj');
  }

  protected onUpdate(): void {
    this.canvas.fill();
    this.updatePosition();
    this.handleInput();
    this.renderObjToWorld(this.meshObj);
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

      const triangle: MeshTriangle = this.meshObj[meshIndex];

      const triangleTransformed: Triangle = [
        this.vecMat.matrixMultiplyVector(this.worldMatrix, triangle[0]),
        this.vecMat.matrixMultiplyVector(this.worldMatrix, triangle[1]),
        this.vecMat.matrixMultiplyVector(this.worldMatrix, triangle[2]),
        this.vecMat.vectorCreate() // only for typescript (not needed here yet)
      ]

      // Calculate triangle normal
      const line1: Vec3d = this.vecMat.vectorSub(triangleTransformed[1], triangleTransformed[0]);
      const line2: Vec3d = this.vecMat.vectorSub(triangleTransformed[2], triangleTransformed[0]);
      const normal: Vec3d = this.vecMat.vectorNormalize(this.vecMat.vectorCrossProduct(line1, line2));

      // Get Ray from triangle to camera
      const cameraRay = this.vecMat.vectorSub(triangleTransformed[0], this.camera);

      // Triangle visible if ray is aligned with normal
      if (this.vecMat.vectorDotProd(normal, cameraRay) < 0) {

        // Illumination
        const lightDirection: Vec3d = this.vecMat.vectorNormalize([0, 1, -1]);

        // alignment of light direction and triangle surface normal
        const lightDp = Math.min(Math.max(this.vecMat.vectorDotProd(lightDirection, normal), 0.1), 1);

        const triangleColor = this.canvas.RGBGrayScale(lightDp);

        // Convert world space --> View space
        const triViewed: Triangle = [
          this.vecMat.matrixMultiplyVector(this.matView, triangleTransformed[0]),
          this.vecMat.matrixMultiplyVector(this.matView, triangleTransformed[1]),
          this.vecMat.matrixMultiplyVector(this.matView, triangleTransformed[2]),
          triangleColor
        ];

        const clippedTriangles = this.vecMat.triangleClipAgainstPlane(
          [0, 0, 0.1],
          [0, 0, 1],
          triViewed
        );

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
          const offsetView = this.vecMat.vectorCreate([1, 1, 0]);
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
    }
    return projectedTriangles;
  }

  private clipAgainstScreenEdges(triangles: Triangle[]) {
    let newTriangles = 1;
    let i = 4; // for each side of screen

    while (i--) {
      let trianglesToAdd: Triangle[] = [];

      while (newTriangles > 0) {
        const test = triangles.shift() as Triangle;
        newTriangles--;

        switch (i) {
          case 0: // Top
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([0, 1, 0], [0, 1, 0], test) as Triangle[];
            break;

          case 1: // Bottom
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([0, this.screenHeight - 1, 0], [0, -1, 0], test) as Triangle[];
            break;

          case 2: // Left
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([1, 0, 0], [1, 0, 0], test) as Triangle[];
            break;

          case 3: // Right
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane([this.screenWidth - 1, 0, 0], [-1, 0, 0], test) as Triangle[];
            break;
        }
        triangles.push(...trianglesToAdd);
      }
      newTriangles = triangles.length;
    }
  }

  private renderObjToWorld(mesh: Mesh) {
    const projected = this.projectObject(mesh);

    // Sort triangles from back to front
    const sortCondition = (tri: Triangle) => tri[0][2] + tri[1][2] + tri[2][2] / 3;
    const sorted: Triangle[] = this.renderMode === 'gl'
      ? sort(projected).by([{ asc: sortCondition }])
      : sort(projected).by([{ desc: sortCondition }]);

    let rasterIndex = sorted.length;
    while (rasterIndex--) {
      if (this.renderMode === 'gl') {
        this.canvas.drawTriangle(sorted[rasterIndex]);
        continue;
      }

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
      this.renderMode === '2d'
        ? this.setRenderMode('gl')
        : this.setRenderMode('2d');
    })

    // Correct over steering
    this.correctOverSteering();
    this.resetMouseMovement();
  }

}