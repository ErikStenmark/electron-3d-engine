type Vec3d = {
  x: number;
  y: number;
  z: number;
}

type Triangle = [Vec3d, Vec3d, Vec3d];

type Mesh = Triangle[];

type MatRow = [number, number, number, number];
type Mat4x4 = [MatRow, MatRow, MatRow, MatRow];

class Main {
  private canvas: HTMLCanvasElement;
  private body: HTMLBodyElement;
  private meshCube: Mesh = [];
  private isFullScreen = false;
  private ctx: CanvasRenderingContext2D | null;
  private screenWidth: number;
  private screenHeight: number;
  private theta: number = 0;
  private frame: number = 0;

  private matProj: Mat4x4 = this.createMatrix();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = "canvas";
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
    this.canvas.width = this.screenWidth;
    this.canvas.height = this.screenHeight;
    this.canvas.style.zIndex = '8';
    this.canvas.style.position = "absolute";

    this.body = document.getElementsByTagName("body")[0];
    this.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext("2d");

    window.addEventListener('resize', () => {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
  }

  public onUserCreate() {
    this.meshCube = [
      // SOUTH
      [{ x: 0.0, y: 0.0, z: 0.0 }, { x: 0.0, y: 1.0, z: 0.0 }, { x: 1.0, y: 1.0, z: 0.0 }],
      [{ x: 0.0, y: 0.0, z: 0.0 }, { x: 1.0, y: 1.0, z: 0.0 }, { x: 1.0, y: 0.0, z: 0.0 }],

      // EAST
      [{ x: 1.0, y: 0.0, z: 0.0 }, { x: 1.0, y: 1.0, z: 0.0 }, { x: 1.0, y: 1.0, z: 1.0 }],
      [{ x: 1.0, y: 0.0, z: 0.0 }, { x: 1.0, y: 1.0, z: 1.0 }, { x: 1.0, y: 0.0, z: 1.0 }],

      // NORTH
      [{ x: 1.0, y: 0.0, z: 1.0 }, { x: 1.0, y: 1.0, z: 1.0 }, { x: 0.0, y: 1.0, z: 1.0 }],
      [{ x: 1.0, y: 0.0, z: 1.0 }, { x: 0.0, y: 1.0, z: 1.0 }, { x: 0.0, y: 0.0, z: 1.0 }],

      // WEST
      [{ x: 0.0, y: 0.0, z: 1.0 }, { x: 0.0, y: 1.0, z: 1.0 }, { x: 0.0, y: 1.0, z: 0.0 }],
      [{ x: 0.0, y: 0.0, z: 1.0 }, { x: 0.0, y: 1.0, z: 0.0 }, { x: 0.0, y: 0.0, z: 0.0 }],

      // TOP
      [{ x: 0.0, y: 1.0, z: 0.0 }, { x: 0.0, y: 1.0, z: 1.0 }, { x: 1.0, y: 1.0, z: 1.0 }],
      [{ x: 0.0, y: 1.0, z: 0.0 }, { x: 1.0, y: 1.0, z: 1.0 }, { x: 1.0, y: 1.0, z: 0.0 }],

      // BOTTOM
      [{ x: 1.0, y: 0.0, z: 1.0 }, { x: 0.0, y: 0.0, z: 1.0 }, { x: 0.0, y: 0.0, z: 0.0 }],
      [{ x: 1.0, y: 0.0, z: 1.0 }, { x: 0.0, y: 0.0, z: 0.0 }, { x: 1.0, y: 0.0, z: 0.0 }],
    ];

    // Projection Matrix
    const near = 0.1;
    const far = 1000.0;
    const fov = 90.0
    const aspectRatio = this.screenHeight / this.screenWidth;
    const fovRad = 1.0 / Math.tan(fov * 0.5 / 180 * Math.PI);

    this.matProj[0][0] = aspectRatio * fovRad;
    this.matProj[1][1] = fovRad;
    this.matProj[2][2] = far / (far - near);
    this.matProj[3][2] = (-far * near) / (far - near);
    this.matProj[2][3] = 1.0;
    this.matProj[3][3] = 0.0;
  }

  public onUserUpdate() {
    if (!!this.ctx) {
      this.ctx.fillStyle = "rgba(0, 0, 0, 1)"
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const matRotZ: Mat4x4 = this.createMatrix();
      const matRotX: Mat4x4 = this.createMatrix();

      this.theta = 0.01 * this.frame;

      // Rotation Z
      matRotZ[0][0] = Math.cos(this.theta);
      matRotZ[0][1] = Math.sin(this.theta);
      matRotZ[1][0] = -Math.sin(this.theta);
      matRotZ[1][1] = Math.cos(this.theta);
      matRotZ[2][2] = 1;
      matRotZ[3][3] = 1;

      // Rotation X
      matRotX[0][0] = 1;
      matRotX[1][1] = Math.cos(this.theta * 0.5);
      matRotX[1][2] = Math.sin(this.theta * 0.5);
      matRotX[2][1] = -Math.sin(this.theta * 0.5);
      matRotX[2][2] = Math.cos(this.theta * 0.5);
      matRotX[3][3] = 1;

      for (const triangle of this.meshCube) {

        const triRotatedZ: Triangle = [
          this.MultiplyMatrixVector(triangle[0], matRotZ),
          this.MultiplyMatrixVector(triangle[1], matRotZ),
          this.MultiplyMatrixVector(triangle[2], matRotZ),
        ];

        const triRotatedX: Triangle = [
          this.MultiplyMatrixVector(triRotatedZ[0], matRotX),
          this.MultiplyMatrixVector(triRotatedZ[1], matRotX),
          this.MultiplyMatrixVector(triRotatedZ[2], matRotX),
        ];

        const triTranslated = triRotatedX;
        triTranslated[0].z = triangle[0].z + 3;
        triTranslated[1].z = triangle[1].z + 3;
        triTranslated[2].z = triangle[2].z + 3;

        const triProjected: Triangle = [
          this.MultiplyMatrixVector(triTranslated[0], this.matProj),
          this.MultiplyMatrixVector(triTranslated[1], this.matProj),
          this.MultiplyMatrixVector(triTranslated[2], this.matProj)
        ]

        // Scale into view
        triProjected[0].x += 1; triProjected[0].y += 1;
        triProjected[1].x += 1; triProjected[1].y += 1;
        triProjected[2].x += 1; triProjected[2].y += 1;

        triProjected[0].x *= 0.5 * this.screenWidth;
        triProjected[0].y *= 0.5 * this.screenHeight;
        triProjected[1].x *= 0.5 * this.screenWidth;
        triProjected[1].y *= 0.5 * this.screenHeight;
        triProjected[2].x *= 0.5 * this.screenWidth;
        triProjected[2].y *= 0.5 * this.screenHeight;

        this.drawTriangle(triProjected);
      }
    }
  }

  public setFrame(frame: number) {
    this.frame = frame;
  }

  private drawTriangle(triangle: Triangle) {
    if (!!this.ctx) {
      this.ctx.strokeStyle = "rgba(255, 255, 255, 1)";

      this.ctx.beginPath();
      this.ctx.moveTo(triangle[0].x, triangle[0].y);
      this.ctx.lineTo(triangle[1].x, triangle[1].y);
      this.ctx.lineTo(triangle[2].x, triangle[2].y);
      this.ctx.closePath();
      this.ctx.stroke();
    }
  }

  private createMatrix(): Mat4x4 {
    return [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
  }

  private MultiplyMatrixVector(i: Vec3d, m: Mat4x4): Vec3d {

    const w = i.x * m[0][3] + i.y * m[1][3] + i.z * m[2][3] + m[3][3];

    const newVector: Vec3d = {
      x: i.x * m[0][0] + i.y * m[1][0] + i.z * m[2][0] + m[3][0],
      y: i.x * m[0][1] + i.y * m[1][1] + i.z * m[2][1] + m[3][1],
      z: i.x * m[0][2] + i.y * m[1][2] + i.z * m[2][2] + m[3][2]
    }

    if (w !== 0.0) {
      newVector.x = newVector.x / w;
      newVector.y = newVector.y / w;
      newVector.z = newVector.z / w;
    }

    return newVector;
  }

}

(async () => {
  const main = new Main();
  main.onUserCreate();

  const loop = () => {
    const frame = window.requestAnimationFrame(gameLoop);
    main.setFrame(frame);
  }

  const gameLoop = () => {
    main.onUserUpdate();
    loop();
  }

  loop();
})();