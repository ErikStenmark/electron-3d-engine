import { Engine } from './engine/engine';
import { Mesh, Triangle, Vec3d } from './engine/types';
import VecMat, { Mat4x4, MovementParams } from './vecmat';
import { sort } from 'fast-sort';

type ObjLine = [string, number, number, number];

class Game extends Engine {

  private vecMat: VecMat;
  private meshObj: Mesh = [];

  private near = 0.1;
  private far = 1000;
  private matProj: Mat4x4;

  private camera: Vec3d;
  private lookDir: Vec3d;
  private moveDir: Vec3d;
  private vUp: Vec3d;
  private vTarget: Vec3d;

  private maxYaw = Math.PI * 2;
  private minYaw = -this.maxYaw;
  private maxXaw = Math.PI / 2 - 0.1;
  private minXaw = -this.maxXaw;

  private yaw: number;
  private xaw: number;

  private lookSpeed = 0.002;
  private upSpeed = 0.005;
  private movementSpeed = 0.005;

  private isFlying = true;
  private isToggleFlyingPressed = false;

  constructor() {
    super({ console: { enabled: true } });
    this.vecMat = new VecMat();

    this.yaw = 0;
    this.xaw = 0;

    this.camera = this.vecMat.vectorCreate(0);
    this.lookDir = this.vecMat.vectorCreate([0, 0, 1]);
    this.moveDir = this.vecMat.vectorCreate([0, 0, 1]);
    this.vUp = this.vecMat.vectorCreate([0, 1, 0]);
    this.vTarget = this.vecMat.vectorCreate([0, 0, 1]);

    this.matProj = this.projection(this.aspectRatio);

    window.addEventListener('resize', () => {
      this.matProj = this.projection(this.aspectRatio);
    });
  }

  protected async onLoad(): Promise<void> {
    this.meshObj = await this.loadMeshFromFile('mountains.obj');
  }

  protected onUpdate(): void {
    this.canvas.fill();

    const { lookDir, camera, moveDir } = this.calculateMovement()
    this.lookDir = lookDir;
    this.moveDir = moveDir;

    this.handleInput();

    const matWorld = this.createWorldMatrix();

    // Make view matrix from camera
    const matView = this.vecMat.matrixQuickInverse(camera);

    this.addObjToWorld(this.meshObj, matWorld, matView);
    this.drawCrossHair();
  }

  private addObjToWorld(mesh: Mesh, matWorld: Mat4x4, matView: Mat4x4) {
    const trianglesToRaster: Mesh = [];

    let meshIndex = mesh.length;
    while (meshIndex--) {

      const triangle: Triangle = this.meshObj[meshIndex];

      const triangleTransformed: Triangle = [
        this.vecMat.matrixMultiplyVector(matWorld, triangle[0]),
        this.vecMat.matrixMultiplyVector(matWorld, triangle[1]),
        this.vecMat.matrixMultiplyVector(matWorld, triangle[2])
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
          this.vecMat.matrixMultiplyVector(matView, triangleTransformed[0]),
          this.vecMat.matrixMultiplyVector(matView, triangleTransformed[1]),
          this.vecMat.matrixMultiplyVector(matView, triangleTransformed[2]),
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
          trianglesToRaster.push(triProjected);
        }
      }

    }

    // Sort triangles from back to front
    const triangleSorted = sort(trianglesToRaster).by([{
      desc: (tri: Triangle) => tri[0][2] + tri[1][2] + tri[2][2] / 3
    }]);

    let rasterIndex = triangleSorted.length;

