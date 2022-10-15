export type Vec3d = [number, number, number, number] | [number, number, number];

export type Triangle = [Vec3d, Vec3d, Vec3d, string?];

type MatRow = [number, number, number, number];
export type Mat4x4 = [MatRow, MatRow, MatRow, MatRow];

export type MovementParams = {
  yaw: number;
  xaw: number;
  vUp: Vec3d;
  vCamera: Vec3d;
  vTarget: Vec3d;
}

type MovementResult = {
  camera: Mat4x4;
  lookDir: Vec3d;
  moveDir: Vec3d;
}

export default class VecMat {

  public vectorCreate(n?: Vec3d | number): Vec3d {

    const vector: Vec3d = [0, 0, 0, 1];

    if (Array.isArray(n)) {
      vector[0] = n[0] || 0;
      vector[1] = n[1] || 0;
      vector[2] = n[2] || 0;
      vector[3] = n[3] || 1;
    }

    if (typeof n === 'number') {
      vector[0] = n;
      vector[1] = n;
      vector[2] = n;
      vector[3] = n;
    }

    return vector;
  }

  public vectorAdd(v1: Vec3d, v2: Vec3d | number): Vec3d {
    const vec2 = this.vectorCreate(v2 || 0);

    return [
      v1[0] + vec2[0],
      v1[1] + vec2[1],
      v1[2] + vec2[2],
      (v1[3] || 0) + (vec2[3] || 0)
    ]
  }

  public vectorSub(v1: Vec3d, v2: Vec3d | number): Vec3d {
    const vec2 = this.vectorCreate(v2 || 0);
    return [
      v1[0] - vec2[0],
      v1[1] - vec2[1],
      v1[2] - vec2[2],
      (v1[3] || 0) - (vec2[3] || 0)
    ]
  }

  public vectorMul(v1: Vec3d, v2?: Vec3d | number): Vec3d {
    const vec2 = this.vectorCreate(v2 || 0);
    return [
      v1[0] * vec2[0],
      v1[1] * vec2[1],
      v1[2] * vec2[2]
    ]
  }

  public vectorDiv(v1: Vec3d, v2?: Vec3d | number): Vec3d {
    const vec2 = this.vectorCreate(v2 || 1);
    return [
      v1[0] / vec2[0],
      v1[1] / vec2[1],
      v1[2] / vec2[2]
    ]
  }

  public vectorDotProd(v1: Vec3d, v2: Vec3d): number {
    return (
      v1[0] * v2[0] +
      v1[1] * v2[1] +
      v1[2] * v2[2]
    );
  }

  public vectorLength(v: Vec3d): number {
    return Math.sqrt(this.vectorDotProd(v, v));
  }

  public vectorNormalize(v: Vec3d): Vec3d {
    const l = this.vectorLength(v);
    return [
      v[0] / l,
      v[1] / l,
      v[2] / l
    ]
  }

