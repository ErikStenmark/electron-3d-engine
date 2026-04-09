import { Obj, Vec3, Vec4 } from './types';
import VecMat, { Mat4x4 } from './vecmat';
import { Camera } from './camera';
import { Physics } from './physics';
import { BVHResult, queryPoint, queryAllPairs } from './bvh';

export class CollisionSystem {
  pointingAt = '';
  pointingAtGroup = '';
  pointingAtMaterial = '';
  cameraCollidingWith: string[] = [];
  objectCollisions: string[] = [];
  prevCameraPos: Vec4 = [0, 0, 0, 1];
  readonly cameraHeight = 1.5;

  constructor(private vecMat: VecMat) {}

  updatePointingAt(objects: Obj[], camera: Camera) {
    const { origin: camPos, direction: rayDir } = camera.getViewRay();
    const targetPos: Vec4 = [camPos[0] + rayDir[0], camPos[1] + rayDir[1], camPos[2] + rayDir[2], 1];

    let closest: { name: string; dist: number; group: string; material: string } | null = null;

    for (const obj of objects) {
      const invModel = this.vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
      if (!invModel) continue;

      const localOrigin = this.vecMat.matrixMultiplyVector(invModel, camPos);
      const localTarget = this.vecMat.matrixMultiplyVector(invModel, targetPos);
      const localDir: Vec4 = [
        localTarget[0] - localOrigin[0],
        localTarget[1] - localOrigin[1],
        localTarget[2] - localOrigin[2],
        0
      ];

      const { minX, maxX, minY, maxY, minZ, maxZ } = obj.dimensions;
      const aabbDist = this.vecMat.rayIntersectsAABB(
        localOrigin, localDir,
        { x: minX, y: minY, z: minZ },
        { x: maxX, y: maxY, z: maxZ }
      );
      if (aabbDist === null) continue;

      let triDist: number | null = null;
      let hitGroup = '';
      let hitMaterial = '';
      for (const group of Object.values(obj.groups)) {
        for (const material of Object.values(group.materials)) {
          const { triangles, vertices } = material;
          for (const tri of triangles) {
            const v0 = vertices[tri.v1.index];
            const v1 = vertices[tri.v2.index];
            const v2 = vertices[tri.v3.index];
            const t = this.vecMat.rayIntersectsTriangle(
              localOrigin, localDir,
              [v0.x, v0.y, v0.z],
              [v1.x, v1.y, v1.z],
              [v2.x, v2.y, v2.z],
            );
            if (t !== null && (triDist === null || t < triDist)) {
              triDist = t;
              hitGroup = group.name;
              hitMaterial = material.name;
            }
          }
        }
      }

      if (triDist !== null && (!closest || triDist < closest.dist)) {
        closest = { name: obj.name, dist: triDist, group: hitGroup, material: hitMaterial };
      }
    }

    this.pointingAt = closest ? closest.name : '';
    this.pointingAtGroup = closest ? closest.group : '';
    this.pointingAtMaterial = closest ? closest.material : '';
  }

  updateCollisions(objects: Obj[], camera: Camera, bvh?: BVHResult) {
    const camPos: Vec4 = [camera.pos[0], camera.pos[1], camera.pos[2], 1];
    this.cameraCollidingWith = [];

    if (bvh?.root) {
      // BVH point query to narrow camera collision candidates
      const candidates = queryPoint(bvh.root, [camPos[0], camPos[1], camPos[2]]);
      for (const idx of candidates) {
        const obj = objects[idx];
        const invModel = this.vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
        if (!invModel) continue;
        const localCam = this.vecMat.matrixMultiplyVector(invModel, camPos);
        const d = obj.dimensions;
        if (this.vecMat.pointInAABB(localCam, { x: d.minX, y: d.minY, z: d.minZ }, { x: d.maxX, y: d.maxY, z: d.maxZ })) {
          this.cameraCollidingWith.push(obj.name);
        }
      }

      // BVH self-overlap query instead of O(n^2)
      const pairs = queryAllPairs(bvh.root);
      this.objectCollisions = pairs.map(([i, j]) => `${objects[i].name} <> ${objects[j].name}`);
    } else {
      // Fallback: brute force
      type WorldAABB = { name: string; min: Vec3; max: Vec3 };
      const worldAABBs: WorldAABB[] = [];

      for (const obj of objects) {
        const wAABB = this.vecMat.getWorldAABB(obj.modelMatrix, obj.dimensions);
        worldAABBs.push({ name: obj.name, min: wAABB.min, max: wAABB.max });

        const invModel = this.vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
        if (!invModel) continue;
        const localCam = this.vecMat.matrixMultiplyVector(invModel, camPos);
        const d = obj.dimensions;
        if (this.vecMat.pointInAABB(localCam, { x: d.minX, y: d.minY, z: d.minZ }, { x: d.maxX, y: d.maxY, z: d.maxZ })) {
          this.cameraCollidingWith.push(obj.name);
        }
      }

      this.objectCollisions = [];
      for (let i = 0; i < worldAABBs.length; i++) {
        for (let j = i + 1; j < worldAABBs.length; j++) {
          const a = worldAABBs[i];
          const b = worldAABBs[j];
          if (this.vecMat.aabbOverlap(a.min, a.max, b.min, b.max)) {
            this.objectCollisions.push(`${a.name} <> ${b.name}`);
          }
        }
      }
    }
  }

