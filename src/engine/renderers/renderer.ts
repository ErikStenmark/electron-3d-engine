import { Obj, Triangle, Vec4 } from '../types';
import VecMat, { Mat4x4 } from '../vecmat';

export type RendererType = 'cpu' | 'gl' | 'base';

export type Renderer = IGLRenderer | ICPURenderer;

export type AspectRatio = number;

export interface RendererConstructor {
  new(zIndex: number, id?: string): RendererBase;
}

export type DrawTextOpts = Partial<{
  size: number,
  font: string,
  color: string,
  maxWidth: number,
  align: CanvasTextAlign
}>

export type DrawOpts = {
  transparent?: boolean;
  color?: {
    fill?: string;
    stroke?: string
  }
}

export type CanvasDimension = {
  width: number;
  height: number;
}

export interface IRendererBase {
  setSize(w: number, h: number): AspectRatio;
  setFullScreen(): AspectRatio;
  getSize(): CanvasDimension;
  getAspectRatio(): AspectRatio;
  addPointerLockListener(): void;
  removePointerLockListener(): void;
  lockPointer(): void;
  exitPointerLock(): void;
  remove(): void;
  append(): AspectRatio;
  getRendererType(): RendererType;
  toggleWireframe(): void;
  toggleDiffuseOnly(): void;
  toggleShowOriginal(): void;
  toggleShowHitbox(): void;
}

export type GLTransforms = {
  world: Mat4x4;
  view: Mat4x4;
  projection: Mat4x4;
}

export type GLLocations = {
  model: any;
  view: any;
  projection: any;
  position: any;
  color: any;
  tint: any;
  normal: any;
  lightDirection: any;
  lightColor: any;
  ambientLight: any;
  textureCoordinates: any;
  sampler: any;
  hasTexture: any;
  transparency: any;
}

export type Light = {
  direction: Vec4;
  color: Vec4;
  ambient: Vec4;
}

export interface IGLRenderer extends IRendererBase {
  init(): Promise<void>;
  clear(): void
  fill(color?: Vec4): void;
  drawObject(object: Obj): void;
  drawObjects(objects: Obj[]): void;
  drawMesh(triangles: Triangle[]): void;
  drawMeshes(meshes: Triangle[][]): void;
  drawSkybox(): void;
  setWorldMatrix(mat: Mat4x4): void;
  setViewMatrix(mat: Mat4x4): void;
  setProjectionMatrix(mat: Mat4x4): void;
  setLight(light: Partial<Light>): void;
  setSkyboxTexture(fileName: string): Promise<void>;
  clearSkyboxTexture(): void;
  setEditHighlights(hoveredId: string | null, selectedId: string | null): void;
  drawOutlines(objects: Obj[]): void;
  /** Render a compounding edge glow around the given objects in the given color. Call multiple times per frame for layered glows. */
  applyEdgeGlow(objects: Obj[], color: Vec4): void;
}

export interface ICPURenderer extends IRendererBase {
  clear(): void
  fill(color?: Vec4): void;
  drawTriangle(triangle: Triangle, opts?: DrawOpts): void
  drawText(text: string, x: number, y: number, opts?: DrawTextOpts): void;
  draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts): void;
}

export function isCpuRenderer(obj: IRendererBase): obj is ICPURenderer {
  return obj.getRendererType() === 'cpu';
}

export function isGlRenderer(obj: IRendererBase): obj is IGLRenderer {
  return obj.getRendererType() === 'gl';
}

export class RendererBase implements IRendererBase {
  private body: HTMLBodyElement;
  private type: RendererType;
  protected canvas: HTMLCanvasElement;
  protected vecMat: VecMat = new VecMat();
  protected wireFrameMode = false;
  protected diffuseOnlyMode = false;
  protected showOriginalMode = false;
  protected showHitboxMode = false;

  constructor(zIndex: number, id: string, type: RendererType = 'base', pointerLock: boolean = false) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = id;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.zIndex = `${zIndex}`;
    this.canvas.style.position = 'absolute';
    this.type = type;
    this.body = document.getElementsByTagName('body')[0];

    if (pointerLock) {
      this.addPointerLockListener();
      this.lockPointer();
    }

  }

  public getRendererType() {
    return this.type;
  }

  public toggleWireframe() {
    this.wireFrameMode = !this.wireFrameMode;
  }

  public toggleDiffuseOnly() {
    this.diffuseOnlyMode = !this.diffuseOnlyMode;
  }

  public toggleShowOriginal() {
    this.showOriginalMode = !this.showOriginalMode;
  }

  public toggleShowHitbox() {
    this.showHitboxMode = !this.showHitboxMode;
  }

  public setSize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    return this.getAspectRatio();
  }

  public setFullScreen() {
    return this.setSize(window.innerWidth, window.innerHeight);
  }

  public getSize() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    }
  }

  public getAspectRatio() {
    return this.canvas.width / this.canvas.height;
  }

  public lockPointer() {
    this.canvas.requestPointerLock();
  }

  public addPointerLockListener() {
    document.onclick = () => {
      this.canvas.requestPointerLock()
    }
  }

  public removePointerLockListener() {
    document.onclick = () => { };
  }

  public exitPointerLock() {
    document.exitPointerLock();
  }


  public remove() {
    if (this.canvas) {
      this.canvas.parentNode?.removeChild(this.canvas);
    }
  }

  public append() {
    const aspectRatio = this.setFullScreen();
    this.body.appendChild(this.canvas);
    return aspectRatio;
  }

  protected static createAABBLineData(d: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }) {
    // 8 corners, 8 floats each (pos + normal + uv), 24 line indices (12 edges)
    const { minX, maxX, minY, maxY, minZ, maxZ } = d;
    const vertices = new Float32Array([
      // 8 corners: x, y, z, nx, ny, nz, u, v
      minX, minY, minZ, 0, 0, 0, 0, 0,  // 0
      maxX, minY, minZ, 0, 0, 0, 0, 0,  // 1
      maxX, maxY, minZ, 0, 0, 0, 0, 0,  // 2
      minX, maxY, minZ, 0, 0, 0, 0, 0,  // 3
      minX, minY, maxZ, 0, 0, 0, 0, 0,  // 4
      maxX, minY, maxZ, 0, 0, 0, 0, 0,  // 5
      maxX, maxY, maxZ, 0, 0, 0, 0, 0,  // 6
      minX, maxY, maxZ, 0, 0, 0, 0, 0,  // 7
    ]);
    // 12 edges as line pairs
    const indices = new Uint16Array([
      0, 1, 1, 2, 2, 3, 3, 0,  // front face
      4, 5, 5, 6, 6, 7, 7, 4,  // back face
      0, 4, 1, 5, 2, 6, 3, 7,  // connecting edges
    ]);
    return { vertices, indices };
  }
}