type Vec3d = {
  x: number;
  y: number;
  z: number;
}

type Triangle = [Vec3d, Vec3d, Vec3d, string?];

type Mesh = Triangle[];

type MatRow = [number, number, number, number];
type Mat4x4 = [MatRow, MatRow, MatRow, MatRow];

type DrawTriangleOpts = {
  fill?: boolean;
  color?: { fill?: string; stroke?: string }
}

type ObjLine = [string, number, number, number];

class Main {
  private canvas: HTMLCanvasElement;
  private body: HTMLBodyElement;
  private meshObj: Mesh = [];
  private isFullScreen = false;
  private ctx: CanvasRenderingContext2D | null;
  private screenWidth: number;
  private screenHeight: number;
  private theta: number = 0;
  private frame: number = 0;
  private camera: Vec3d = { x: 0, y: 0, z: 0 }
  private matProj: Mat4x4;

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

    this.matProj = this.createProjectionMatrix();

    window.addEventListener('resize', () => {
      this.screenWidth = window.innerWidth;
      this.screenHeight = window.innerHeight;
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      this.matProj = this.createProjectionMatrix();
    });
  }

  public async onUserCreate() {
    this.meshObj = await this.loadMeshFromFile('videoShip.obj');
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

      const trianglesToRaster: Mesh = [];

      for (const triangle of this.meshObj) {

        // Rotate in Z-Axis
        const triRotatedZ: Triangle = [
          this.MultiplyMatrixVector(triangle[0], matRotZ),
          this.MultiplyMatrixVector(triangle[1], matRotZ),
          this.MultiplyMatrixVector(triangle[2], matRotZ),
        ];

        // Rotate in X-Axis
        const triRotatedX: Triangle = [
          this.MultiplyMatrixVector(triRotatedZ[0], matRotX),
          this.MultiplyMatrixVector(triRotatedZ[1], matRotX),
          this.MultiplyMatrixVector(triRotatedZ[2], matRotX),
        ];

        // Offset into the screen
        const triTranslated = triRotatedX;
        triTranslated[0].z += 8;
        triTranslated[1].z += 8;
        triTranslated[2].z += 8;

        const line1: Vec3d = {
          x: triTranslated[1].x - triTranslated[0].x,
          y: triTranslated[1].y - triTranslated[0].y,
          z: triTranslated[1].z - triTranslated[0].z
        }

        const line2: Vec3d = {
          x: triTranslated[2].x - triTranslated[0].x,
          y: triTranslated[2].y - triTranslated[0].y,
          z: triTranslated[2].z - triTranslated[0].z
        }

        const normal: Vec3d = {
          x: line1.y * line2.z - line1.z * line2.y,
          y: line1.z * line2.x - line1.x * line2.z,
          z: line1.x * line2.y - line1.y * line2.x,
        }

        const normalLength = Math.sqrt(
          normal.x * normal.x +
          normal.y * normal.y +
          normal.z * normal.z
        );

        normal.x /= normalLength;
        normal.y /= normalLength;
        normal.z /= normalLength;

        // if (normal.z < 0) {
        if (
          normal.x * (triTranslated[0].x - this.camera.x) +
          normal.y * (triTranslated[0].y - this.camera.y) +
          normal.z * (triTranslated[0].z - this.camera.z) < 0
        ) {
          // Illumination
          const lightDirection: Vec3d = { x: 0, y: 0, z: -1 };

          const lightDirectionLength = Math.sqrt(
            lightDirection.x * lightDirection.x +
            lightDirection.y * lightDirection.y +
            lightDirection.z * lightDirection.z
          );

          lightDirection.x /= lightDirectionLength;
          lightDirection.y /= lightDirectionLength;
          lightDirection.z /= lightDirectionLength;

          const lightDp = normal.x * lightDirection.x + normal.y * lightDirection.y + normal.z * lightDirection.z;
          const triangleColor = this.RGBGrayScale(lightDp);

          // Project from 3D --> 2D
          const triProjected: Triangle = [
            this.MultiplyMatrixVector(triTranslated[0], this.matProj),
            this.MultiplyMatrixVector(triTranslated[1], this.matProj),
            this.MultiplyMatrixVector(triTranslated[2], this.matProj),
            triangleColor
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

          // Store triangles for sorting
          trianglesToRaster.push(triProjected);
        }
      }

      // Sort triangles from back to front
      trianglesToRaster.sort((a, b) => {
        const zA = a[0].z + a[1].z + a[2].z / 3;
        const zB = b[0].z + b[1].z + b[2].z / 3;

        if (zA === zB) {
          return 0;
        }

        return zA > zB ? -1 : 1;
      });

      for (const triangle of trianglesToRaster) {
        this.drawTriangle(triangle, {
          fill: true,
          color: {
            fill: triangle[3] || 'red',
            stroke: triangle[3] || 'red'
          }
        })
      }
    }
  }

  public setFrame(frame: number) {
    this.frame = frame;
  }

  private drawTriangle(triangle: Triangle, opts?: DrawTriangleOpts) {
    if (!!this.ctx) {
      this.ctx.strokeStyle = opts?.color?.stroke || "rgba(255, 255, 255, 1)";
      this.ctx.fillStyle = opts?.color?.fill || "rgba(255, 255, 255, 1)";

      this.ctx.beginPath();
      this.ctx.moveTo(triangle[0].x, triangle[0].y);
      this.ctx.lineTo(triangle[1].x, triangle[1].y);
      this.ctx.lineTo(triangle[2].x, triangle[2].y);
      this.ctx.closePath();
      this.ctx.stroke();

      if (opts?.fill) {
        this.ctx.fill()
      }

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

  private createProjectionMatrix(): Mat4x4 {
    const near = 0.1;
    const far = 1000;
    const fov = 90
    const aspectRatio = this.screenHeight / this.screenWidth;
    const fovRad = 1 / Math.tan(fov * 0.5 / 180 * Math.PI);

    const matrix = this.createMatrix();

    matrix[0][0] = aspectRatio * fovRad;
    matrix[1][1] = fovRad;
    matrix[2][2] = far / (far - near);
    matrix[3][2] = (-far * near) / (far - near);
    matrix[2][3] = 1;
    matrix[3][3] = 0;

    return matrix;
  }

  private MultiplyMatrixVector(vec: Vec3d, mat: Mat4x4): Vec3d {
    const output: Vec3d = {
      x: vec.x * mat[0][0] + vec.y * mat[1][0] + vec.z * mat[2][0] + mat[3][0],
      y: vec.x * mat[0][1] + vec.y * mat[1][1] + vec.z * mat[2][1] + mat[3][1],
      z: vec.x * mat[0][2] + vec.y * mat[1][2] + vec.z * mat[2][2] + mat[3][2]
    }

    const w = vec.x * mat[0][3] + vec.y * mat[1][3] + vec.z * mat[2][3] + mat[3][3];

    if (w !== 0) {
      output.x /= w;
      output.y /= w;
      output.z /= w;
    }

    return output;
  }

  private RGBGrayScale(value: number) {
    const col = value * 255;
    return `rgba(${col}, ${col + 1}, ${col + 2}, 1)`
  }

  public async loadMeshFromFile(fileName: string) {
    // @ts-ignore
    const data: string = await electron.getObj(fileName);

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

    console.log('verts length', verts.length);
    console.log('mesh length', mesh.length);

    return mesh;
  }

}

(async () => {
  const main = new Main();
  await main.onUserCreate();
  main.loadMeshFromFile('videoShip.obj');

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