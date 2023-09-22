import { RendererBase, IGLRenderer, DrawOpts, GLTransforms, GLLocations } from '../renderer';
import { Obj, Triangle, Vec4 } from '../../types';

import triVertShader from './shaders/triangle.vert.glsl';
import triFragShader from './shaders/triangle.frag.glsl';
import { Mat4x4 } from '../../vecmat';

export default class RendererGLLight extends RendererBase implements IGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  private stride = 9 * Float32Array.BYTES_PER_ELEMENT;
  private colorOffset = 3 * Float32Array.BYTES_PER_ELEMENT; // starts at pos 4 (index)
  private normalOffset = 6 * Float32Array.BYTES_PER_ELEMENT;

  private transforms: GLTransforms = {
    projection: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    view: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    world: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  private locations: GLLocations = {
    model: null,
    position: null,
    color: null,
    normal: null,
    projection: null,
    view: null
  };

  constructor(zIndex: number, id = 'canvasGLTest', lockPointer = false) {
    super(zIndex, id, 'gl', lockPointer);
    this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;

    this.program = this.createProgram();
    this.gl.useProgram(this.program);

    this.locations.position = this.gl.getAttribLocation(this.program, "position");
    this.locations.color = this.gl.getAttribLocation(this.program, "color");
    this.locations.normal = this.gl.getAttribLocation(this.program, 'normal');

    this.locations.model = this.gl.getUniformLocation(this.program, "model");
    this.locations.view = this.gl.getUniformLocation(this.program, "view");
    this.locations.projection = this.gl.getUniformLocation(this.program, "projection");

    this.gl.enable(this.gl.DEPTH_TEST);
  }

  public setWorldMatrix(mat: Mat4x4): void {
    this.transforms.world = mat;
  }

  public setProjectionMatrix(mat: Mat4x4): void {
    this.transforms.projection = mat;
  }

  public setViewMatrix(mat: Mat4x4): void {
    this.transforms.view = mat;
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

  public drawObjects(objects: Obj[]) {
    const objArray = Array.isArray(objects) ? objects : [objects];

    const combinedVertices = [];
    const combinedIndices = [];

    let vertexOffset = 0;

    const objLength = objArray.length;
    for (let i = 0; i < objLength; i++) {
      const object = objArray[i];

      const numVertices = object.vertices.length;
      const numIndices = object.indexes.length;

      // Combine vertices and adjust indices
      for (let i = 0; i < numVertices; i++) {
        const vertex = object.vertices[i];
        combinedVertices.push(vertex.x, vertex.y, vertex.z, 1.0, 1.0, 1.0, vertex.nx, vertex.ny, vertex.nz);
      }

      for (let i = 0; i < numIndices; i++) {
        combinedIndices.push(object.indexes[i] + vertexOffset);
      }

      vertexOffset += numVertices;
    }

    this.objDraw(new Float32Array(combinedVertices), new Uint16Array(combinedIndices));
  }

  public drawObject(object: Obj) {
    const valuesPerVert = 9;
    let vertIndex = object.vertices.length

    const vertices = new Float32Array(vertIndex * valuesPerVert); // amount of values per triangle
    const indices = new Uint16Array(object.indexes); // amount of points in triangle

    while (vertIndex--) {
      let firstVertIndex = vertIndex * valuesPerVert;

      const { x, y, z, nx, ny, nz } = object.vertices[vertIndex];

      // Triangle values
      vertices[firstVertIndex++] = x;
      vertices[firstVertIndex++] = y;
      vertices[firstVertIndex++] = z;

      vertices[firstVertIndex++] = 1.0;
      vertices[firstVertIndex++] = 1.0;
      vertices[firstVertIndex++] = 1.0;

      vertices[firstVertIndex++] = nx;
      vertices[firstVertIndex++] = ny;
      vertices[firstVertIndex++] = nz;
    }

    this.objDraw(vertices, indices);
  }

  public drawMeshes(meshes: Triangle[][], opts?: DrawOpts | undefined): void {
    for (const mesh of meshes) {
      this.drawMesh(mesh);
    }
  }

  public drawMesh(mesh: Triangle[]) {
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

      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p2[0];
      vertices[firstVertIndex++] = p2[1];
      vertices[firstVertIndex++] = p2[2];

      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;

      vertices[firstVertIndex++] = p3[0];
      vertices[firstVertIndex++] = p3[1];
      vertices[firstVertIndex++] = p3[2];

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

    this.gl.uniformMatrix4fv(this.locations.model, false, new Float32Array(this.transforms.world));
    this.gl.uniformMatrix4fv(this.locations.projection, false, new Float32Array(this.transforms.projection));
    this.gl.uniformMatrix4fv(this.locations.view, false, new Float32Array(this.transforms.view));

    // Just draw it
    this.gl.drawElements(this.gl.TRIANGLES, indices.length, this.gl.UNSIGNED_SHORT, 0);
  }

  public init() {
    return Promise.resolve();
  }

  private objDraw(vertices: Float32Array, indices: Uint16Array) {
    this.gl.useProgram(this.program);

    // Create and bind buffers
    const vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STREAM_DRAW);

    const indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

    // Set up attribute pointers
    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(this.locations.position, 3, this.gl.FLOAT, false, this.stride, 0);

    this.gl.enableVertexAttribArray(this.locations.color);
    this.gl.vertexAttribPointer(this.locations.color, 3, this.gl.FLOAT, false, this.stride, this.colorOffset);

    this.gl.enableVertexAttribArray(this.locations.normal);
    this.gl.vertexAttribPointer(this.locations.normal, 3, this.gl.FLOAT, false, this.stride, this.normalOffset);

    // Set uniforms (model, view, projection) here...
    this.gl.uniformMatrix4fv(this.locations.model, false, new Float32Array(this.transforms.world));
    this.gl.uniformMatrix4fv(this.locations.view, false, new Float32Array(this.transforms.view));
    this.gl.uniformMatrix4fv(this.locations.projection, false, new Float32Array(this.transforms.projection));

    // Draw all objects with a single draw call
    this.gl.drawElements(this.gl.TRIANGLES, indices.length, this.gl.UNSIGNED_SHORT, 0);

    // Clean up
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
  }

  private createShader(source: string, type: number) {
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
      throw new Error('vertex shader could not be created');
    }

    const fragmentShader = this.createShader(triFragShader, this.gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      throw new Error('fragment shader could not be created');
    }
    return this.linkProgram(vertexShader, fragmentShader);
  }

}
