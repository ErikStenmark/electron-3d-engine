import { Mesh, MeshTriangle, Obj, ObjTriangle, Triangle, Vec3, Vec4 } from './types';
import VecMat, { Mat4x4 } from './vecmat';
import { isCpuRenderer, isGlRenderer, Light, Renderer } from './renderers';
import { Camera } from './camera';
import { BVHResult, queryFrustum } from './bvh';

type RenderMode = 'gl' | 'wgpu' | 'cpu';

export class RenderPipeline {
  public culledCount = 0;
  public totalCount = 0;

  constructor(private vecMat: VecMat) {}

  render(
    mesh: Obj | Obj[],
    camera: Camera,
    renderer: Renderer,
    renderMode: RenderMode,
    matView: Mat4x4,
    matProj: Mat4x4,
    matFrustumView: Mat4x4,
    light: Light,
    screenWidth: number,
    screenHeight: number,
    screenXCenter: number,
    screenYCenter: number,
    bvh?: BVHResult,
  ) {
    const meshes = Array.isArray(mesh) ? mesh : [mesh];

    const matVP = this.vecMat.matrixMultiplyMatrix(matFrustumView, matProj);
    const frustumPlanes = this.vecMat.extractFrustumPlanes(matVP);

    let visible: Obj[];
    if (bvh?.root) {
      const indices = queryFrustum(bvh.root, frustumPlanes);
      visible = indices.map(i => meshes[i]);
    } else {
      visible = meshes.filter((obj) => {
        const { min, max } = this.vecMat.getWorldAABB(obj.modelMatrix, obj.dimensions);
        return this.vecMat.aabbInFrustum(frustumPlanes, min, max);
      });
    }
    this.totalCount = meshes.length;
    this.culledCount = meshes.length - visible.length;

    if ((renderMode === 'gl' || renderMode === 'wgpu') && isGlRenderer(renderer)) {
      return renderer.drawObjects(visible);
    }

    const projected = visible.map((obj) =>
      this.projectObject(obj, camera, renderer, renderMode, matView, matProj, light, screenXCenter, screenYCenter)
    );

    if (isGlRenderer(renderer)) {
      return renderer.drawMeshes(projected);
    }

    this.drawMeshWithCPU(
      this.flattenMeshArray(projected),
      renderer,
      screenWidth,
      screenHeight,
    );
  }

  setGlMatrices(renderer: Renderer, matView: Mat4x4, matProj: Mat4x4) {
    if (!isGlRenderer(renderer)) {
      return;
    }
    renderer.setViewMatrix(matView);
    renderer.setProjectionMatrix(matProj);
  }

  private projectObject(
    obj: Obj,
    camera: Camera,
    renderer: Renderer,
    renderMode: RenderMode,
    matView: Mat4x4,
    matProj: Mat4x4,
    light: Light,
    screenXCenter: number,
    screenYCenter: number,
  ): Mesh<Triangle> {
    const projectedTriangles: Mesh<Triangle> = [];
    const { groups } = obj;
    const groupValues = Object.values(groups);

    for (const group of groupValues) {
      const { materials } = group;
      const materialValues = Object.values(materials);

      for (const material of materialValues) {
        const { triangles, vertices } = material;

        let triIndex = triangles.length;
        while (triIndex--) {
          const objTriangle = triangles[triIndex];

          const v1v = vertices[objTriangle.v1.index];
          const v2v = vertices[objTriangle.v2.index];
          const v3v = vertices[objTriangle.v3.index];

          const matWorld = obj.modelMatrix;
          const triangleTransformed: MeshTriangle = [
            this.vecMat.matrixMultiplyVector(matWorld, [v1v.x, v1v.y, v1v.z, 1]),
            this.vecMat.matrixMultiplyVector(matWorld, [v2v.x, v2v.y, v2v.z, 1]),
            this.vecMat.matrixMultiplyVector(matWorld, [v3v.x, v3v.y, v3v.z, 1]),
          ];

          // Calculate triangle normal
          const line1: Vec4 = this.vecMat.vectorSub(
            triangleTransformed[1],
            triangleTransformed[0]
          );
          const line2: Vec4 = this.vecMat.vectorSub(
            triangleTransformed[2],
            triangleTransformed[0]
          );
          const normal = this.vecMat.vectorNormalize(
            this.vecMat.vectorCrossProduct(line1, line2)
          );

          if (isCpuRenderer(renderer)) {
            const cameraRay = this.vecMat.vectorSub(
              triangleTransformed[0],
              camera.pos
            );
            if (this.vecMat.vectorDotProd(normal, cameraRay) > 0) {
              continue;
            }
          }

          // Illumination
          let [r, g, b, a] = light.direction;
          r = r * a;
          g = g * a;
          b = b * a;

          const lightDp = Math.min(
            Math.max(this.vecMat.vectorDotProd([r, g, b, 1], normal), 0.1),
            1
          );

          const triangleColor = isGlRenderer(renderer)
            ? this.vecMat.vectorCreate([lightDp, lightDp, lightDp, 1])
            : this.RGBGrayScale(lightDp);

          if (renderMode !== 'cpu') {
            projectedTriangles.push(
              this.objTriToMeshTri(objTriangle, obj, [
                triangleColor[0],
                triangleColor[1],
                triangleColor[2],
              ])
            );
            continue;
          }

          // Convert world space --> View space
          const triViewed: Triangle = [
            this.vecMat.matrixMultiplyVector(matView, triangleTransformed[0]),
            this.vecMat.matrixMultiplyVector(matView, triangleTransformed[1]),
            this.vecMat.matrixMultiplyVector(matView, triangleTransformed[2]),
            triangleColor,
          ];

          const clippedTriangles = this.vecMat.triangleClipAgainstPlane(
            [0, 0, 0.1, 1],
            [0, 0, 1, 1],
            triViewed
          );

          if (isGlRenderer(renderer)) {
            projectedTriangles.push(...clippedTriangles);
            continue;
          }

          let lClippedTriangles = clippedTriangles.length;
          while (lClippedTriangles--) {
            const clipped = clippedTriangles[lClippedTriangles];

            // Project from 3D --> 2D
            const triProjected: Triangle = [
              this.vecMat.matrixMultiplyVector(matProj, clipped[0]),
              this.vecMat.matrixMultiplyVector(matProj, clipped[1]),
              this.vecMat.matrixMultiplyVector(matProj, clipped[2]),
              clipped[3],
            ];

            // normalize into cartesian space
            triProjected[0] = this.vecMat.vectorDiv(triProjected[0], triProjected[0][3]);
            triProjected[1] = this.vecMat.vectorDiv(triProjected[1], triProjected[1][3]);
            triProjected[2] = this.vecMat.vectorDiv(triProjected[2], triProjected[2][3]);

            // Offset verts into visible normalized space
            const offsetView = this.vecMat.vectorCreate([1, 1, 0, 1]);
            triProjected[0] = this.vecMat.vectorAdd(triProjected[0], offsetView);
            triProjected[1] = this.vecMat.vectorAdd(triProjected[1], offsetView);
            triProjected[2] = this.vecMat.vectorAdd(triProjected[2], offsetView);

            triProjected[0][0] *= screenXCenter;
            triProjected[0][1] *= screenYCenter;
            triProjected[1][0] *= screenXCenter;
            triProjected[1][1] *= screenYCenter;
            triProjected[2][0] *= screenXCenter;
            triProjected[2][1] *= screenYCenter;

            projectedTriangles.push(triProjected);
          }
        }
      }
    }

    return projectedTriangles;
  }

