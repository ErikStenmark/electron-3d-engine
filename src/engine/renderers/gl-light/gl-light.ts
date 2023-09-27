import { RendererBase, IGLRenderer, DrawOpts, GLTransforms, GLLocations, Light } from '../renderer';
import { Obj, Triangle, Vec4 } from '../../types';

import triVertShader from './shaders/triangle.vert.glsl';
import triFragShader from './shaders/triangle.frag.glsl';
import { Mat4x4 } from '../../vecmat';

export default class RendererGLLight extends RendererBase implements IGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  private light: Light = {
    direction: [0, 1, -1, 1],
    color: [1, 1, 1, 1],
    ambient: [0, 0, 0, 0]
  }

  private stride = 16 * Float32Array.BYTES_PER_ELEMENT;

  private colorOffset = 3 * Float32Array.BYTES_PER_ELEMENT; // starts at pos 4 (index)
  private tintOffset = 7 * Float32Array.BYTES_PER_ELEMENT;
  private normalOffset = 11 * Float32Array.BYTES_PER_ELEMENT;
  private textureOffset = 14 * Float32Array.BYTES_PER_ELEMENT;

  private transforms: GLTransforms = {
    projection: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    view: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    world: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  private locations: GLLocations = {
    model: null,
    position: null,
    color: null,
    tint: null,
    normal: null,
    projection: null,
    view: null,
    lightDirection: null,
    lightColor: null,
    ambientLight: null,
    textureCoordinates: null,
    sampler: null,
    hasTexture: null
  };

  private webGLTexture: WebGLTexture | null = null;

  constructor(zIndex: number, id = 'canvasGLTest', lockPointer = false) {
    super(zIndex, id, 'gl', lockPointer);
    this.gl = this.canvas.getContext('webgl') as WebGLRenderingContext;

    this.program = this.createProgram();
    this.gl.useProgram(this.program);

    this.locations.position = this.gl.getAttribLocation(this.program, "position");
    this.locations.normal = this.gl.getAttribLocation(this.program, 'normal');

    this.locations.color = this.gl.getAttribLocation(this.program, "color");
    this.locations.tint = this.gl.getAttribLocation(this.program, "tint");

    this.locations.textureCoordinates = this.gl.getAttribLocation(this.program, 'textureCoords');
    this.locations.sampler = this.gl.getUniformLocation(this.program, 'sampler');
    this.locations.hasTexture = this.gl.getUniformLocation(this.program, 'hasTexture');

    this.locations.model = this.gl.getUniformLocation(this.program, "model");
    this.locations.view = this.gl.getUniformLocation(this.program, "view");
    this.locations.projection = this.gl.getUniformLocation(this.program, "projection");

    this.locations.lightDirection = this.gl.getUniformLocation(this.program, "lightDirection");
    this.locations.lightColor = this.gl.getUniformLocation(this.program, "lightColor");
    this.locations.ambientLight = this.gl.getUniformLocation(this.program, "ambientLight");

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

  public setLight({ color, direction, ambient }: Light): void {
    if (color) this.light.color = color;
    if (direction) this.light.direction = direction;
    if (ambient) this.light.ambient = ambient;
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

  public drawObjects(objects: Obj[]): void {
    for (const object of objects) {
      this.drawObject(object);
    }
  }

  public drawObject(object: Obj) {
    const valuesPerVert = 16;
    let vertIndex = object.vertices.length
    const { texture, color, tint } = object;

    const vertices = new Float32Array(vertIndex * valuesPerVert); // amount of values per triangle
    const indices = new Uint16Array(object.indexes); // amount of points in triangle

    /** @TODO Textures should be set once and reused over multiple draw calls */
    if (texture) {
      this.webGLTexture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.webGLTexture);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, texture);

      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);

      const textureUnitIndex = 0; // Use texture unit 0
      this.gl.activeTexture(this.gl.TEXTURE0 + textureUnitIndex);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.webGLTexture);
      this.gl.uniform1i(this.locations.sampler, textureUnitIndex);
    }

    // has texture
    this.gl.uniform1f(this.locations.hasTexture, texture ? 1 : 0);

    while (vertIndex--) {
      let firstVertIndex = vertIndex * valuesPerVert;

      const { x, y, z, nx, ny, nz, u, v } = object.vertices[vertIndex];
      const [r, g, b, a] = color;
      const [tr, tg, tb, ta] = tint;

      // Position
      vertices[firstVertIndex++] = x;
      vertices[firstVertIndex++] = y;
      vertices[firstVertIndex++] = z;

      // Color - @TODO not vertex specific so should be set once
      vertices[firstVertIndex++] = r;
      vertices[firstVertIndex++] = g;
      vertices[firstVertIndex++] = b;
      vertices[firstVertIndex++] = a;

      // Tint - @TODO not vertex specific so should be set once
      vertices[firstVertIndex++] = tr;
      vertices[firstVertIndex++] = tg;
      vertices[firstVertIndex++] = tb;
      vertices[firstVertIndex++] = ta;

      // Normal
      vertices[firstVertIndex++] = nx;
      vertices[firstVertIndex++] = ny;
      vertices[firstVertIndex++] = nz;

      // Texture
      vertices[firstVertIndex++] = u;
      vertices[firstVertIndex++] = v;
    }

    this.objDraw(vertices, indices);

    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.gl.deleteTexture(this.webGLTexture);
  }

  public drawMeshes(meshes: Triangle[][], opts?: DrawOpts | undefined): void {
    for (const mesh of meshes) {
      this.drawMesh(mesh);
    }
  }

  /** @TODO this has not been kept up to date with all changes */
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
    this.gl.vertexAttribPointer(this.locations.color, 4, this.gl.FLOAT, false, this.stride, this.colorOffset);

    this.gl.enableVertexAttribArray(this.locations.tint);
    this.gl.vertexAttribPointer(this.locations.tint, 4, this.gl.FLOAT, false, this.stride, this.tintOffset);

    this.gl.enableVertexAttribArray(this.locations.normal);
    this.gl.vertexAttribPointer(this.locations.normal, 3, this.gl.FLOAT, false, this.stride, this.normalOffset);

    this.gl.enableVertexAttribArray(this.locations.textureCoordinates);
    this.gl.vertexAttribPointer(this.locations.textureCoordinates, 2, this.gl.FLOAT, false, this.stride, this.textureOffset);

    // Set uniforms (model, view, projection) here...
    this.gl.uniformMatrix4fv(this.locations.model, false, new Float32Array(this.transforms.world));
    this.gl.uniformMatrix4fv(this.locations.view, false, new Float32Array(this.transforms.view));
    this.gl.uniformMatrix4fv(this.locations.projection, false, new Float32Array(this.transforms.projection));

    this.gl.uniform4fv(this.locations.lightDirection, new Float32Array(this.light.direction));
    this.gl.uniform4fv(this.locations.lightColor, new Float32Array(this.light.color));
    this.gl.uniform4fv(this.locations.ambientLight, new Float32Array(this.light.ambient));

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