  enforceSolidCollisions(objects: Obj[], camera: Camera, physics: Physics | null) {
    const camPos: Vec4 = [camera.pos[0], camera.pos[1], camera.pos[2], 1];
    const feetPos: Vec4 = [camera.pos[0], camera.pos[1] - this.cameraHeight, camera.pos[2], 1];

    for (const obj of objects) {
      if (!obj.solid || obj.ground) continue;

      const margin = obj.collisionMargin;
      const invModel = this.vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
      if (!invModel) continue;

      const localFeet = this.vecMat.matrixMultiplyVector(invModel, feetPos);
      const d = obj.dimensions;

      const hasPhysics = physics !== null;

      const expandedMin = { x: d.minX - margin, y: d.minY - margin, z: d.minZ - margin };
      const expandedMax = { x: d.maxX + margin, y: d.maxY + margin, z: d.maxZ + margin };

      if (hasPhysics) {
        const localCam = this.vecMat.matrixMultiplyVector(invModel, camPos);
        const camInX = localCam[0] >= expandedMin.x && localCam[0] <= expandedMax.x;
        const camInY = localCam[1] >= d.minY && localCam[1] <= d.maxY + margin;
        const camInZ = localCam[2] >= expandedMin.z && localCam[2] <= expandedMax.z;
        if (!camInX || !camInY || !camInZ) continue;
      } else {
        if (!this.vecMat.pointInAABB(localFeet, expandedMin, expandedMax)) continue;
      }

      const prevPos: Vec4 = [this.prevCameraPos[0], this.prevCameraPos[1] - this.cameraHeight, this.prevCameraPos[2], 1];
      const localPrev = this.vecMat.matrixMultiplyVector(invModel, prevPos);

      const pushX = localPrev[0] < localFeet[0]
        ? expandedMin.x - localFeet[0]
        : expandedMax.x - localFeet[0];
      const pushY = localPrev[1] < localFeet[1]
        ? expandedMin.y - localFeet[1]
        : expandedMax.y - localFeet[1];
      const pushZ = localPrev[2] < localFeet[2]
        ? expandedMin.z - localFeet[2]
        : expandedMax.z - localFeet[2];

      const ax = Math.abs(pushX);
      const ay = Math.abs(pushY);
      const az = Math.abs(pushZ);

      let correctedLocal: Vec4 = [...localFeet] as Vec4;
      if (hasPhysics) {
        if (ax <= az) {
          correctedLocal[0] += pushX;
        } else {
          correctedLocal[2] += pushZ;
        }
      } else if (ax <= ay && ax <= az) {
        correctedLocal[0] += pushX;
      } else if (ay <= ax && ay <= az) {
        correctedLocal[1] += pushY;
      } else {
        correctedLocal[2] += pushZ;
      }

      const correctedWorld = this.vecMat.matrixMultiplyVector(obj.modelMatrix, correctedLocal);
      camera.pos[0] = correctedWorld[0];
      camera.pos[1] = correctedWorld[1] + this.cameraHeight;
      camera.pos[2] = correctedWorld[2];
    }

    this.prevCameraPos = [camera.pos[0], camera.pos[1], camera.pos[2], 1];
  }