    while (rasterIndex--) {
      const triangleList: Triangle[] = [triangleSorted[rasterIndex]];
      let newTriangles = 1;

      let i = 4; // for each side of screen
      while (i--) {
        let trianglesToAdd: Triangle[] = [];

        while (newTriangles > 0) {
          const test = (triangleList.shift() as Triangle);
          newTriangles--;

          switch (i) {
            case 0: // Top
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane([0, 0, 0], [0, 1, 0], test);
              break;

            case 1: // Bottom
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane([0, this.screenHeight - 1, 0], [0, -1, 0], test);
              break;

            case 2: // Left
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane([0, 0, 0], [1, 0, 0], test);
              break;

            case 3: // Right
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane([this.screenWidth - 1, 0, 0], [-1, 0, 0], test);
              break;
          }
          triangleList.push(...trianglesToAdd);
        }
        newTriangles = triangleList.length;
      }

      let triangleIndex = triangleList.length;
      while (triangleIndex--) {
        this.canvas.drawTriangle(triangleList[triangleIndex]);
      }

    }
  }

  private createWorldMatrix() {
    const matTrans = this.vecMat.matrixTranslation(0, 0, 8);
    const matIdent = this.vecMat.matrixCreateIdentity();
    return this.vecMat.matrixMultiplyMatrix(matIdent, matTrans);
  }

  private drawCrossHair() {
    this.canvas.draw(this.screenXCenter - 10, this.screenYCenter, this.screenXCenter + 10, this.screenYCenter, { color: { stroke: 'lime' } });
    this.canvas.draw(this.screenXCenter, this.screenYCenter - 10, this.screenXCenter, this.screenYCenter + 10, { color: { stroke: 'lime' } });
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
      if (this.xaw < this.maxXaw) {
        const xaw = this.xaw + this.lookSpeed * this.delta;
        this.xaw = xaw < this.maxXaw ? xaw : this.maxXaw;
      }
    }

    // Look down
    if (this.isKeyPressed('ArrowDown')) {
      if (this.xaw > this.minXaw) {
        const xaw = this.xaw - this.lookSpeed * this.delta;
        this.xaw = xaw > this.minXaw ? xaw : this.minXaw;
      }
    }

    // Toggle flying
    if (this.isKeyPressed('t') && !this.isToggleFlyingPressed) {
      this.isToggleFlyingPressed = true;
      this.isFlying = !this.isFlying;
    } else if (!this.isKeyPressed('t')) {
      this.isToggleFlyingPressed = false;
    }

    if (this.yaw >= this.maxYaw || this.yaw <= this.minYaw) {
      this.yaw = 0;
    }
  }

  private projection(aspectRatio: number) {
    return this.vecMat.matrixProjection(90, aspectRatio, this.near, this.far);
  }

  private calculateMovement() {
    const params: MovementParams = {
      vCamera: this.camera,
      vTarget: this.vTarget,
      vUp: this.vUp,
      xaw: this.xaw,
      yaw: this.yaw
    }

    return this.isFlying
      ? this.vecMat.movementFly(params)
      : this.vecMat.movementWalk(params);
  }

  private async loadMeshFromFile(fileName: string) {
    const data: string = await window.electron.readFile(fileName);

    const verts: Vec3d[] = [];
    const mesh: Mesh = [];

    const lines = data
      .split("\n")
      .map(line => line.trim().replace("\r", ''))
      .filter(line => line.charAt(0) !== '#')

    const splitLine = (line: string): ObjLine => {
      const values = line.split(' ');
      const [char, one, two, three] = values;

      const nOne = parseFloat(one);
      const nTwo = parseFloat(two);
      const nThree = parseFloat(three);

      return [char, nOne, nTwo, nThree];
    }

    const getVerts = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'v') {
        verts.push([one, two, three]);
      }
    }

    const getTris = (line: string) => {
      const [char, one, two, three] = splitLine(line);

      if (char === 'f') {
        const vertOne = verts[one - 1];
        const vertTwo = verts[two - 1];
        const vertThree = verts[three - 1];

        mesh.push([vertOne, vertTwo, vertThree]);
      }
    }

    lines.forEach(line => getVerts(line));
    lines.forEach(line => getTris(line));

    return mesh;
  }

}

const game = new Game();
game.run();