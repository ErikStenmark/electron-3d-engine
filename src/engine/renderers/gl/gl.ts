import { RendererBase, IGLRenderer, DrawOpts } from '../renderer';
import { Obj, Triangle, Vec4 } from '../../types';

import triVertShader from './shaders/triangle.vert.glsl';
import triFragShader from './shaders/triangle.frag.glsl';
import { Mat4x4 } from '../../vecmat';

export default class RendererGL extends RendererBase implements IGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private trianglePositionLoc: number;
  private triangleColorLoc: number;

  private modelLoc: WebGLUniformLocation | null;
  private viewLoc: WebGLUniformLocation | null;
  private projectionLoc: WebGLUniformLocation | null;

  private model: Mat4x4 | undefined;
  private view: Mat4x4 | undefined;
  private projection: Mat4x4 | undefined;

  // 0  1  2  3  4  5, 6
  // x, y, z, w, r, g, b
  // 7 values per element (length)
  private stride = 7 * Float32Array.BYTES_PER_ELEMENT;
  private colorOffset = 4 * Float32Array.BYTES_PER_ELEMENT; // starts at pos 4 (index)

  constructor(zIndex: number, id = 'canvasGL', lockPointer = false) {
    super(zIndex, id, 'gl', lockPointer);
    this.gl = this.canvas.getContext('webgl2') as WebGLRenderingContext;
    this.program = this.createTriangleProgram();

    this.trianglePositionLoc = this.gl.getAttribLocation(this.program, 'position');
    this.triangleColorLoc = this.gl.getAttribLocation(this.program, 'color');

    this.modelLoc = this.gl.getUniformLocation(this.program, "model");
    this.viewLoc = this.gl.getUniformLocation(this.program, "view");
    this.projectionLoc = this.gl.getUniformLocation(this.program, "projection");

    this.gl.enable(this.gl.DEPTH_TEST);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  public setViewMatrix(mat: Mat4x4): void {
    this.view = mat;
  }

  public setWorldMatrix(mat: Mat4x4): void {
    this.model = mat;
  }

  public setProjectionMatrix(mat: Mat4x4): void {
    this.projection = mat;
  }

  public init() {
    return Promise.resolve();
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
    const [p1, p2, p3, color] = triangle;

    const vertices = [
      p1[0], p1[1], 0.0,
      p2[0], p2[1], 0.0,
      p3[0], p3[1], 0.0
    ];

    this.gl.useProgram(this.program);

    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STREAM_DRAW);
    this.gl.uniform4fv(this.triangleColorLoc, color);
    this.gl.drawElements(this.gl.TRIANGLES, 3, this.gl.UNSIGNED_SHORT, 0);
  }

  public drawObject(object: Obj): void {
    return;
  }

  public drawMesh(mesh: Triangle[], opts?: DrawOpts) {
    const valuesPerTriangle = 21;
    const valuesPerIndex = 3;

    let meshIndex = mesh.length

    const vertices = new Float32Array(meshIndex * valuesPerTriangle); // amount of values per triangle
    const indices = new Uint16Array(meshIndex * valuesPerIndex); // amount of points in triangle

    while (meshIndex--) {
      let firstIndex = meshIndex * 3;
      let firstVertIndex = meshIndex * valuesPerTriangle;

      const [p1, p2, p3, color] = mesh[meshIndex];
      const [r, g, b] = color;

      // Index values
      indices[firstIndex] = firstIndex;
      indices[++firstIndex] = firstIndex;
      indices[++firstIndex] = firstIndex;

      // Triangle values
      vertices[firstVertIndex++] = p1[0];
      vertices[firstVertIndex++] = p1[1];
      vertices[firstVertIndex++] = p1[2];
      vertices[firstVertIndex++] = p1[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p2[0];
      vertices[firstVertIndex++] = p2[1];
      vertices[firstVertIndex++] = p2[2];
      vertices[firstVertIndex++] = p2[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p3[0];
      vertices[firstVertIndex++] = p3[1];
      vertices[firstVertIndex++] = p3[2];
      vertices[firstVertIndex++] = p3[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex] = b;
    }

    this.gl.useProgram(this.program);

    // Index Buffer
    const indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); // Unbind buffer (not sure if this does anything)

    // Vertex Buffer
    const vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STREAM_DRAW);

    // Position
    this.gl.enableVertexAttribArray(this.trianglePositionLoc);
    this.gl.vertexAttribPointer(this.trianglePositionLoc, 4, this.gl.FLOAT, false, this.stride, 0);

    // Color
    this.gl.enableVertexAttribArray(this.triangleColorLoc);
    this.gl.vertexAttribPointer(this.triangleColorLoc, 3, this.gl.FLOAT, false, this.stride, this.colorOffset);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); // Unbind buffer

    this.gl.uniformMatrix4fv(this.modelLoc, false, new Float32Array(this.model || []));
    this.gl.uniformMatrix4fv(this.viewLoc, false, new Float32Array(this.view || []));
    this.gl.uniformMatrix4fv(this.projectionLoc, false, new Float32Array(this.projection || []));


    // Just draw it
    this.gl.drawElements(this.gl.TRIANGLES, indices.length, this.gl.UNSIGNED_SHORT, 0);
  }

  private createTriangleProgram() {
    const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER) as WebGLShader;
    this.gl.shaderSource(vertShader, triVertShader);
    this.gl.compileShader(vertShader);

    if (!this.gl.getShaderParameter(vertShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vertShader);
      throw `Could not compile WebGL vertex shader. \n\n${info}`;
    }

    const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER) as WebGLShader;
    this.gl.shaderSource(fragShader, triFragShader);
    this.gl.compileShader(fragShader);

    if (!this.gl.getShaderParameter(fragShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(fragShader);
      throw `Could not compile WebGL fragment shader. \n\n${info}`;
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

  // Overrides parent method
  public setSize(w: number, h: number) {
    const aspectRatio = super.setSize(w, h);

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    return aspectRatio;
  }

}