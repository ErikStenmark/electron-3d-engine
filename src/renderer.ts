import { Electron } from './preload';
import VecMat, { Vec3d, Mat4x4, Triangle } from './vecmat';
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

  private matProj: Mat4x4;
  private yaw: number;
  private xaw: number;

  private maxYaw = 6;
  private minYaw = -this.maxYaw;

  private maxXaw = 1.5;
  private minXaw = -this.maxXaw;

  private theta: number = 0;
  private frame: number = 0;

  private meshObj: Mesh = [];

  constructor() {
    this.canvas = new Canvas();
    this.vecMat = new VecMat();
    this.yaw = 0;
    this.xaw = 0;
    this.camera = this.vecMat.vectorCreate(0);
    this.lookDir = this.vecMat.vectorCreate([0, 0, 1]);
    this.matProj = this.projection(this.canvas.getAspectRatio());

    window.addEventListener('resize', () => {
      const aspectRatio = this.canvas.setSize(window.innerWidth, window.innerHeight);
      this.matProj = this.projection(aspectRatio);
    });
  }

  public async onUserCreate() {
    this.meshObj = await this.loadMeshFromFile('axis.obj');
  }

  public onUserUpdate(keysPressed: string[]) {
    this.canvas.fill();

    const lookSpeed = 0.1;
    const movementSpeed = lookSpeed + 1;

    const vUp = this.vecMat.vectorCreate([0, 1, 0]);
    const vForward = this.vecMat.vectorMul(this.lookDir, movementSpeed);
    const vSideways = this.vecMat.vectorCrossProduct(vForward, vUp);

    // move Up
    if (keysPressed.includes('e')) {
      this.camera.y += 1;
    }

    // move Down
    if (keysPressed.includes(' ')) {
      this.camera.y -= 1;
    }

    // move Left
    if (keysPressed.includes('a')) {
      this.camera = this.vecMat.vectorSub(this.camera, vSideways);
    }

    // move Right
    if (keysPressed.includes('d')) {
      this.camera = this.vecMat.vectorAdd(this.camera, vSideways);
    }

    // move forward
    if (keysPressed.includes('w')) {
      this.camera = this.vecMat.vectorAdd(this.camera, vForward);
    }

    // move backwards
    if (keysPressed.includes('s')) {
      this.camera = this.vecMat.vectorSub(this.camera, vForward);
    }

    // look Right
    if (keysPressed.includes('ArrowRight')) {
      this.yaw += lookSpeed;
    }

    // look left
    if (keysPressed.includes('ArrowLeft')) {
      this.yaw -= lookSpeed;
    }

    // look up
    if (keysPressed.includes('ArrowUp')) {
      if (this.xaw > this.minXaw) {
        this.xaw -= lookSpeed;
      }
    }

    // look down
    if (keysPressed.includes('ArrowDown')) {
      if (this.xaw < this.maxXaw) {
        this.xaw += lookSpeed;
      }
    }

    if (this.yaw >= this.maxYaw || this.yaw <= this.minYaw) {
      this.yaw = 0;
    }

    // this.theta = 0.01 * this.frame;

    const matRotZ: Mat4x4 = this.vecMat.matrixRotationZ(this.theta * 0.5);
    const matRotX: Mat4x4 = this.vecMat.matrixRotationX(this.theta);

    const matTrans = this.vecMat.matrixTranslation(0, 0, 8);

    let matWorld = this.vecMat.matrixCreateIdentity();
    matWorld = this.vecMat.matrixMultiplyMatrix(matRotZ, matRotX);
    matWorld = this.vecMat.matrixMultiplyMatrix(matWorld, matTrans);

    let vTarget = this.vecMat.vectorCreate([0, 0, 1]);

    const matCameraRot = this.vecMat.matrixRotationY(this.yaw);
    this.lookDir = this.vecMat.matrixMultiplyVector(matCameraRot, vTarget);

    const matCameraTilt = this.vecMat.matrixRotationX(this.xaw);
    this.lookDir = this.vecMat.matrixMultiplyVector(matCameraTilt, this.lookDir);

    vTarget = this.vecMat.vectorAdd(this.camera, this.lookDir);

    const matCamera = this.vecMat.matrixPointAt(this.camera, vTarget, vUp);

    // Make view matrix from camera
    const matView = this.vecMat.matrixQuickInverse(matCamera);

    const trianglesToRaster: Mesh = [];

    let meshIndex = this.meshObj.length;

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
        const lightDirection: Vec3d = this.vecMat.vectorNormalize({ x: 0, y: 1, z: -1 });

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
          { x: 0, y: 0, z: 0.1 },
          { x: 0, y: 0, z: 1 },
          triViewed
        );

        for (const clipped of clippedTriangles) {

          // Project from 3D --> 2D
          const triProjected: Triangle = [
            this.vecMat.matrixMultiplyVector(this.matProj, clipped[0]),
            this.vecMat.matrixMultiplyVector(this.matProj, clipped[1]),
            this.vecMat.matrixMultiplyVector(this.matProj, clipped[2]),
            clipped[3]
          ];

          // normalize into cartesian space
          triProjected[0] = this.vecMat.vectorDiv(triProjected[0], triProjected[0].w);
          triProjected[1] = this.vecMat.vectorDiv(triProjected[1], triProjected[1].w);
          triProjected[2] = this.vecMat.vectorDiv(triProjected[2], triProjected[2].w);

          // // X/Y is inverted
          // triProjected[0].x *= -1;
          // triProjected[1].x *= -1;
          // triProjected[2].x *= -1;
          // triProjected[0].y *= -1;
          // triProjected[1].y *= -1;
          // triProjected[2].y *= -1;

          // Offset verts into visible normalized space
          const offsetView = this.vecMat.vectorCreate([1, 1, 0]);
          triProjected[0] = this.vecMat.vectorAdd(triProjected[0], offsetView);
          triProjected[1] = this.vecMat.vectorAdd(triProjected[1], offsetView);
          triProjected[2] = this.vecMat.vectorAdd(triProjected[2], offsetView);

          const { width, height } = this.canvas.getSize();

          triProjected[0].x *= 0.5 * width;
          triProjected[0].y *= 0.5 * height;
          triProjected[1].x *= 0.5 * width;
          triProjected[1].y *= 0.5 * height;
          triProjected[2].x *= 0.5 * width;
          triProjected[2].y *= 0.5 * height;

          // Store triangles for sorting
          trianglesToRaster.push(triProjected);
        }
      }

    }

    // Sort triangles from back to front
    const triangleSorted = sort(trianglesToRaster).by([{
      desc: (tri: Triangle) => tri[0].z + tri[1].z + tri[2].z / 3
    }]);

    let rasterIndex = triangleSorted.length;

    const { height, width } = this.canvas.getSize();

    while (rasterIndex--) {
      const triangleList: Triangle[] = [triangleSorted[rasterIndex]];
      let newTriangles = 1;

      // for each side of screen
      for (let p = 0; p < 4; p++) {
        let trianglesToAdd: Triangle[] = [];

        while (newTriangles > 0) {
          const test = (triangleList.shift() as Triangle);
          newTriangles--;

          switch (p) {
            case 0: // Top
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, test);
              break;

            case 1: // Bottom
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane({ x: 0, y: height - 1, z: 0 }, { x: 0, y: -1, z: 0 }, test);
              break;

            case 2: // Left
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, test);
              break;

            case 3: // Right
              trianglesToAdd = this.vecMat.triangleClipAgainstPlane({ x: width - 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, test);
              break;
          }

          triangleList.push(...trianglesToAdd);
        }

        newTriangles = triangleList.length;
      }

      for (const tri of triangleList) {
        this.canvas.drawTriangle(tri, {
          fill: true,
          color: {
            fill: tri[3] || 'red',
            stroke: tri[3] || 'red'
          }
        });
      }

    }

  }

  public setFrame(frame: number) {
    this.frame = frame;
  }

  private projection(aspectRatio: number) {
    return this.vecMat.matrixProjection(90, aspectRatio, this.near, this.far);
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
        verts.push({ x: one, y: two, z: three });
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
    const frame = window.requestAnimationFrame(gameLoop);
    main.setFrame(frame);
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

  const gameLoop = () => {
    main.onUserUpdate(keysPressed);
    loop();
  }

  loop();
})();