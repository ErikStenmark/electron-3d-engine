import { Electron } from './preload';
import VecMat, { Vec3d, Mat4x4, Triangle, MovementParams } from './vecmat';
import Canvas from './canvas';
import { sort } from 'fast-sort';

declare global { interface Window { electron: Electron; } }
type Mesh = Triangle[];
type ObjLine = [string, number, number, number];

class Main {
  private vecMat: VecMat;
  private canvas: Canvas;

  private near = 0.1;
  private far = 1000;
  private camera: Vec3d;
  private lookDir: Vec3d;
  private moveDir: Vec3d;

  private matProj: Mat4x4;
  private yaw: number;
  private xaw: number;

  private maxYaw = Math.PI * 2;
  private minYaw = -this.maxYaw;

  private maxXaw = Math.PI / 2 - 0.1;
  private minXaw = -this.maxXaw;

  private meshObj: Mesh = [];

  private vUp: Vec3d;

  private lookSpeed = 0.002;
  private upSpeed = 0.005;
  private movementSpeed = 0.005;

  private isFlying = true;
  private isToggleFlyingPressed = false;

  private vTarget: Vec3d;

  private screenWidth = 0;
  private screenHeight = 0;
  private xCenter = 0;
  private yCenter = 0;

  private avgFps: number;
  private avgDelta: number;
  private delta: number;
  private fps: number;
  private theta: number;

  private keysPressed: string[];

  constructor() {
    this.canvas = new Canvas();
    this.vecMat = new VecMat();
    this.yaw = 0;
    this.xaw = 0;
    this.camera = this.vecMat.vectorCreate(0);
    this.lookDir = this.vecMat.vectorCreate([0, 0, 1]);
    this.moveDir = this.vecMat.vectorCreate([0, 0, 1]);
    this.vUp = this.vecMat.vectorCreate([0, 1, 0]);
    this.matProj = this.projection(this.canvas.getAspectRatio());
    this.vTarget = this.vecMat.vectorCreate([0, 0, 1]);
    this.avgFps = 0;
    this.avgDelta = 0;
    this.keysPressed = [];
    this.delta = 0;
    this.fps = 0;
    this.theta = 0;

    this.screenDimensions();

    window.addEventListener('resize', () => {
      const aspectRatio = this.canvas.setSize(window.innerWidth, window.innerHeight);
      this.screenDimensions();
      this.matProj = this.projection(aspectRatio);
    });
  }

  public async onUserCreate() {
    this.meshObj = await this.loadMeshFromFile('mountains.obj');
  }

