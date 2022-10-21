import { Canvas, DrawOpts, DrawTextOpts } from './canvas';
import { Triangle, Vec3d } from '../types';
import { screenToGlPos } from './utils';

export default class CanvasGL extends Canvas implements Canvas {
  private gl: WebGLRenderingContext;
  private triangleProgram: WebGLProgram;
  private triangleIndices = [0, 1, 2];
  private triangleColorLoc: WebGLUniformLocation;

  constructor(zIndex: number, id = 'canvasGL') {
    super(zIndex, id);
    this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;
    this.triangleProgram = this.createTriangleProgram();
    this.triangleColorLoc = this.gl.getUniformLocation(this.triangleProgram, 'color') as WebGLUniformLocation;

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public setSize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
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

  public clear() {
    this.fill([0, 0, 0, 0]);
  }

  public fill(color?: Vec3d) {
    if (!color || !color.length) {
      color = [0, 0, 0, 1];
    }

    this.gl.clearColor(color[0], color[1], color[2], color[3] || 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  public drawTriangle(triangle: Triangle, opts?: DrawOpts) {
    this.reScaleTriangle(triangle);

    // for debugging out of bounds triangle issue in gl
    // for (let i = 0; i < 3; i++) {
    //   for (let a = 0; a < 2; a++) {
    //     if (triangle[i][a] < -1 || triangle[i][a] > 1) {
    //       triangle[3] = [1, 0, 0, 1];
    //       console.log('outside point:', triangle);
    //     }
    //   }
    // }

    const [p1, p2, p3] = triangle;
    const color = this.reScaleRGBVec(triangle[3]);

    const vertices = [
      p1[0], p1[1], 0.0,
      p2[0], p2[1], 0.0,
      p3[0], p3[1], 0.0,
    ];

    this.gl.useProgram(this.triangleProgram);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STREAM_DRAW);
    this.gl.uniform4fv(this.triangleColorLoc, color);

    this.gl.drawElements(this.gl.TRIANGLES, this.triangleIndices.length, this.gl.UNSIGNED_SHORT, 0);
  }

  public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
    //not implemented
    return;
  }

  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    //not implemented
    return;
  }

  public removeCanvas() {
    this.gl = null as any as WebGLRenderingContext;

    if (this.canvas) {
      this.canvas.parentNode?.removeChild(this.canvas);
    }
  }

  private createTriangleProgram() {
    const vertCode =
      'attribute vec4 position;' +
      'void main() {' +
      '  gl_Position = position;' +
      '}';

    const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
    this.gl.shaderSource(vertShader, vertCode);
    this.gl.compileShader(vertShader);

    if (!this.gl.getShaderParameter(vertShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vertShader);
      throw `Could not compile WebGL program. \n\n${info}`;
    }

    const fragCode =
      'precision highp float;' +
      'uniform vec4 color;' +
      'void main() {' +
      '  gl_FragColor = color;' +
      '}';

    const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
    this.gl.shaderSource(fragShader, fragCode);
    this.gl.compileShader(fragShader);

    const program = this.gl.createProgram() as WebGLProgram;
    this.gl.attachShader(program, vertShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      var info = this.gl.getProgramInfoLog(program);
      throw new Error('Could not compile WebGL program. \n\n' + info);
    }

    const vertex_buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertex_buffer);

    const position = this.gl.getAttribLocation(program, 'position');
    this.gl.vertexAttribPointer(position, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(position);

    const Index_Buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, Index_Buffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.triangleIndices), this.gl.STREAM_DRAW);

    return program;
  }

  private reScaleRGBVec(vec: Vec3d) {
    const reScaleVal = (value: number) => {
      if (value > 255) {
        value = 255;
      }

      if (value < 0) {
        value = 0;
      }

      const inputHigh = 255;
      const inputLow = 0;
      const outputHigh = 1;
      const outputLow = 0;

      return ((value - inputLow) / (inputHigh - inputLow))
        * (outputHigh - outputLow) + outputLow;
    }

    vec[0] = reScaleVal(vec[0]);
    vec[1] = reScaleVal(vec[1]);
    vec[2] = reScaleVal(vec[2]);

    return vec;
  }

  private reScaleTriangle(triangle: Triangle) {
    triangle[0][0] = screenToGlPos(triangle[0][0], this.canvas.width, 'x');
    triangle[0][1] = screenToGlPos(triangle[0][1], this.canvas.height, 'y');
    triangle[1][0] = screenToGlPos(triangle[1][0], this.canvas.width, 'x');
    triangle[1][1] = screenToGlPos(triangle[1][1], this.canvas.height, 'y');
    triangle[2][0] = screenToGlPos(triangle[2][0], this.canvas.width, 'x');
    triangle[2][1] = screenToGlPos(triangle[2][1], this.canvas.height, 'y');
    return triangle;
  }

}