  private clipAgainstScreenEdges(
    triangles: Triangle[],
    screenWidth: number,
    screenHeight: number,
  ) {
    let newTriangles = 1;
    let i = 4;

    if (!triangles[0]) {
      return;
    }

    while (i--) {
      let trianglesToAdd: Triangle[] = [];

      while (newTriangles > 0) {
        const test = triangles.shift() as Triangle;
        newTriangles--;

        switch (i) {
          case 0:
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane(
              [0, 1, 0, 1], [0, 1, 0, 1], test
            ) as Triangle[];
            break;
          case 1:
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane(
              [0, screenHeight - 1, 0, 1], [0, -1, 0, 1], test
            ) as Triangle[];
            break;
          case 2:
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane(
              [1, 0, 0, 1], [1, 0, 0, 1], test
            ) as Triangle[];
            break;
          case 3:
            trianglesToAdd = this.vecMat.triangleClipAgainstPlane(
              [screenWidth - 1, 0, 0, 1], [-1, 0, 0, 1], test
            ) as Triangle[];
            break;
        }
        triangles.push(...trianglesToAdd);
      }
      newTriangles = triangles.length;
    }
  }

  private drawMeshWithCPU(
    projected: Mesh<Triangle>,
    renderer: Renderer,
    screenWidth: number,
    screenHeight: number,
  ) {
    if (!isCpuRenderer(renderer)) {
      return;
    }

    const sortCondition = (tri: Triangle) =>
      tri[0][2] + tri[1][2] + tri[2][2] / 3;
    const sorted = projected.sort(
      (a, b) => sortCondition(b) - sortCondition(a)
    );

    let rasterIndex = sorted.length;
    while (rasterIndex--) {
      const triangleList: Triangle[] = [sorted[rasterIndex]];
      this.clipAgainstScreenEdges(triangleList, screenWidth, screenHeight);

      let triangleIndex = triangleList.length;
      while (triangleIndex--) {
        renderer.drawTriangle(triangleList[triangleIndex]);
      }
    }
  }

  private flattenMeshArray<T extends Triangle | MeshTriangle = MeshTriangle>(
    meshArray: Mesh<T>[] = []
  ): Mesh<T> {
    return ([] as Mesh<T>).concat(...meshArray);
  }

  private objTriToMeshTri(
    tri: ObjTriangle,
    object: Obj,
    color?: Vec3
  ): Triangle<Vec3> {
    const vertices =
      object.groups[tri.groupId].materials[tri.materialId].vertices;

    return [
      this.vecMat.objVectorToVector(vertices[tri.v1.index]),
      this.vecMat.objVectorToVector(vertices[tri.v2.index]),
      this.vecMat.objVectorToVector(vertices[tri.v3.index]),
      color || [1, 1, 1],
    ];
  }

  private RGBGrayScale(value: number): Vec4 {
    const col = value * 255;
    const col2 = col + 1 > 255 ? 255 : col;
    const col3 = col + 2 > 255 ? 255 : col;
    return [col, col2, col3, 1];
  }
}
