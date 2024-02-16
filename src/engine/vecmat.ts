import { Triangle, Vec4, Vec3, AnyVec, ObjVertex } from './types';

type MatRow = [number, number, number, number];
type MultiMat = [MatRow, MatRow, MatRow, MatRow];

export type Mat4x4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

export type MovementParams = {
  yaw: number;
  xaw: number;
  vUp: Vec4;
  vCamera: Vec4;
  vTarget: Vec4;
  shouldInvertForward?: boolean;
}

type MovementResult = {
  cameraView: Mat4x4;
  lookDir: Vec4;
  moveDir: Vec4;
}

export default class VecMat {

  public objVectorToVector(v: ObjVertex): Vec3 {
    return [v.x, v.y, v.z];
  }

  public vectorCreate(n?: AnyVec | number): Vec4 {

    const vector: Vec4 = [0, 0, 0, 1];

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
      vector[3] = 1;
    }

    return vector;
  }

  public vectorAdd(v1: AnyVec, v2: AnyVec | number): Vec4 {
    const vec2 = this.vectorCreate(v2 || 0);

    return [
      v1[0] + vec2[0],
      v1[1] + vec2[1],
      v1[2] + vec2[2],
      (v1[3] || 0) + (vec2[3] || 0)
    ]
  }

  public vectorSub(v1: AnyVec, v2: AnyVec | number): Vec4 {
    const vec2 = this.vectorCreate(v2 || 0);
    return [
      v1[0] - vec2[0],
      v1[1] - vec2[1],
      v1[2] - vec2[2],
      (v1[3] || 0) - (vec2[3] || 0)
    ]
  }

  public vectorMul(v1: AnyVec, v2?: AnyVec | number): Vec4 {
    const vec2 = this.vectorCreate(v2 || 0);
    return [
      v1[0] * vec2[0],
      v1[1] * vec2[1],
      v1[2] * vec2[2],
      (v1[3] || 1) * (vec2[3] || 1)
    ]
  }

  public vectorDiv(v1: AnyVec, v2?: AnyVec | number): Vec3 {
    const vec2 = this.vectorCreate(v2 || 1);
    return [
      v1[0] / vec2[0],
      v1[1] / vec2[1],
      v1[2] / vec2[2]
    ]
  }

  public vectorDotProd(v1: AnyVec, v2: AnyVec): number {
    return (
      v1[0] * v2[0] +
      v1[1] * v2[1] +
      v1[2] * v2[2]
    );
  }

  public vectorLength(v: AnyVec): number {
    return Math.sqrt(this.vectorDotProd(v, v));
  }

  public vectorNormalize(v: AnyVec): Vec3 {
    const l = this.vectorLength(v);
    return [
      v[0] / l,
      v[1] / l,
      v[2] / l
    ]
  }

  public vectorCrossProduct(v1: AnyVec, v2: AnyVec): Vec3 {
    const
      v1x = v1[0], v1y = v1[1], v1z = v1[2],
      v2x = v2[0], v2y = v2[1], v2z = v2[2];

    return [
      v1y * v2z - v1z * v2y,
      v1z * v2x - v1x * v2z,
      v1x * v2y - v1y * v2x
    ]
  }

  public vectorIntersectPlane(planeP: AnyVec, planeN: AnyVec, lineStart: AnyVec, lineEnd: AnyVec) {
    const nPlaneN = this.vectorNormalize(planeN);
    const planeD = -this.vectorDotProd(nPlaneN, planeP);
    const ad = this.vectorDotProd(lineStart, nPlaneN);
    const bd = this.vectorDotProd(lineEnd, nPlaneN);
    const t = (-planeD - ad) / (bd - ad);
    const lineStartToEnd = this.vectorSub(lineEnd, lineStart);
    const lineToIntersect = this.vectorMul(lineStartToEnd, t);
    return this.vectorAdd(lineStart, lineToIntersect);
  }

  public vectorRotateByAxis(v: AnyVec, axis: AnyVec, angle: number) {
    const sinHalfAngle = Math.sin(angle / 2.0);
    const cosHalfAngle = Math.cos(angle / 2.0);

    const rX = axis[0] * sinHalfAngle;
    const rY = axis[1] * sinHalfAngle;
    const rZ = axis[2] * sinHalfAngle;
    const rW = cosHalfAngle;

    const q = this.vectorCreate([rX, rY, rZ, rW]);

    const q_conj = this.vectorCreate([-rX, -rY, -rZ, rW]);

    const p = this.vectorCreate([v[0], v[1], v[2], 0]);

    const mul1 = this.quatMultiply(q, p);
    const mul2 = this.quatMultiply(mul1, q_conj);

    return mul2;
  }

  public quatMultiply(a: AnyVec, b: AnyVec) {
    const
      bx = b[0], ax = a[0],
      by = b[1], ay = a[1],
      bz = b[2], az = a[2];

    const aw = a[3] || 0;
    const bw = a[3] || 0;

    return this.vectorCreate([
      ax * bw + aw * bx + ay * bz - az * by,
      ay * bw + aw * by + az * bx - ax * bz,
      az * bw + aw * bz + ax * by - ay * bx,
      aw * bw - ax * bx - ay * by - az * bz
    ]);
  }

  /** Warning: this method produces a Triangle with references to vectors that are not spread [...array] */
  public triangleClipAgainstPlane(planeP: AnyVec, planeN: AnyVec, inTri: Triangle): Triangle[] {
    const nPlaneN = this.vectorNormalize(planeN);

    const NPDot = this.vectorDotProd(nPlaneN, planeP);
    const newVector = this.vectorCreate();

    const createTriangle = (): Triangle => {
      return [
        newVector,
        newVector,
        newVector,
        newVector
      ]
    }

    const insidePoints: AnyVec[] = [];
    const outsidePoints: AnyVec[] = [];
    let insidePointsCount = 0;
    let outsidePointsCount = 0;

    const dist = (p: AnyVec) => {
      return (nPlaneN[0] * p[0] + nPlaneN[1] * p[1] + nPlaneN[2] * p[2] - NPDot);
    }

    if (dist(inTri[0]) >= 0) insidePoints[insidePointsCount++] = inTri[0];
    else outsidePoints[outsidePointsCount++] = inTri[0];

    if (dist(inTri[1]) >= 0) insidePoints[insidePointsCount++] = inTri[1];
    else outsidePoints[outsidePointsCount++] = inTri[1];

    if (dist(inTri[2]) >= 0) insidePoints[insidePointsCount++] = inTri[2];
    else outsidePoints[outsidePointsCount++] = inTri[2];

    if (insidePointsCount === 0) {
      return [];
    }

    if (insidePointsCount === 3) {
      return [inTri];
    }

    const color = inTri[3];

    // Warning: for performance reasons arrays are not cloned here (outTri[0] = [...array])
    // this results in the vectors mutating each other if manipulated further down the line.

    if (insidePointsCount === 1 && outsidePointsCount === 2) {
      const outTri1 = createTriangle();
      outTri1[0] = insidePoints[0];
      outTri1[1] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[0]);
      outTri1[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[1]);
      outTri1[3] = color;

      return [outTri1];
    }

    if (insidePointsCount === 2 && outsidePointsCount === 1) {
      const outTri1 = createTriangle()
      outTri1[0] = insidePoints[0];
      outTri1[1] = insidePoints[1];
      outTri1[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[0], outsidePoints[0]);
      outTri1[3] = color;

      const outTri2 = createTriangle();
      outTri2[0] = insidePoints[1];
      outTri2[1] = outTri1[2];
      outTri2[2] = this.vectorIntersectPlane(planeP, planeN, insidePoints[1], outsidePoints[0]);
      outTri2[3] = color;

      return [outTri1, outTri2];
    }

    return [];
  }

  /**
    [ 0  1  2  3]
    [ 4  5  6  7]
    [ 8  9 10 11]
    [12 13 14 15]
  */
  public matrixTranspose(m: Mat4x4) {
    return this.matrixCreate([
      m[0], m[4], m[8], m[12],
      m[1], m[5], m[9], m[13],
      m[2], m[6], m[10], m[14],
      m[3], m[7], m[11], m[15],
    ])
  }

  public matrixCreate(arr?: number[]): Mat4x4 {
    const matrix: Mat4x4 = [
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ];

    if (arr) {
      matrix[0] = arr[0] || 0;
      matrix[1] = arr[1] || 0;
      matrix[2] = arr[2] || 0;
      matrix[3] = arr[3] || 0;

      matrix[4] = arr[4] || 0;
      matrix[5] = arr[5] || 0;
      matrix[6] = arr[6] || 0;
      matrix[7] = arr[7] || 0;

      matrix[8] = arr[8] || 0;
      matrix[9] = arr[9] || 0;
      matrix[10] = arr[10] || 0;
      matrix[11] = arr[11] || 0;

      matrix[12] = arr[12] || 0;
      matrix[13] = arr[13] || 0;
      matrix[14] = arr[14] || 0;
      matrix[15] = arr[15] || 0;
    }

    return matrix;
  }

  public matrixCreateMulti(): MultiMat {
    return [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ];
  }

  public matrixFlatToMulti(m: Mat4x4): MultiMat {
    return [
      [m[0], m[1], m[2], m[3]],
      [m[4], m[5], m[6], m[7]],
      [m[8], m[9], m[10], m[11]],
      [m[12], m[13], m[14], m[15]]
    ];
  }

  public matrixMultiToFlat(m: MultiMat): Mat4x4 {
    return [
      m[0][0],
      m[0][1],
      m[0][2],
      m[0][3],

      m[1][0],
      m[1][1],
      m[1][2],
      m[1][3],

      m[2][0],
      m[2][1],
      m[2][2],
      m[2][3],

      m[3][0],
      m[3][1],
      m[3][2],
      m[3][3],
    ]
  }

  public matrixCreateIdentity(): Mat4x4 {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  }

  public matrixMultiplyVector(m: Mat4x4, v: AnyVec): Vec4 {
    const vx = v[0], vy = v[1], vz = v[2], vw = v[3] || 1;

    return [
      vx * m[0] + vy * m[4] + vz * m[8] + vw * m[12],
      vx * m[1] + vy * m[5] + vz * m[9] + vw * m[13],
      vx * m[2] + vy * m[6] + vz * m[10] + vw * m[14],
      vx * m[3] + vy * m[7] + vz * m[11] + vw * m[15]
    ]
  }

  public matrixRotationX(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    matrix[0] = 1;
    matrix[5] = cosAngle;
    matrix[6] = sinAngle;
    matrix[9] = -sinAngle;
    matrix[10] = cosAngle;
    matrix[15] = 1;
    return matrix
  }

  public matrixRotationY(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    matrix[0] = cosAngle;
    matrix[2] = sinAngle;
    matrix[8] = -sinAngle;
    matrix[5] = 1;
    matrix[10] = cosAngle;
    matrix[15] = 1;
    return matrix
  }

  public matrixRotationZ(angleRad: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const cosAngle = Math.cos(angleRad);
    const sinAngle = Math.sin(angleRad);

    matrix[0] = cosAngle;
    matrix[1] = sinAngle;
    matrix[4] = -sinAngle;
    matrix[5] = cosAngle
    matrix[10] = 1;
    matrix[15] = 1;
    return matrix
  }

  public matrixRotationByAxis(axis: AnyVec, angleRad: number) {
    const matrix = this.matrixCreate();

    const u = this.vectorNormalize(axis);
    const uX = u[0];
    const uY = u[1];
    const uZ = u[2];

    const cosTheta = Math.cos(angleRad);
    const sinTheta = Math.sin(angleRad);
    const takeCosTheta = 1 - cosTheta;

    const uXSinTheta = uX * sinTheta;
    const uYSinTheta = uY * sinTheta;
    const uZSinTheta = uZ * sinTheta;

    matrix[0] = cosTheta + Math.pow(uX, 2) * takeCosTheta;
    matrix[1] = (uX * uY) * takeCosTheta - uZSinTheta;
    matrix[2] = (uX * uZ) * takeCosTheta + uYSinTheta;

    matrix[4] = (uY * uX) * takeCosTheta + uZSinTheta;
    matrix[5] = cosTheta + Math.pow(uY, 2) * takeCosTheta;
    matrix[6] = (uY * uZ) * takeCosTheta - uXSinTheta;

    matrix[8] = (uZ * uX) * takeCosTheta - uYSinTheta;
    matrix[9] = (uZ * uY) * takeCosTheta + uXSinTheta;
    matrix[10] = cosTheta + Math.pow(uZ, 2) * takeCosTheta;

    return matrix;
  }

  public matrixTranslation(x: number, y: number, z: number): Mat4x4 {
    const matrix = this.matrixCreateIdentity();

    matrix[12] = x;
    matrix[13] = y;
    matrix[14] = z;
    return matrix;
  }

  public matrixProjection(fovDeg: number, aspectRatio: number, near: number, far: number): Mat4x4 {
    const matrix = this.matrixCreate();
    const fovRad = 1 / Math.tan(fovDeg * 0.5 / 180 * Math.PI);
    const rangeInv = 1 / (near - far);

    matrix[0] = fovRad / aspectRatio;
    matrix[5] = fovRad;
    matrix[10] = (near + far) * rangeInv;
    matrix[11] = -1;
    matrix[14] = near * far * rangeInv * 2;
    return matrix;
  }

  public matrixMultiplyMatrix(a: Mat4x4, b: Mat4x4): Mat4x4 {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    const b00 = b[0], b01 = b[1], b02 = b[2], b03 = b[3];
    const b10 = b[4], b11 = b[5], b12 = b[6], b13 = b[7];
    const b20 = b[8], b21 = b[9], b22 = b[10], b23 = b[11];
    const b30 = b[12], b31 = b[13], b32 = b[14], b33 = b[15];

    const matrix = this.matrixCreate();

    matrix[0] = a00 * b00 + a01 * b10 + a03 * b20 + a03 * b30;
    matrix[4] = a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30;
    matrix[8] = a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30;
    matrix[12] = a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30;

    matrix[1] = a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31;
    matrix[5] = a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31;
    matrix[9] = a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31;
    matrix[13] = a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31;

    matrix[2] = a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32;
    matrix[6] = a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32;
    matrix[10] = a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32;
    matrix[14] = a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32;

    matrix[3] = a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33;
    matrix[7] = a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33;
    matrix[11] = a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33;
    matrix[15] = a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33;

    return matrix;
  }

  public matrixMultiplyMatrices(...matrices: Mat4x4[]) {
    let matrix = this.matrixCreateIdentity();

    const len = matrices.length;
    for (let i = 0; i < len; i++) {
      matrix = this.matrixMultiplyMatrix(matrix, matrices[i]);
    }

    return matrix;
  }

  public matrixInverse(matrix: Mat4x4): Mat4x4 | null {
    const result: Mat4x4 = this.matrixCreate();

    // Initialize the result matrix as an identity matrix
    for (let i = 0; i < 16; i++) {
      result[i] = (i % 5 === 0) ? 1 : 0;
    }

    // Perform Gaussian elimination
    for (let col = 0; col < 4; col++) {
      const pivot = matrix[col * 4 + col];
      if (pivot === 0) {
        // Matrix is singular, cannot be inverted
        return null;
      }

      const pivotInverse = 1 / pivot;

      for (let i = 0; i < 4; i++) {
        matrix[col * 4 + i] *= pivotInverse;
        result[col * 4 + i] *= pivotInverse;
      }

      for (let row = 0; row < 4; row++) {
        if (row !== col) {
          const factor = matrix[row * 4 + col];
          for (let i = 0; i < 4; i++) {
            matrix[row * 4 + i] -= factor * matrix[col * 4 + i];
            result[row * 4 + i] -= factor * result[col * 4 + i];
          }
        }
      }
    }

    return result;
  }


  // Only for Rotation/Translation Matrices
  public matrixQuickInverse(m: Mat4x4): Mat4x4 {
    const matrix = this.matrixCreate();

    matrix[0] = m[0]; matrix[1] = m[4]; matrix[2] = m[8]; matrix[3] = 0;
    matrix[4] = m[1]; matrix[5] = m[5]; matrix[6] = m[9]; matrix[7] = 0;
    matrix[8] = m[2]; matrix[9] = m[6]; matrix[10] = m[10]; matrix[11] = 0;
    matrix[12] = -(m[12] * matrix[0] + m[13] * matrix[4] + m[14] * matrix[8]);
    matrix[13] = -(m[12] * matrix[1] + m[13] * matrix[5] + m[14] * matrix[9]);
    matrix[14] = -(m[12] * matrix[2] + m[13] * matrix[6] + m[14] * matrix[10]);
    matrix[15] = 1;
    return matrix;
  }

  public vectorNegate<T extends AnyVec>(vector: T) {
    const result = [];
    for (let i = 0; i < vector.length; i++) {
      result[i] = -vector[i];
    }
    return result as T;
  }

  public matrixPointAt(pos: AnyVec, target: AnyVec, up: AnyVec, invertForward = false) {
    // New forward
    let newForward = this.vectorNormalize(this.vectorSub(target, pos));

    if (invertForward) {
      newForward = this.vectorNegate(newForward);
    }

    // New up
    const a = this.vectorMul(newForward, this.vectorDotProd(up, newForward));
    let newUp = this.vectorSub(up, a);
    const nNewUp = this.vectorNormalize(newUp);

    // New right
    const newRight = this.vectorCrossProduct(nNewUp, newForward);

    // Construct Dimensioning and Translation Matrix	
    const matrix: Mat4x4 = this.matrixCreate();

    // X
    matrix[0] = newRight[0];
    matrix[1] = newRight[1];
    matrix[2] = newRight[2];
    matrix[3] = 0;

    // Y
    matrix[4] = nNewUp[0];
    matrix[5] = nNewUp[1];
    matrix[6] = nNewUp[2];
    matrix[7] = 0;

    // Z
    matrix[8] = newForward[0];
    matrix[9] = newForward[1];
    matrix[10] = newForward[2];
    matrix[11] = 0;

    // W
    matrix[12] = pos[0];
    matrix[13] = pos[1];
    matrix[14] = pos[2];
    matrix[15] = 1;

    return matrix;
  }

  public movementFly = (args: MovementParams): MovementResult => {
    const { vCamera, vUp, xaw, yaw, shouldInvertForward } = args;
    let { vTarget } = args;

    // Make camera horizontal rotation
    const matCameraRot = this.matrixRotationY(yaw);
    const moveDir = this.matrixMultiplyVector(matCameraRot, vTarget);

    // Make camera vertical rotation
    const lookSide = this.vectorCrossProduct(moveDir, vUp);
    const matCameraTilt = this.matrixRotationByAxis(lookSide, -xaw);

    // Combine camera rotations
    const matCameraCombined = this.matrixMultiplyMatrix(matCameraRot, matCameraTilt);

    const lookDir = this.matrixMultiplyVector(matCameraCombined, vTarget);
    vTarget = this.vectorSub(vCamera, lookDir);

    // Make camera
    const cameraView = this.matrixPointAt(vCamera, vTarget, vUp, shouldInvertForward);

    return { lookDir, cameraView, moveDir };
  };

  public movementWalk = (args: MovementParams): MovementResult => {
    const { vCamera, vUp, xaw, yaw, shouldInvertForward } = args;
    let { vTarget } = args;

    // Make camera horizontal rotation
    const matCameraRot = this.matrixRotationY(yaw);
    const lookDir = this.matrixMultiplyVector(matCameraRot, vTarget);

    // Make camera vertical rotation
    const lookSide = this.vectorCrossProduct(lookDir, vUp);
    const vTilt = this.vectorRotateByAxis(lookDir, lookSide, xaw);

    vTarget = this.vectorSub(vCamera, vTilt);

    // Make camera
    const cameraView = this.matrixPointAt(vCamera, vTarget, vUp, shouldInvertForward);

    return { lookDir, cameraView, moveDir: lookDir };
  }

  public degToRad(degrees: number) {
    return degrees * Math.PI / 180;
  }
}