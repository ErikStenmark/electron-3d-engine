import { Triangle, Vec4 } from '../types';

export type AspectRatio = number;
export interface CanvasConstructor {
  new(zIndex: number, id?: string): Renderer;
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

export interface IRenderer {
  setSize(w: number, h: number): AspectRatio;
  setFullScreen(): AspectRatio;
  getSize(): CanvasDimension;
  getAspectRatio(): AspectRatio;
  RGBGrayScale(value: number): Vec4;
  addPointerLockListener(): void;
  lockPointer(): void;
  removePointerLockListener(): void;
  exitPointerLock(): void;
  exitPointerLock(): void;
  remove(): void;
  append(): AspectRatio;
  clear(): void
  init(): Promise<void>;
  fill(color?: Vec4): void;
  drawTriangle(triangle: Triangle, opts?: DrawOpts): void
  drawMesh(triangles: Triangle[], opts?: DrawOpts): void
  drawText(text: string, x: number, y: number, opts?: DrawTextOpts): void;
  draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts): void
}

export class Renderer {
  private body: HTMLBodyElement;
  protected canvas: HTMLCanvasElement;

  constructor(zIndex: number, id: string, pointerLock: boolean = false) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = id;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.zIndex = `${zIndex}`;
    this.canvas.style.position = 'absolute';

    this.body = document.getElementsByTagName('body')[0];

    if (pointerLock) {
      this.addPointerLockListener();
      this.lockPointer();
    }

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
    return this.canvas.height / this.canvas.width;
  }

  public RGBGrayScale(value: number): Vec4 {
    const col = value * 255;
    const col2 = col + 1 > 255 ? 255 : col;
    const col3 = col + 2 > 255 ? 255 : col;

    return [col, col2, col3, 1];
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