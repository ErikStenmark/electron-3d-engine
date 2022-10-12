export type Vec3d = {
  x: number;
  y: number;
  z: number;
  w?: number;
}

export type Triangle = [Vec3d, Vec3d, Vec3d, string?];

type MatRow = [number, number, number, number];
export type Mat4x4 = [MatRow, MatRow, MatRow, MatRow];

export default class VecMat {

  public vectorCreate(n?: Vec3d | number | number[]): Vec3d {
    const vector: Vec3d = { x: 0, y: 0, z: 0, w: 1 }

    if (Array.isArray(n) && !!n.length) {
      vector.x = n[0];
      vector.y = n[1] || vector.y;
      vector.z = n[2] || vector.z;
      vector.w = n[3] || vector.w;
    }

    if (typeof n === 'number') {
      vector.x = n;
      vector.y = n;
      vector.z = n;
    }

    if (typeof n === 'object' && !Array.isArray(n)) {
      return n;
    }

    return vector;
  }

  public vectorAdd(v1: Vec3d, v2: Vec3d): Vec3d {
    return {
      x: v1.x + v2.x,
      y: v1.y + v2.y,
      z: v1.z + v2.z
    }
  }

  public vectorSub(v1: Vec3d, v2: Vec3d): Vec3d {
    return {
      x: v1.x - v2.x,
      y: v1.y - v2.y,
      z: v1.z - v2.z
    }
  }

  public vectorMul(v1: Vec3d, v2?: Vec3d | number): Vec3d {
    const vec2 = this.vectorCreate(v2 || 0);
    return {
      x: v1.x * vec2.x,
      y: v1.y * vec2.y,
      z: v1.z * vec2.z
    }
  }

  public vectorDiv(v1: Vec3d, v2?: Vec3d | number): Vec3d {
    const vec2 = this.vectorCreate(v2 || 1);
    return {
      x: v1.x / vec2.x,
      y: v1.y / vec2.y,
      z: v1.z / vec2.z
    }
  }

  public vectorDotProd(v1: Vec3d, v2: Vec3d): number {
    return (
      v1.x * v2.x +
      v1.y * v2.y +
      v1.z * v2.z
    );
  }

  public vectorLength(v: Vec3d): number {
    return Math.sqrt(this.vectorDotProd(v, v));
  }

  public vectorNormalize(v: Vec3d): Vec3d {
    const l = this.vectorLength(v);
    return {
      x: v.x / l,
      y: v.y / l,
      z: v.z / l
    }
  }

  public vectorCrossProduct(v1: Vec3d, v2: Vec3d): Vec3d {
    return {
      x: v1.y * v2.z - v1.z * v2.y,
      y: v1.z * v2.x - v1.x * v2.z,
      z: v1.x * v2.y - v1.y * v2.x
    }
  }

  public vectorIntersectPlane(planeP: Vec3d, planeN: Vec3d, lineStart: Vec3d, lineEnd: Vec3d) {
    planeN = this.vectorNormalize(planeN);
    const planeD = -this.vectorDotProd(planeN, planeP);
    const ad = this.vectorDotProd(lineStart, planeN);
    const bd = this.vectorDotProd(lineEnd, planeN);
    const t = (-planeD - ad) / (bd - ad);
    const lineStartToEnd = this.vectorSub(lineEnd, lineStart);
    const lineToIntersect = this.vectorMul(lineStartToEnd, t);
    return this.vectorAdd(lineStart, lineToIntersect);
  }

