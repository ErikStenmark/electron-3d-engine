import { Canvas, ICanvas, DrawOpts, DrawTextOpts } from '../canvas';
import { AnyVec, Triangle, Vec4 } from '../../types';

export default class Canvas2D extends Canvas implements ICanvas {
  private context: CanvasRenderingContext2D;
  private fallBackColor = 'rgba(255, 255, 255, 1)';

  constructor(zIndex: number, id = 'canvas2D', lockPointer = false) {
    super(zIndex, id, lockPointer);
    this.context = this.canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  public clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public fill(color?: Vec4) {
    this.context.fillStyle = color ? this.vecToRgb(color) : 'rgba(0, 0, 0, 1)';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  public drawTriangle(triangle: Triangle, opts?: DrawOpts) {
    const [p1, p2, p3, color] = triangle;

    this.context.strokeStyle = opts?.color?.stroke || this.vecToRgb(color) || this.fallBackColor;
    this.context.fillStyle = opts?.color?.fill || this.vecToRgb(color) || this.fallBackColor;

    // Prevent anti-alias by removing decimals with (~~)
    // not sure if this is a net pos or neg...
    this.context.beginPath();
    this.context.moveTo(~~p1[0], ~~p1[1]);
    this.context.lineTo(~~p2[0], ~~p2[1]);
    this.context.lineTo(~~p3[0], ~~p3[1]);
    this.context.closePath();
    this.context.stroke();

    if (!opts?.transparent) {
      this.context.fill()
    }
  }

  /** not implemented */
  public drawMesh(triangles: Triangle[], opts?: DrawOpts | undefined): void {
    return;
  }

  public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
    const font = opts?.font || 'arial';
    const size = opts?.size || 12;

    this.context.textAlign = opts?.align || 'left';
    this.context.font = `${size}px ${font}`;
    this.context.fillStyle = opts?.color || 'white';

    this.context.fillText(text, x, y, opts?.maxWidth);
  }

  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    this.context.strokeStyle = opts?.color?.stroke || this.fallBackColor;
    this.context.fillStyle = opts?.color?.fill || this.fallBackColor;

    this.context.beginPath();
    this.context.moveTo(bx, by);
    this.context.lineTo(ex, ey);
    this.context.closePath();
    this.context.stroke();

    if (!opts?.transparent) {
      this.context.fill()
    }

  }

  public init() {
    return Promise.resolve();
  }

  private vecToRgb(vec: AnyVec): string {
    return 'rgba(' + vec[0] + ',' + vec[1] + ',' + vec[2] + '1)';
  }

}