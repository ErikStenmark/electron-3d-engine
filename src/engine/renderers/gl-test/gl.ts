import { Renderer, IRenderer, DrawOpts, DrawTextOpts } from '../renderer';
import { Triangle, Vec4 } from '../../types';

import triVertShader from './shaders/triangle.vert.glsl';
import triFragShader from './shaders/triangle.frag.glsl';
import { Mat4x4 } from '../../vecmat';

export default class CanvasGLTest extends Renderer implements IRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  private camera!: Mat4x4;
  private stride = 6 * Float32Array.BYTES_PER_ELEMENT;
  private colorOffset = 3 * Float32Array.BYTES_PER_ELEMENT; // starts at pos 4 (index)

  private transforms: { [key: string]: any } = {};
  private locations: { [key: string]: any } = {
    model: null,
    position: null,
    color: null
  };

  constructor(zIndex: number, id = 'canvasGLTest', lockPointer = false) {
    super(zIndex, id, lockPointer);
    this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;

    this.transforms = {}; // All of the matrix transforms
    this.locations = {}; //All of the shader locations

    this.program = this.createProgram();
    this.gl.useProgram(this.program);

    this.locations.position = this.gl.getAttribLocation(this.program, "position");
    this.locations.color = this.gl.getAttribLocation(this.program, "color");

    this.locations.model = this.gl.getUniformLocation(this.program, "model");
    this.locations.view = this.gl.getUniformLocation(this.program, "view");
    this.locations.projection = this.gl.getUniformLocation(this.program, "projection");
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.FRONT);
    this.gl.frontFace(this.gl.CW);
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
    this.computeModelMatrix();
    this.computeViewMatrix();
    this.computePerspectiveMatrix(0.5);
    // this.updateAttributesAndUniforms();

    const valuesPerTriangle = 18;
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
      // vertices[firstVertIndex++] = p1[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p2[0];
      vertices[firstVertIndex++] = p2[1];
      vertices[firstVertIndex++] = p2[2];
      // vertices[firstVertIndex++] = p2[3] as number;
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p3[0];
      vertices[firstVertIndex++] = p3[1];
      vertices[firstVertIndex++] = p3[2];
      // vertices[firstVertIndex++] = p3[3] as number;
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
    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(this.locations.position, 3, this.gl.FLOAT, false, this.stride, 0);

    // Color
    this.gl.enableVertexAttribArray(this.locations.color);
    this.gl.vertexAttribPointer(this.locations.color, 3, this.gl.FLOAT, false, this.stride, this.colorOffset);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); // Unbind buffer

    this.gl.uniformMatrix4fv(this.locations.model, false, new Float32Array(this.transforms.model));
    this.gl.uniformMatrix4fv(this.locations.projection, false, new Float32Array(this.transforms.projection));
    this.gl.uniformMatrix4fv(this.locations.view, false, new Float32Array(this.transforms.view));

    // Just draw it
    this.gl.drawElements(this.gl.TRIANGLES, indices.length, this.gl.UNSIGNED_SHORT, 0);
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

  private translateMatrix(x: number, y: number, z: number) {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1
    ];
  }

  private multiplyMatrices(a: any, b: any) {

    // TODO - Simplify for explanation
    // currently taken from https://github.com/toji/gl-matrix/blob/master/src/gl-matrix/mat4.js#L306-L337

    var result = [];

    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
      a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
      a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

    // Cache only the current line of the second matrix
    var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    result[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    result[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    result[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    result[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    result[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    result[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    result[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    result[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    result[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    result[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    result[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    result[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    result[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
    result[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
    result[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
    result[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;

    return result;
  }

  private multiplyArrayOfMatrices(matrices: any) {

    var inputMatrix = matrices[0];

    for (var i = 1; i < matrices.length; i++) {
      inputMatrix = this.multiplyMatrices(inputMatrix, matrices[i]);
    }

    return inputMatrix;
  }

  private computeModelMatrix() {
    var position = this.translateMatrix(0, 0, 2);

    this.transforms.model = this.multiplyArrayOfMatrices([
      position
    ]);

  }

  private perspectiveMatrix(fieldOfViewInRadians: number, aspectRatio: number, near: number, far: number) {
    /*
       Field of view - the angle in radians of what's in view along the Y axis
       Aspect Ratio - the ratio of the canvas, typically canvas.width / canvas.height
       Near - Anything before this point in the Z direction gets clipped (outside of the clip space)
       Far - Anything after this point in the Z direction gets clipped (outside of the clip space)
    */

    var f = 1.0 / Math.tan(fieldOfViewInRadians / 2);
    var rangeInv = 1 / (near - far);

    return [
      f / aspectRatio, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ];
  }

  private computeViewMatrix() {
    this.transforms.view = this.multiplyArrayOfMatrices([
      this.camera
    ]);

  };

  private computePerspectiveMatrix(fov: number) {

    var fieldOfViewInRadians = Math.PI * fov;
    var aspectRatio = window.innerWidth / window.innerHeight;
    var nearClippingPlaneDistance = 1;
    var farClippingPlaneDistance = 1000;

    this.transforms.projection = this.perspectiveMatrix(
      fieldOfViewInRadians,
      aspectRatio,
      nearClippingPlaneDistance,
      farClippingPlaneDistance
    );
  };

}
