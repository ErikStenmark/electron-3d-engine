import { Triangle } from './vecmat';

type DrawOpts = {
  fill?: boolean;
  color?: { fill?: string; stroke?: string }
}

export default class Canvas {
  private body: HTMLBodyElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;

  private fallBackColor = "rgba(255, 255, 255, 1)";

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

  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    const ctx = this.getCtx();

    ctx.strokeStyle = opts?.color?.stroke || this.fallBackColor;
    ctx.fillStyle = opts?.color?.fill || this.fallBackColor;

    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.closePath();
    ctx.stroke();

    if (opts?.fill) {
      ctx.fill()
    }

  }

  public floatToInt(float: number): number {
    return ~~float;
  }

  public drawTriangle(triangle: Triangle, opts?: DrawOpts) {
    const ctx = this.getCtx();

    const [p1, p2, p3, color] = triangle;

    ctx.strokeStyle = opts?.color?.stroke || color || this.fallBackColor;
    ctx.fillStyle = opts?.color?.fill || color || this.fallBackColor;

    // Prevent anti-alias by removing decimals
    // not sure if this is a net pos or neg...
    const p1X = this.floatToInt(p1[0]);
    const p1Y = this.floatToInt(p1[1]);

    const p2X = this.floatToInt(p2[0]);
    const p2Y = this.floatToInt(p2[1]);

    const p3X = this.floatToInt(p3[0]);
    const p3Y = this.floatToInt(p3[1]);

    ctx.beginPath();
    ctx.moveTo(p1X, p1Y);
    ctx.lineTo(p2X, p2Y);
    ctx.lineTo(p3X, p3Y);
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