  public triangleClipAgainstPlane(planeP: Vec3d, planeN: Vec3d, inTri: Triangle, debug = false) {
    planeN = this.vectorNormalize(planeN);

    const dist = (p: Vec3d) => {
      return (planeN.x * p.x + planeN.y * p.y + planeN.z * p.z - this.vectorDotProd(planeN, planeP));
    }

    const createTriangle = (): Triangle => {
      return [
        this.vectorCreate(),
        this.vectorCreate(),
        this.vectorCreate(),
        ''
      ]
    }

    const insidePoints: Vec3d[] = [];
    const outsidePoints: Vec3d[] = [];

    let insidePointsCount = 0;
    let outsidePointsCount = 0;

    const d0 = dist(inTri[0]);
    const d1 = dist(inTri[1]);
    const d2 = dist(inTri[2]);

    if (d0 >= 0) insidePoints[insidePointsCount++] = inTri[0];
    else outsidePoints[outsidePointsCount++] = inTri[0];
    if (d1 >= 0) insidePoints[insidePointsCount++] = inTri[1];
    else outsidePoints[outsidePointsCount++] = inTri[1];
    if (d2 >= 0) insidePoints[insidePointsCount++] = inTri[2];
    else outsidePoints[outsidePointsCount++] = inTri[2];

    if (insidePointsCount === 0) {
      return [];
    }

    if (insidePointsCount === 3) {
      return [inTri];
    }

    if (insidePointsCount === 1 && outsidePointsCount === 2) {
      const outTri1 = createTriangle();
      outTri1[3] = debug ? 'blue' : inTri[3];
      outTri1[0] = insidePoints[0];

      outTri1[1] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[0]);
      outTri1[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[1]);

      return [outTri1];
    }

    if (insidePointsCount === 2 && outsidePointsCount === 1) {
      const outTri1 = createTriangle()
      outTri1[3] = debug ? 'green' : inTri[3];
      outTri1[0] = insidePoints[0];
      outTri1[1] = insidePoints[1];
      outTri1[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[0]);

      const outTri2 = createTriangle();
      outTri2[3] = debug ? 'red' : inTri[3];
      outTri2[0] = insidePoints[1];
      outTri2[1] = outTri1[2];
      outTri2[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[1], outsidePoints[0]);

      return [outTri1, outTri2];
    }

