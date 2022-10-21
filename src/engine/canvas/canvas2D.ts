import { Canvas, DrawOpts, DrawTextOpts } from './canvas';
import { Triangle, Vec3d } from '../types';

export default class Canvas2D extends Canvas implements Canvas {
  private ctx: CanvasRenderingContext2D;
  private fallBackColor = "rgba(255, 255, 255, 1)";

  constructor(zIndex: number, id = 'canvas2D', lockPointer = false) {
    super(zIndex, id, lockPointer);
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;
  }

  public clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public fill(color?: Vec3d) {
    this.ctx.fillStyle = color ? this.vecToRgb(color) : 'rgba(0, 0, 0, 1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public drawTriangle(triangle: Triangle, opts?: DrawOpts) {
    const [p1, p2, p3, color] = triangle;

    this.ctx.strokeStyle = opts?.color?.stroke || this.vecToRgb(color) || this.fallBackColor;
    this.ctx.fillStyle = opts?.color?.fill || this.vecToRgb(color) || this.fallBackColor;

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

  public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
    const font = opts?.font || 'arial';
    const size = opts?.size || 12;

    this.ctx.textAlign = opts?.align || 'left';
    this.ctx.font = `${size}px ${font}`;
    this.ctx.fillStyle = opts?.color || 'white';

    this.ctx.fillText(text, x, y, opts?.maxWidth);
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

  private vecToRgb(vec: Vec3d): string {
    return 'rgba(' + vec[0] + ',' + vec[1] + ',' + vec[2] + '1)';
  }

}