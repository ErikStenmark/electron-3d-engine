import { Canvas, DrawOpts, DrawTextOpts } from './canvas';
import { Triangle, Vec3d } from '../types';

export default class CanvasGL extends Canvas implements Canvas {
  private gl: WebGLRenderingContext;
  private triangleProgram: WebGLProgram;
  private triangleDimLoc: WebGLUniformLocation;
  private trianglePositionLoc: number;
  private triangleColorLoc: number;

  constructor(zIndex: number, id = 'canvasGL', lockPointer = false) {
    super(zIndex, id, lockPointer);
    this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;
    this.triangleProgram = this.createTriangleProgram();
    this.triangleDimLoc = this.gl.getUniformLocation(this.triangleProgram, 'dimensions') as WebGLUniformLocation;
    this.trianglePositionLoc = this.gl.getAttribLocation(this.triangleProgram, 'position');
    this.triangleColorLoc = this.gl.getAttribLocation(this.triangleProgram, 'color');

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public setSize(w: number, h: number) {
    const aspectRatio = super.setSize(w, h);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return aspectRatio;
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
    const [p1, p2, p3, color] = triangle;
    const { width, height } = this.getSize();

    const vertices = [
      p1[0], p1[1], 0.0,
      p2[0], p2[1], 0.0,
      p3[0], p3[1], 0.0
    ];

    this.gl.useProgram(this.triangleProgram);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STREAM_DRAW);
    this.gl.uniform2fv(this.triangleDimLoc, [width, height]);
    this.gl.uniform4fv(this.triangleColorLoc, color);
    this.gl.drawElements(this.gl.TRIANGLES, 3, this.gl.UNSIGNED_SHORT, 0);
  }

  public drawTriangles(triangles: Triangle[], opts?: DrawOpts) {

    const { width, height } = this.getSize();

    const vertices = [];
    const colors = [];
    const indices = [];

    const triangleAmount = triangles.length
    for (let i = 0; i < triangleAmount; i++) {
      const firstIndex = i * 3;

      indices.push(firstIndex, firstIndex + 1, firstIndex + 2);
      const [p1, p2, p3, color] = triangles[i];
      colors.push(...color, ...color, ...color);

      vertices.push(
        p1[0], p1[1], 0.0,
        p2[0], p2[1], 0.0,
        p3[0], p3[1], 0.0
      );
    }

    const vertIntArray = new Float32Array(vertices);
    this.gl.useProgram(this.triangleProgram);

    const indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    const vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.vertexAttribPointer(this.trianglePositionLoc, 3, this.gl.FLOAT, false, 0, 0);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertIntArray, this.gl.STREAM_DRAW);
    this.gl.enableVertexAttribArray(this.trianglePositionLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    const colorBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, colorBuffer);
    this.gl.vertexAttribPointer(this.triangleColorLoc, 4, this.gl.FLOAT, false, 0, 0);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STREAM_DRAW);
    this.gl.enableVertexAttribArray(this.triangleColorLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);

    this.gl.uniform2fv(this.triangleDimLoc, [width, height]);
    // this.gl.uniform4fv(this.triangleColorLoc, [0.5, 0.5, 0.5, 1]);
    this.gl.drawElements(this.gl.TRIANGLES, indices.length, this.gl.UNSIGNED_SHORT, 0);
  }


  public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
    //not implemented
    return;
  }

  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    //not implemented
    return;
  }

  private createTriangleProgram() {

    const transFunction = `
      float trans(float val, float high, float low, float ohigh, float olow) {
        float res = ((val-low)/(high-low))*(ohigh-olow)+olow;
        return res;
      }
    `;

    const vertCode = `
      attribute vec4 position;
      attribute vec4 color;
      uniform vec2 dimensions;
      varying vec4 v_color;

      ${transFunction}

      vec4 translatepos(vec4 position) {
        float x = trans(position.x,dimensions.x,0.0,1.0,-1.0);
        float y = trans(position.y,dimensions.y,0.0,1.0,-1.0)*-1.0;
        vec4 res = vec4(x,y,position.z,1.0);
        return res;
      }

      void main() {
        v_color = color;
        gl_Position = translatepos(position);
      }
    `;

    const fragCode = `
      precision lowp float;
      varying vec4 v_color;

      void main() {
        gl_FragColor = v_color;
      }
    `;

    const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
    this.gl.shaderSource(vertShader, vertCode);
    this.gl.compileShader(vertShader);

    if (!this.gl.getShaderParameter(vertShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vertShader);
      throw `Could not compile WebGL shader. \n\n${info}`;
    }

    const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
    this.gl.shaderSource(fragShader, fragCode);
    this.gl.compileShader(fragShader);

    if (!this.gl.getShaderParameter(fragShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(fragShader);
      throw `Could not compile WebGL shader. \n\n${info}`;
    }

    const program = this.gl.createProgram() as WebGLProgram;
    this.gl.attachShader(program, vertShader);
    this.gl.attachShader(program, fragShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      var info = this.gl.getProgramInfoLog(program);
      throw new Error('Could not compile WebGL program. \n\n' + info);
    }

    return program;
  }

}