import { Renderer, IRenderer, DrawOpts, DrawTextOpts } from '../renderer';
import { Triangle, Vec4 } from '../../types';

import triVertShader from './shaders/triangle.vert.glsl';
import triFragShader from './shaders/triangle.frag.glsl';

export default class CanvasGLTest extends Renderer implements IRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  private positionLocation: number;
  private colorLocation: WebGLUniformLocation | null;

  constructor(zIndex: number, id = 'canvasGLTest', lockPointer = false) {
    super(zIndex, id, lockPointer);
    this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;
    this.program = this.createProgram();

    this.gl.useProgram(this.program);

    this.positionLocation = this.gl.getAttribLocation(this.program, "position");
    this.colorLocation = this.gl.getUniformLocation(this.program, "color");
    this.gl.enable(this.gl.DEPTH_TEST);
  }

  public setSize(w: number, h: number) {
    const aspectRatio = super.setSize(w, h);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return aspectRatio;
  }

  public clear() {
    this.fill([0, 0, 0, 0]);
  }

  public fill(color?: Vec4) {
    if (!color || !color.length) {
      color = [0, 0, 0, 1];
    }

    this.gl.clearColor(color[0], color[1], color[2], color[3]);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.clear(this.gl.DEPTH_BUFFER_BIT);
  }

  public drawTriangle(triangle: Triangle, opts?: DrawOpts) {

  }

  public drawMesh(mesh: Triangle[], opts?: DrawOpts) {
    function homogeneousToCartesian(point: any) {
      let x = point[0];
      let y = point[1];
      let z = point[2];
      let w = point[3];

      return [x / w, y / w, z / w];
    }


    const draw = (settings: any) => {
      const point1 = homogeneousToCartesian([
        settings.left,
        settings.bottom,
        settings.depth,
        settings.w
      ])

      const point2 = homogeneousToCartesian([
        settings.right,
        settings.bottom,
        settings.depth,
        settings.w,
      ])

      const point3 = homogeneousToCartesian([
        settings.left,
        settings.top,
        settings.depth,
        settings.w,
      ])

      const point4 = homogeneousToCartesian([
        settings.left,
        settings.top,
        settings.depth,
        settings.w,
      ])

      const point5 = homogeneousToCartesian([
        settings.right,
        settings.bottom,
        settings.depth,
        settings.w,
      ])

      const point6 = homogeneousToCartesian([
        settings.right,
        settings.top,
        settings.depth,
        settings.w,
      ])

      const data = new Float32Array([
        //Triangle 1
        ...point1,
        ...point2,
        ...point3,

        //Triangle 2
        ...point4,
        ...point5,
        ...point6
      ]);

      // Create a buffer and bind the data
      const buffer = this.gl.createBuffer();
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);

      // Setup the pointer to our attribute data (the triangles)
      this.gl.enableVertexAttribArray(this.positionLocation);
      this.gl.vertexAttribPointer(this.positionLocation, 3, this.gl.FLOAT, false, 0, 0);

      // Setup the color uniform that will be shared across all triangles
      this.gl.uniform4fv(this.colorLocation, settings.color);

      // Draw the triangles to the screen
      this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    }

    draw({
      top: 0.5, // x
      bottom: -0.5, // x
      left: -0.5, // y
      right: 0.5, // y
      w: 0.7, // w - enlarge this box
      depth: 0, // z
      color: [1, 0.4, 0.4, 1], // red
    });

    draw({
      top: 0.9, // x
      bottom: 0, // x
      left: -0.9, // y
      right: 0.9, // y
      w: 1.1, // w - shrink this box
      depth: 0.5, // z
      color: [0.4, 1, 0.4, 1], // green
    });

    draw({
      top: 1, // x
      bottom: -1, // x
      left: -1, // y
      right: 1, // y
      w: 1.5, // w - Bring this box into range
      depth: -1.5, // z
      color: [0.4, 0.4, 1, 1], // blue
    });

  }

  /** not implemented */
  public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
    return;
  }

  /** not implemented */
  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    return;
  }

  public init() {
    return Promise.resolve();
  }

  private createShader(source: string, type: number) {

    // Compiles either a shader of type gl.VERTEX_SHADER or gl.FRAGMENT_SHADER

    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error('shader could not be created');
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {

      var info = this.gl.getShaderInfoLog(shader);
      throw "Could not compile WebGL program. \n\n" + info;
    }

    return shader
  }

  private linkProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader) {

    const program = this.gl.createProgram();

    if (!program) {
      throw new Error('program creation failed');
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);

    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      throw "Could not compile WebGL program. \n\n" + info;
    }

    return program;
  }

  private createProgram() {
    const vertexShader = this.createShader(triVertShader, this.gl.VERTEX_SHADER);
    if (!vertexShader) {
      throw new Error('vertex shader could not be created')
    }

    const fragmentShader = this.createShader(triFragShader, this.gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      throw new Error('fragment shader could not be created')
    }
    return this.linkProgram(vertexShader, fragmentShader);
  }

}