  public onUserUpdate(keysPressed: string[], delta: number, fps: number, theta: number, avgDelta: number) {
    this.canvas.fill();

    this.delta = delta;
    this.avgDelta = avgDelta;
    this.avgFps = fps;
    this.theta = theta;
    this.keysPressed = keysPressed;

    const { lookDir, camera, moveDir } = this.calculateMovement()
    this.lookDir = lookDir;
    this.moveDir = moveDir;

    this.handleInput();

    const matWorld = this.createWorldMatrix();

    // Make view matrix from camera
    const matView = this.vecMat.matrixQuickInverse(camera);

    this.addObjToWorld(this.meshObj, matWorld, matView);
    this.drawCrossHair();
    this.displayClockInfo();
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


          triProjected[0][0] *= this.xCenter;
          triProjected[0][1] *= this.yCenter;
          triProjected[1][0] *= this.xCenter;
          triProjected[1][1] *= this.yCenter;
          triProjected[2][0] *= this.xCenter;
          triProjected[2][1] *= this.yCenter;

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

  private screenDimensions() {
    const { width, height } = this.canvas.getSize();
    this.screenWidth = width;
    this.screenHeight = height;
    this.xCenter = width * 0.5;
    this.yCenter = height * 0.5;
  }

  private handleInput() {
    const vForward = this.vecMat.vectorMul(this.lookDir, this.movementSpeed * this.delta);

    const vForwardWithoutTilt = this.vecMat.vectorMul(this.moveDir, this.movementSpeed * this.delta);
    const vSideways = this.vecMat.vectorCrossProduct(vForwardWithoutTilt, this.vUp);

    // Move Up
    if (this.keysPressed.includes('e')) {
      this.camera[1] += this.upSpeed * this.delta;
    }

    // Move Down
    if (this.keysPressed.includes(' ')) {
      this.camera[1] -= this.upSpeed * this.delta;
    }

    // Move Left
    if (this.keysPressed.includes('a')) {
      this.camera = this.vecMat.vectorSub(this.camera, vSideways);
    }

    // Move Right
    if (this.keysPressed.includes('d')) {
      this.camera = this.vecMat.vectorAdd(this.camera, vSideways);
    }

    // Move Forward
    if (this.keysPressed.includes('w')) {
      this.camera = this.vecMat.vectorAdd(this.camera, vForward);
    }

    // Move Backwards
    if (this.keysPressed.includes('s')) {
      this.camera = this.vecMat.vectorSub(this.camera, vForward);
    }

    // Look Right
    if (this.keysPressed.includes('ArrowRight')) {
      this.yaw += this.lookSpeed * this.delta;
    }

    // Look left
    if (this.keysPressed.includes('ArrowLeft')) {
      this.yaw -= this.lookSpeed * this.delta;
    }

    // Look up
    if (this.keysPressed.includes('ArrowUp')) {
      if (this.xaw < this.maxXaw) {
        const xaw = this.xaw + this.lookSpeed * this.delta;
        this.xaw = xaw < this.maxXaw ? xaw : this.maxXaw;
      }
    }

    // Look down
    if (this.keysPressed.includes('ArrowDown')) {
      if (this.xaw > this.minXaw) {
        const xaw = this.xaw - this.lookSpeed * this.delta;
        this.xaw = xaw > this.minXaw ? xaw : this.minXaw;
      }
    }

    // Toggle flying
    if (this.keysPressed.includes('t') && !this.isToggleFlyingPressed) {
      this.isToggleFlyingPressed = true;
      this.isFlying = !this.isFlying;
    } else if (!this.keysPressed.includes('t')) {
      this.isToggleFlyingPressed = false;
    }

    if (this.yaw >= this.maxYaw || this.yaw <= this.minYaw) {
      this.yaw = 0;
    }
  }

  private createWorldMatrix() {
    const matTrans = this.vecMat.matrixTranslation(0, 0, 8);
    const matIdent = this.vecMat.matrixCreateIdentity();
    return this.vecMat.matrixMultiplyMatrix(matIdent, matTrans);
  }

  private drawCrossHair() {
    this.canvas.draw(this.xCenter - 10, this.yCenter, this.xCenter + 10, this.yCenter, { color: { stroke: 'lime' } });
    this.canvas.draw(this.xCenter, this.yCenter - 10, this.xCenter, this.yCenter + 10, { color: { stroke: 'lime' } });
  }

  private prependZero(number: number): string {
    return number < 10 ? `0${number}` : `${number}`
  }

  private msToHMS(ms: number) {
    let seconds = parseInt(`${ms / 1000}`, 10);
    const hours = parseInt(`${seconds / 3600}`, 10);
    seconds = seconds % 3600;
    const minutes = parseInt(`${seconds / 60}`, 10);
    seconds = seconds % 60;

    return `${this.prependZero(hours)}:${this.prependZero(minutes)}:${this.prependZero((seconds))}`;
  }

  private displayClockInfo() {
    const fpsText = `fps: ${this.avgFps}`;
    const delta = `delta: ${this.avgDelta}`;
    const elapsed = `elapsed: ${this.msToHMS(this.theta)}`;
    this.canvas.drawText(`${fpsText} ${delta} ${elapsed}`, this.xCenter, 20, { align: 'center', color: 'lime' });
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

    const data: string = await window.electron.getObj(fileName);

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

(async () => {
  const main = new Main();
  await main.onUserCreate();

  const loop = () => {
    window.requestAnimationFrame(gameLoop);
  }

  let keysPressed: string[] = [];

  const onKeyDown = (e: KeyboardEvent) => {
    if (!keysPressed.includes(e.key)) {
      keysPressed.push(e.key);
    }
  }

  const onKeyUp = (e: KeyboardEvent) => {
    keysPressed = keysPressed.filter(k => k !== e.key);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  let fps = 0;
  let delta = 0;
  let previousFrameTime = 0;
  let elapsedTimeTotal = 0;

  let timeArrPos = 0;
  const timeArrLengthMax = 10;

  const fpsArr: number[] = [];
  const deltaArr: number[] = [];

  const gameLoop = () => {
    const timeNow = new Date().getTime();
    delta = previousFrameTime === 0 ? 0 : timeNow - previousFrameTime;
    elapsedTimeTotal += delta;
    previousFrameTime = timeNow;

    const deltaInSeconds = delta / 1000;
    fps = Math.round(1 / deltaInSeconds);

    timeArrPos = timeArrPos >= timeArrLengthMax ? 0 : timeArrPos;
    fpsArr[timeArrPos] = fps;
    deltaArr[timeArrPos] = delta;

    const fpsTot = fpsArr.reduce((partialSum, a) => partialSum + a, 0);
    const deltaTot = deltaArr.reduce((partialSum, a) => partialSum + a, 0);

    const deltaAvg = Math.round(deltaTot / fpsArr.length);
    const fpsAvg = Math.round(fpsTot / fpsArr.length);

    main.onUserUpdate(keysPressed, delta, fpsAvg, elapsedTimeTotal, deltaAvg);
    loop();
  }

  loop();
})();