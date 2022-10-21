import { Triangle, Vec3d } from '../types';

export type DrawTextOpts = Partial<{
  size: number,
  font: string,
  color: string,
  maxWidth: number,
  align: CanvasTextAlign
}>

export type DrawOpts = {
  transparent?: boolean;
  color?: { fill?: string; stroke?: string }
}

export interface CanvasConstructor {
  new(zIndex: number, id?: string): Canvas;
}

export type AspectRatio = number;

export type CanvasDimension = {
  width: number;
  height: number;
}

export interface Canvas {
  setSize(w: number, h: number): AspectRatio;
  getSize(): CanvasDimension;
  getAspectRatio(): AspectRatio;
  RGBGrayScale(value: number): Vec3d;
  addPointerLockListener(): void;
  removePointerLockListener(): void;
  exitPointerLock(): void;
  exitPointerLock(): void;
  removeCanvas(): void;
  clear(): void
  fill(color?: Vec3d): void;
  drawTriangle(triangle: Triangle, opts?: DrawOpts): void
  drawText(text: string, x: number, y: number, opts?: DrawTextOpts): void;
  draw(
    bx: number,
    by: number,
    ex: number,
    ey: number,
    opts?: DrawOpts
  ): void
}

export class Canvas {
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
    this.body.appendChild(this.canvas);

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

  public getSize() {
    return {
      width: this.canvas.width,
      height: this.canvas.height
    }
  }

  public getAspectRatio() {
    return this.canvas.height / this.canvas.width;
  }

  public RGBGrayScale(value: number): Vec3d {
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


  public removeCanvas() {
    if (this.canvas) {
      this.canvas.parentNode?.removeChild(this.canvas);
    }
  }

}