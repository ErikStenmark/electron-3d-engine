import { Vec3d } from './vecmat';

type DrawTriangleOpts = {
  fill?: boolean;
  color?: { fill?: string; stroke?: string }
}

export type Triangle = [Vec3d, Vec3d, Vec3d, string?];

export default class Canvas {
  private body: HTMLBodyElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = "canvas";
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.zIndex = '8';
    this.canvas.style.position = "absolute";

    this.body = document.getElementsByTagName("body")[0];
    this.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
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

  public RGBGrayScale(value: number) {
    const col = value * 255;
    return `rgba(${col}, ${col + 1}, ${col + 2}, 1)`
  }

  public fill(color?: string) {
    const ctx = this.getCtx();
    ctx.fillStyle = color || 'rgba(0, 0, 0, 1)';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public drawTriangle(triangle: Triangle, opts?: DrawTriangleOpts) {
    const ctx = this.getCtx();

    ctx.strokeStyle = opts?.color?.stroke || "rgba(255, 255, 255, 1)";
    ctx.fillStyle = opts?.color?.fill || "rgba(255, 255, 255, 1)";

    ctx.beginPath();
    ctx.moveTo(triangle[0].x, triangle[0].y);
    ctx.lineTo(triangle[1].x, triangle[1].y);
    ctx.lineTo(triangle[2].x, triangle[2].y);
    ctx.closePath();
    ctx.stroke();

    if (opts?.fill) {
      ctx.fill()
    }
  }

  private getCtx(): CanvasRenderingContext2D {
    if (!this.ctx) {
      throw new Error('no ctx initialized');
    }

    return this.ctx;
  }
}