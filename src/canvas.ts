import { Triangle } from './vecmat';

type DrawOpts = {
  transparent?: boolean;
  color?: { fill?: string; stroke?: string }
}

export default class Canvas {
  private body: HTMLBodyElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

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
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
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
    let rgba = 'rgba(';
    rgba += col;
    rgba += ', ';
    rgba += col + 1;
    rgba += ', ';
    rgba += col + 2;
    rgba += ', 1)';

    return rgba;
  }

  public fill(color?: string) {
    this.ctx.fillStyle = color || 'rgba(0, 0, 0, 1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    this.ctx.strokeStyle = opts?.color?.stroke || this.fallBackColor;
    this.ctx.fillStyle = opts?.color?.fill || this.fallBackColor;

    this.ctx.beginPath();
    this.ctx.moveTo(bx, by);
    this.ctx.lineTo(ex, ey);
    this.ctx.closePath();
    this.ctx.stroke();

    if (!opts?.transparent) {
      this.ctx.fill()
    }

  }

  public drawTriangle(triangle: Triangle, opts?: DrawOpts) {
    const [p1, p2, p3, color] = triangle;

    this.ctx.strokeStyle = opts?.color?.stroke || color || this.fallBackColor;
    this.ctx.fillStyle = opts?.color?.fill || color || this.fallBackColor;

    // Prevent anti-alias by removing decimals with (~~)
    // not sure if this is a net pos or neg...
    this.ctx.beginPath();
    this.ctx.moveTo(~~p1[0], ~~p1[1]);
    this.ctx.lineTo(~~p2[0], ~~p2[1]);
    this.ctx.lineTo(~~p3[0], ~~p3[1]);
    this.ctx.closePath();
    this.ctx.stroke();

    if (!opts?.transparent) {
      this.ctx.fill()
    }
  }

  public drawText(text: string, x: number, y: number, opts?: { size?: number, font?: string, color?: string, maxWidth?: number, align?: CanvasTextAlign }) {
    const font = opts?.font || 'arial';
    const size = opts?.size || 12;

    this.ctx.textAlign = opts?.align || 'left';
    this.ctx.font = `${size}px ${font}`;
    this.ctx.fillStyle = opts?.color || 'white';

    this.ctx.fillText(text, x, y, opts?.maxWidth);
  }
}