  public vectorCrossProduct(v1: Vec3d, v2: Vec3d): Vec3d {
    return [
      v1[1] * v2[2] - v1[2] * v2[1],
      v1[2] * v2[0] - v1[0] * v2[2],
      v1[0] * v2[1] - v1[1] * v2[0]
    ]
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

  public vectorRotateByAxis(v: Vec3d, axis: Vec3d, angle: number) {
    const sinHalfAngle = Math.sin(angle / 2.0);
    const cosHalfAngle = Math.cos(angle / 2.0);

    const rX = axis[0] * sinHalfAngle;
    const rY = axis[1] * sinHalfAngle;
    const rZ = axis[2] * sinHalfAngle;
    const rW = cosHalfAngle;

    const q = this.vectorCreate([rX, rY, rZ, rW]);

    // find the conjugate of q.
    const q_conj = this.vectorCreate([-rX, -rY, -rZ, rW]);

    const p = this.vectorCreate([v[0], v[1], v[2], 0]);

    const mul1 = this.quatMultiply(q, p);
    const mul2 = this.quatMultiply(mul1, q_conj);

    return mul2;
  }

  public quatMultiply(a: Vec3d, b: Vec3d) {
    const aa: Vec3d = a as Vec3d;
    const bb: Vec3d = b as Vec3d;

    const aw = aa[3] || 0;
    const bw = aa[3] || 0;

    return this.vectorCreate([
      aa[0] * bw + aw * bb[0] + aa[1] * bb[2] - aa[2] * bb[1],
      aa[1] * bw + aw * bb[1] + aa[2] * bb[0] - aa[0] * bb[2],
      aa[2] * bw + aw * bb[2] + aa[0] * bb[1] - aa[1] * bb[0],
      aw * bw - aa[0] * bb[0] - aa[1] * bb[1] - aa[2] * bb[2]
    ]);
  }

  public triangleClipAgainstPlane(planeP: Vec3d, planeN: Vec3d, inTri: Triangle, debug = false) {
    planeN = this.vectorNormalize(planeN);

    const NPDot = this.vectorDotProd(planeN, planeP);

    const dist = (p: Vec3d) => {
      return (planeN[0] * p[0] + planeN[1] * p[1] + planeN[2] * p[2] - NPDot);
    }

    const newVector = this.vectorCreate();

    const createTriangle = (): Triangle => {
      return [
        newVector,
        newVector,
        newVector,
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

    const color = inTri[3];

    if (insidePointsCount === 1 && outsidePointsCount === 2) {
      const outTri1 = createTriangle();
      outTri1[3] = debug ? 'blue' : color;
      outTri1[0] = insidePoints[0];

      outTri1[1] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[0]);
      outTri1[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[1]);

      return [outTri1];
    }

    if (insidePointsCount === 2 && outsidePointsCount === 1) {
      const outTri1 = createTriangle()
      outTri1[3] = debug ? 'green' : color;
      outTri1[0] = insidePoints[0];
      outTri1[1] = insidePoints[1];
      outTri1[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[0]);

      const outTri2 = createTriangle();
      outTri2[3] = debug ? 'red' : color;
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
    const w = v[3] || 1;

    return [
      v[0] * m[0][0] + v[1] * m[1][0] + v[2] * m[2][0] + w * m[3][0],
      v[0] * m[0][1] + v[1] * m[1][1] + v[2] * m[2][1] + w * m[3][1],
      v[0] * m[0][2] + v[1] * m[1][2] + v[2] * m[2][2] + w * m[3][2],
      v[0] * m[0][3] + v[1] * m[1][3] + v[2] * m[2][3] + w * m[3][3]
    ]
  }

  public matrixRotationX(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    matrix[0][0] = 1;
    matrix[1][1] = cosAngle;
    matrix[1][2] = sinAngle;
    matrix[2][1] = -sinAngle;
    matrix[2][2] = cosAngle;
    matrix[3][3] = 1;
    return matrix
  }

  public matrixRotationY(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    matrix[0][0] = cosAngle;
    matrix[0][2] = sinAngle;
    matrix[2][0] = -sinAngle;
    matrix[1][1] = 1;
    matrix[2][2] = cosAngle;
    matrix[3][3] = 1;
    return matrix
  }

  public matrixRotationZ(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    matrix[0][0] = cosAngle;
    matrix[0][1] = sinAngle;
    matrix[1][0] = -sinAngle;
    matrix[1][1] = cosAngle
    matrix[2][2] = 1;
    matrix[3][3] = 1;
    return matrix
  }

  public matrixRotationByAxis(axis: Vec3d, angleRad: number) {
    const matrix = this.matrixCreate();
    const u = this.vectorNormalize(axis);

    const cosTheta = Math.cos(angleRad);
    const sinTheta = Math.sin(angleRad);
    const takeCosTheta = 1 - cosTheta;

    const uXSinTheta = u[0] * sinTheta;
    const uYSinTheta = u[1] * sinTheta;
    const uZSinTheta = u[2] * sinTheta;

    matrix[0][0] = cosTheta + Math.pow(u[0], 2) * takeCosTheta;
    matrix[0][1] = (u[0] * u[1]) * takeCosTheta - uZSinTheta;
    matrix[0][2] = (u[0] * u[2]) * takeCosTheta + uYSinTheta;

    matrix[1][0] = (u[1] * u[0]) * takeCosTheta + uZSinTheta;
    matrix[1][1] = cosTheta + Math.pow(u[1], 2) * takeCosTheta;
    matrix[1][2] = (u[1] * u[2]) * takeCosTheta - uXSinTheta;

    matrix[2][0] = (u[2] * u[0]) * takeCosTheta - uYSinTheta;
    matrix[2][1] = (u[2] * u[1]) * takeCosTheta + uXSinTheta;
    matrix[2][2] = cosTheta + Math.pow(u[2], 2) * takeCosTheta;

    return matrix;
  }

  public matrixTranslation(x: number, y: number, z: number): Mat4x4 {
    const matrix = this.matrixCreateIdentity();
    matrix[3][0] = x;
    matrix[3][1] = y;
    matrix[3][2] = z;
    return matrix;
  }

  public matrixProjection(fovDeg: number, aspectRatio: number, near: number, far: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const fovRad = 1 / Math.tan(fovDeg * 0.5 / 180 * Math.PI);
    const middle = far - near

    matrix[0][0] = aspectRatio * fovRad;
    matrix[1][1] = fovRad;
    matrix[2][2] = far / middle;
    matrix[3][2] = (-far * near) / middle;
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
    const newForward = this.vectorNormalize(this.vectorSub(target, pos));

    // new up
    const a = this.vectorMul(newForward, this.vectorDotProd(up, newForward));
    let newUp = this.vectorSub(up, a);
    newUp = this.vectorNormalize(newUp);

    // new right
    const newRight = this.vectorCrossProduct(newUp, newForward);

    // Construct Dimensioning and Translation Matrix	
    const matrix: Mat4x4 = this.matrixCreate();
    matrix[0][0] = newRight[0];
    matrix[0][1] = newRight[1];
    matrix[0][2] = newRight[2];
    matrix[0][3] = 0;

    matrix[1][0] = newUp[0];
    matrix[1][1] = newUp[1];
    matrix[1][2] = newUp[2];
    matrix[1][3] = 0;

    matrix[2][0] = newForward[0];
    matrix[2][1] = newForward[1];
    matrix[2][2] = newForward[2];
    matrix[2][3] = 0;

    matrix[3][0] = pos[0];
    matrix[3][1] = pos[1];
    matrix[3][2] = pos[2];
    matrix[3][3] = 1;

    return matrix;
  }

  public movementFly = (args: MovementParams): MovementResult => {
    const { vCamera, vUp, xaw, yaw } = args;
    let { vTarget } = args;

    // Make camera horizontal rotation
    const matCameraRot = this.matrixRotationY(yaw);
    const moveDir = this.matrixMultiplyVector(matCameraRot, vTarget);

    // Make camera vertical rotation
    const lookSide = this.vectorCrossProduct(moveDir, vUp);
    const matCameraTilt = this.matrixRotationByAxis(lookSide, -xaw);

    // Combine camera rotations
    const matCameraCombiner = this.matrixMultiplyMatrix(matCameraRot, matCameraTilt);
    const lookDir = this.matrixMultiplyVector(matCameraCombiner, vTarget);
    vTarget = this.vectorAdd(vCamera, lookDir);

    // Make camera
    const camera = this.matrixPointAt(vCamera, vTarget, vUp);

    return { lookDir, camera, moveDir };
  };

  public movementWalk = (args: MovementParams): MovementResult => {
    const { vCamera, vUp, xaw, yaw } = args;
    let { vTarget } = args;

    // Make camera horizontal rotation
    const matCameraRot = this.matrixRotationY(yaw);
    const lookDir = this.matrixMultiplyVector(matCameraRot, vTarget);

    // Make camera vertical rotation
    const lookSide = this.vectorCrossProduct(lookDir, vUp);
    const vTilt = this.vectorRotateByAxis(lookDir, lookSide, xaw);

    vTarget = this.vectorAdd(vCamera, vTilt);

    // Make camera
    const camera = this.matrixPointAt(vCamera, vTarget, vUp);

    return { lookDir, camera, moveDir: lookDir };
  }
}