    return [];
  }

  public matrixCreate(arr?: number[][]): Mat4x4 {
    const row: MatRow = [0, 0, 0, 0];

    const matrix: Mat4x4 = [
      [...row],
      [...row],
      [...row],
      [...row],
    ];

    if (arr) {
      matrix[0][0] = arr[0][0] || 0;
      matrix[0][1] = arr[0][1] || 0;
      matrix[0][2] = arr[0][2] || 0;
      matrix[0][3] = arr[0][3] || 0;

      matrix[1][0] = arr[1][0] || 0;
      matrix[1][1] = arr[1][1] || 0;
      matrix[1][2] = arr[1][2] || 0;
      matrix[1][3] = arr[1][3] || 0;

      matrix[2][0] = arr[2][0] || 0;
      matrix[2][1] = arr[2][1] || 0;
      matrix[2][2] = arr[2][2] || 0;
      matrix[2][3] = arr[2][3] || 0;

      matrix[3][0] = arr[3][0] || 0;
      matrix[3][1] = arr[3][1] || 0;
      matrix[3][2] = arr[3][2] || 0;
      matrix[3][3] = arr[3][3] || 0;
    }

    return matrix;
  }

  public matrixCreateIdentity(): Mat4x4 {
    const matrix = this.matrixCreate();
    matrix[0][0] = 1;
    matrix[1][1] = 1;
    matrix[2][2] = 1;
    matrix[3][3] = 1;
    return matrix
  }

  public matrixMultiplyVector(m: Mat4x4, v: Vec3d): Vec3d {
    const w = v.w || 1;

    return {
      x: v.x * m[0][0] + v.y * m[1][0] + v.z * m[2][0] + w * m[3][0],
      y: v.x * m[0][1] + v.y * m[1][1] + v.z * m[2][1] + w * m[3][1],
      z: v.x * m[0][2] + v.y * m[1][2] + v.z * m[2][2] + w * m[3][2],
      w: v.x * m[0][3] + v.y * m[1][3] + v.z * m[2][3] + w * m[3][3]
    }
  }

  public matrixRotationX(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    matrix[0][0] = 1;
    matrix[1][1] = Math.cos(angleRad);
    matrix[1][2] = Math.sin(angleRad);
    matrix[2][1] = -Math.sin(angleRad);
    matrix[2][2] = Math.cos(angleRad);
    matrix[3][3] = 1;
    return matrix
  }

  public matrixRotationY(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    matrix[0][0] = Math.cos(angleRad);
    matrix[0][2] = Math.sin(angleRad);
    matrix[2][0] = -Math.sin(angleRad);
    matrix[1][1] = 1;
    matrix[2][2] = Math.cos(angleRad);
    matrix[3][3] = 1;
    return matrix
  }

  public matrixRotationZ(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    matrix[0][0] = Math.cos(angleRad);
    matrix[0][1] = Math.sin(angleRad);
    matrix[1][0] = -Math.sin(angleRad);
    matrix[1][1] = Math.cos(angleRad)
    matrix[2][2] = 1;
    matrix[3][3] = 1;
    return matrix
  }

  public matrixTranslation(x: number, y: number, z: number): Mat4x4 {
    const matrix = this.matrixCreateIdentity();
    matrix[3][0] = x;
    matrix[3][1] = y;
    matrix[3][2] = z;
    return matrix;
  }

  public matrixProjection(fovDeg: number, aspectRatio: number, near: number, far: number): Mat4x4 {
    const fovRad = 1 / Math.tan(fovDeg * 0.5 / 180 * Math.PI);
    const matrix = this.matrixCreate();
    matrix[0][0] = aspectRatio * fovRad;
    matrix[1][1] = fovRad;
    matrix[2][2] = far / (far - near);
    matrix[3][2] = (-far * near) / (far - near);
    matrix[2][3] = -1;
    matrix[3][3] = 0;
    return matrix;
  }

  public matrixMultiplyMatrix(m1: Mat4x4, m2: Mat4x4): Mat4x4 {
    const matrix = this.matrixCreate();
    let c = 4;

    while (c--) {
      let r = 4;
      while (r--) {
        matrix[r][c] = m1[r][0] * m2[0][c] + m1[r][1] * m2[1][c] + m1[r][2] * m2[2][c] + m1[r][3] * m2[3][c];
      }
    }
    return matrix;
  }

  public matrixQuickInverse(m: Mat4x4): Mat4x4 { // Only for Rotation/Translation Matrices
    const matrix = this.matrixCreate();
    matrix[0][0] = m[0][0]; matrix[0][1] = m[1][0]; matrix[0][2] = m[2][0]; matrix[0][3] = 0;
    matrix[1][0] = m[0][1]; matrix[1][1] = m[1][1]; matrix[1][2] = m[2][1]; matrix[1][3] = 0;
    matrix[2][0] = m[0][2]; matrix[2][1] = m[1][2]; matrix[2][2] = m[2][2]; matrix[2][3] = 0;
    matrix[3][0] = -(m[3][0] * matrix[0][0] + m[3][1] * matrix[1][0] + m[3][2] * matrix[2][0]);
    matrix[3][1] = -(m[3][0] * matrix[0][1] + m[3][1] * matrix[1][1] + m[3][2] * matrix[2][1]);
    matrix[3][2] = -(m[3][0] * matrix[0][2] + m[3][1] * matrix[1][2] + m[3][2] * matrix[2][2]);
    matrix[3][3] = 1;
    return matrix;
  }

  public matrixPointAt(pos: Vec3d, target: Vec3d, up: Vec3d) {
    // new forward
    let newForward = this.vectorSub(target, pos);
    newForward = this.vectorNormalize(newForward);

    // new up
    const a = this.vectorMul(newForward, this.vectorDotProd(up, newForward));
    let newUp = this.vectorSub(up, a);
    newUp = this.vectorNormalize(newUp);

    // new right
    const newRight = this.vectorCrossProduct(newUp, newForward);

    // Construct Dimensioning and Translation Matrix	
    const matrix: Mat4x4 = this.matrixCreate();
    matrix[0][0] = newRight.x; matrix[0][1] = newRight.y; matrix[0][2] = newRight.z; matrix[0][3] = 0;
    matrix[1][0] = newUp.x; matrix[1][1] = newUp.y; matrix[1][2] = newUp.z; matrix[1][3] = 0;
    matrix[2][0] = newForward.x; matrix[2][1] = newForward.y; matrix[2][2] = newForward.z; matrix[2][3] = 0;
    matrix[3][0] = pos.x; matrix[3][1] = pos.y; matrix[3][2] = pos.z; matrix[3][3] = 1;

    return matrix;
  }
}