  enforceGroundCollision(objects: Obj[], camera: Camera, physics: Physics | null) {
    if (!physics) return;

    const camPos: Vec4 = [camera.pos[0], camera.pos[1], camera.pos[2], 1];
    const downTarget: Vec4 = [camera.pos[0], camera.pos[1] - 1, camera.pos[2], 1];

    let groundY: number | null = null;

    for (const obj of objects) {
      if (!obj.solid && !obj.ground && !obj.meshCollision) continue;

      const invModel = this.vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
      if (!invModel) continue;

      const localOrigin = this.vecMat.matrixMultiplyVector(invModel, camPos);
      const localTarget = this.vecMat.matrixMultiplyVector(invModel, downTarget);
      const localDir: Vec4 = [
        localTarget[0] - localOrigin[0],
        localTarget[1] - localOrigin[1],
        localTarget[2] - localOrigin[2],
        0
      ];

      const d = obj.dimensions;
      const aabb = this.vecMat.rayIntersectsAABB(
        localOrigin, localDir,
        { x: d.minX, y: d.minY, z: d.minZ },
        { x: d.maxX, y: d.maxY, z: d.maxZ }
      );
      if (aabb === null) continue;

      for (const group of Object.values(obj.groups)) {
        for (const material of Object.values(group.materials)) {
          for (const tri of material.triangles) {
            const v0 = material.vertices[tri.v1.index];
            const v1 = material.vertices[tri.v2.index];
            const v2 = material.vertices[tri.v3.index];
            const t = this.vecMat.rayIntersectsTriangle(
              localOrigin, localDir,
              [v0.x, v0.y, v0.z],
              [v1.x, v1.y, v1.z],
              [v2.x, v2.y, v2.z],
            );
            if (t !== null) {
              const localHit: Vec4 = [
                localOrigin[0] + localDir[0] * t,
                localOrigin[1] + localDir[1] * t,
                localOrigin[2] + localDir[2] * t,
                1
              ];
              const worldHit = this.vecMat.matrixMultiplyVector(obj.modelMatrix, localHit);
              if (worldHit[1] <= camera.pos[1]) {
                if (groundY === null || worldHit[1] > groundY) {
                  groundY = worldHit[1];
                }
              }
            }
          }
        }
      }
    }

    if (groundY !== null) {
      const standingY = groundY + this.cameraHeight;
      if (camera.pos[1] <= standingY + 0.01) {
        camera.pos[1] = standingY;
        physics.land();
      } else if (camera.pos[1] > standingY + 0.1) {
        physics.fall();
      }
    } else {
      physics.fall();
    }
  }

  snapToGround(objects: Obj[], camera: Camera) {
    const camPos: Vec4 = [camera.pos[0], 10000, camera.pos[2], 1];
    const downTarget: Vec4 = [camera.pos[0], 9999, camera.pos[2], 1];

    let groundY: number | null = null;

    for (const obj of objects) {
      if (!obj.solid && !obj.ground && !obj.meshCollision) continue;

      const invModel = this.vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
      if (!invModel) continue;

      const localOrigin = this.vecMat.matrixMultiplyVector(invModel, camPos);
      const localTarget = this.vecMat.matrixMultiplyVector(invModel, downTarget);
      const localDir: Vec4 = [
        localTarget[0] - localOrigin[0],
        localTarget[1] - localOrigin[1],
        localTarget[2] - localOrigin[2],
        0,
      ];

      const d = obj.dimensions;
      const aabb = this.vecMat.rayIntersectsAABB(
        localOrigin, localDir,
        { x: d.minX, y: d.minY, z: d.minZ },
        { x: d.maxX, y: d.maxY, z: d.maxZ }
      );
      if (aabb === null) continue;

      for (const group of Object.values(obj.groups)) {
        for (const material of Object.values(group.materials)) {
          for (const tri of material.triangles) {
            const v0 = material.vertices[tri.v1.index];
            const v1 = material.vertices[tri.v2.index];
            const v2 = material.vertices[tri.v3.index];
            const t = this.vecMat.rayIntersectsTriangle(
              localOrigin, localDir,
              [v0.x, v0.y, v0.z], [v1.x, v1.y, v1.z], [v2.x, v2.y, v2.z],
            );
            if (t !== null) {
              const localHit: Vec4 = [
                localOrigin[0] + localDir[0] * t,
                localOrigin[1] + localDir[1] * t,
                localOrigin[2] + localDir[2] * t,
                1,
              ];
              const worldHit = this.vecMat.matrixMultiplyVector(obj.modelMatrix, localHit);
              if (groundY === null || worldHit[1] > groundY) {
                groundY = worldHit[1];
              }
            }
          }
        }
      }
    }

    if (groundY !== null) {
      camera.pos[1] = groundY + this.cameraHeight;
    }
  }

