import { Obj, Triangle, Vec4 } from '../types';
import { Mat4x4 } from '../vecmat';

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
  normal: any;
}

export interface IGLRenderer extends IRendererBase {
  init(): Promise<void>;
  clear(): void
  fill(color?: Vec4): void;
  drawObject(object: Obj): void;
  drawObjects(objects: Obj[]): void;
  drawMesh(triangles: Triangle[]): void;
  drawMeshes(meshes: Triangle[][]): void;
  setWorldMatrix(mat: Mat4x4): void;
  setViewMatrix(mat: Mat4x4): void;
  setProjectionMatrix(mat: Mat4x4): void;
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

}