  /**
   * Per-triangle mesh collision. Treats the camera as a cylinder and pushes
   * horizontally out of wall triangles. Floor/ceiling surfaces are left to
   * enforceGroundCollision so the two systems never fight.
   */
  enforceMeshCollisions(objects: Obj[], camera: Camera) {
    const radius = 0.5;

    for (const obj of objects) {
      if (!obj.meshCollision) continue;

      const invModel = this.vecMat.matrixInverse([...obj.modelMatrix] as Mat4x4);
      if (!invModel) continue;

      // Test a vertical column of points (feet, mid, head) to catch walls at any height
      const testHeights = [
        camera.pos[1] - this.cameraHeight,       // feet
        camera.pos[1] - this.cameraHeight * 0.5,  // mid
        camera.pos[1],                             // head
      ];

      for (const testY of testHeights) {
        const worldPt: Vec4 = [camera.pos[0], testY, camera.pos[2], 1];
        const localPt = this.vecMat.matrixMultiplyVector(invModel, worldPt);

        const d = obj.dimensions;
        const expand = radius + 0.1;
        if (localPt[0] < d.minX - expand || localPt[0] > d.maxX + expand ||
            localPt[1] < d.minY - expand || localPt[1] > d.maxY + expand ||
            localPt[2] < d.minZ - expand || localPt[2] > d.maxZ + expand) continue;

        for (const group of Object.values(obj.groups)) {
          for (const material of Object.values(group.materials)) {
            const { triangles, vertices } = material;

            for (const tri of triangles) {
              const v0 = vertices[tri.v1.index];
              const v1 = vertices[tri.v2.index];
              const v2 = vertices[tri.v3.index];

              const cp = this.vecMat.closestPointOnTriangle(
                localPt,
                [v0.x, v0.y, v0.z],
                [v1.x, v1.y, v1.z],
                [v2.x, v2.y, v2.z],
              );

              const dx = localPt[0] - cp[0];
              const dy = localPt[1] - cp[1];
              const dz = localPt[2] - cp[2];
              const dist2 = dx*dx + dy*dy + dz*dz;
              if (dist2 >= radius * radius || dist2 < 1e-10) continue;

              // Only push horizontally (XZ) — ground collision owns the Y axis
              const horizDist2 = dx*dx + dz*dz;
              if (horizDist2 < 1e-10) continue;

              const horizDist = Math.sqrt(horizDist2);
              const pen = radius - Math.sqrt(dist2);
              const invH = pen / horizDist;

              // Push in local space, horizontal only
              const pushX = dx * invH;
              const pushZ = dz * invH;

              const localPushed: Vec4 = [localPt[0] + pushX, localPt[1], localPt[2] + pushZ, 1];
              const worldPushed = this.vecMat.matrixMultiplyVector(obj.modelMatrix, localPushed);
              const worldOrig   = this.vecMat.matrixMultiplyVector(obj.modelMatrix, localPt);

              camera.pos[0] += worldPushed[0] - worldOrig[0];
              camera.pos[2] += worldPushed[2] - worldOrig[2];

              // Re-sync local point after push
              const newWorld: Vec4 = [camera.pos[0], testY, camera.pos[2], 1];
              const newLocal = this.vecMat.matrixMultiplyVector(invModel, newWorld);
              localPt[0] = newLocal[0];
              localPt[1] = newLocal[1];
              localPt[2] = newLocal[2];
            }
          }
        }
      }
    }
  }

  savePrevCameraPos(camera: Camera) {
    this.prevCameraPos = [camera.pos[0], camera.pos[1], camera.pos[2], 1];
  }
}
