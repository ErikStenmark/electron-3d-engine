import {
  RendererBase,
  IGLRenderer,
  DrawOpts,
  GLTransforms,
  GLLocations,
  Light,
} from "../renderer";
import { Obj, Triangle, Vec4 } from "../../types";

import triVertShader from "./shaders/triangle.vert.glsl";
import triFragShader from "./shaders/triangle.frag.glsl";
import { Mat4x4 } from "../../vecmat";

export default class RendererGL
  extends RendererBase
  implements IGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  // Add these color constants
  private readonly WIREFRAME_COLOR: Vec4 = [0, 1, 0, 1]; // Green

  private light: Light = {
    direction: [0, 1, -1, 1],
    color: [1, 1, 1, 1],
    ambient: [0, 0, 0, 0],
  };

  private textureCache: { [key: string]: WebGLTexture } = {};

  private bufferCache = new Map<string, { vbo: WebGLBuffer; ibo: WebGLBuffer; indexCount: number }>();

  private bufferAttrNum: number = 8;
  private stride = this.bufferAttrNum * Float32Array.BYTES_PER_ELEMENT;

  private normalOffset = 3 * Float32Array.BYTES_PER_ELEMENT;
  private textureOffset = 6 * Float32Array.BYTES_PER_ELEMENT;

  private transforms: GLTransforms = {
    projection: this.vecMat.matrixCreateIdentity(),
    view: this.vecMat.matrixCreateIdentity(),
    world: this.vecMat.matrixCreateIdentity(),
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
    hasTexture: null,
    transparency: null,
  };

  constructor(zIndex: number, id = "canvasGLTest", lockPointer = false) {
    super(zIndex, id, "gl", lockPointer);
    this.gl = this.canvas.getContext("webgl") as WebGLRenderingContext;

    this.program = this.createProgram();
    this.gl.useProgram(this.program);

    this.locations.position = this.gl.getAttribLocation(
      this.program,
      "position"
    );
    this.locations.normal = this.gl.getAttribLocation(this.program, "normal");
    this.locations.textureCoordinates = this.gl.getAttribLocation(
      this.program,
      "textureCoords"
    );

    this.locations.color = this.gl.getUniformLocation(this.program, "color");
    this.locations.tint = this.gl.getUniformLocation(this.program, "tint");
    this.locations.transparency = this.gl.getUniformLocation(
      this.program,
      "transparency"
    );

    this.locations.sampler = this.gl.getUniformLocation(
      this.program,
      "sampler"
    );
    this.locations.hasTexture = this.gl.getUniformLocation(
      this.program,
      "hasTexture"
    );

    this.locations.model = this.gl.getUniformLocation(this.program, "model");
    this.locations.view = this.gl.getUniformLocation(this.program, "view");
    this.locations.projection = this.gl.getUniformLocation(
      this.program,
      "projection"
    );

    this.locations.lightDirection = this.gl.getUniformLocation(
      this.program,
      "lightDirection"
    );
    this.locations.lightColor = this.gl.getUniformLocation(
      this.program,
      "lightColor"
    );
    this.locations.ambientLight = this.gl.getUniformLocation(
      this.program,
      "ambientLight"
    );

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

  private createTexture(img: HTMLImageElement) {
    const webGLTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, webGLTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      img
    );

    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );

    return webGLTexture;
  }

  public drawObject(object: Obj) {
    const { texture: objTexture, color: objColor, tint: objTint } = object;

    for (const group of Object.values(object.groups)) {
      const { texture: groupTexture, color: groupColor, tint: groupTint } = group;

      for (const material of Object.values(group.materials)) {
        const { texture: mtlTexture, color: mtlColor, tint: mtlTint } = material;

        const usedColor = mtlColor || groupColor || objColor;
        const usedTint = mtlTint || groupTint || objTint;
        const usedTexture = mtlTexture || groupTexture || objTexture;
        const usedTransparency = material.transparency || group.transparency || object.transparency;

        this.gl.uniform4fv(this.locations.color, new Float32Array(usedColor));
        this.gl.uniform4fv(this.locations.tint, new Float32Array(usedTint));
        this.gl.uniform1f(this.locations.transparency, usedTransparency);

        if (usedTexture) {
          const { img, id } = usedTexture;
          if (!img) {
            console.error("Texture not found:", id);
            return;
          }
          if (!this.textureCache[id]) {
            const webGLTexture = this.createTexture(img);
            if (webGLTexture) {
              this.textureCache[id] = webGLTexture;
            }
          }
          this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureCache[id]);
          this.gl.activeTexture(this.gl.TEXTURE0);
          this.gl.uniform1i(this.locations.sampler, 0);
        }

        this.gl.uniform1f(this.locations.hasTexture, (usedTexture && !this.diffuseOnlyMode) ? 1 : 0);

        // Resolve model matrix: material > group > object
        const modelMatrix = material.modelMatrix ?? group.modelMatrix ?? object.modelMatrix;

        const cacheKey = `${object.id}:${group.id}:${material.id}`;
        let cached = this.bufferCache.get(cacheKey);

        if (!cached) {
          const valuesPerVert = this.bufferAttrNum;
          let vertIndex = material.vertices.length;
          const vertices = new Float32Array(vertIndex * valuesPerVert);
          const indices = new Uint16Array(material.indexes);

          while (vertIndex--) {
            let vi = vertIndex * valuesPerVert;
            const { x, y, z, nx, ny, nz, u, v } = material.vertices[vertIndex];
            vertices[vi++] = x;
            vertices[vi++] = y;
            vertices[vi++] = z;
            vertices[vi++] = nx;
            vertices[vi++] = ny;
            vertices[vi++] = nz;
            vertices[vi++] = u;
            vertices[vi++] = v;
          }

          const vbo = this.gl.createBuffer()!;
          this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
          this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

          const ibo = this.gl.createBuffer()!;
          this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);
          this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STATIC_DRAW);

          cached = { vbo, ibo, indexCount: indices.length };
          this.bufferCache.set(cacheKey, cached);
        }

        this.objDraw(cached.vbo, cached.ibo, cached.indexCount, modelMatrix);

        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
      }
    }
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

    let meshIndex = mesh.length;

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

    // Index Buffer
    const indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      indices,
      this.gl.STATIC_DRAW
    );
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); // Unbind buffer (not sure if this does anything)

    // Vertex Buffer
    const vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STREAM_DRAW);

    // Position
    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(
      this.locations.position,
      3,
      this.gl.FLOAT,
      false,
      this.stride,
      0
    );

    // // Color
    // this.gl.enableVertexAttribArray(this.locations.color);
    // this.gl.vertexAttribPointer(this.locations.color, 3, this.gl.FLOAT, false, this.stride, this.colorOffset);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null); // Unbind buffer

    this.gl.uniformMatrix4fv(
      this.locations.model,
      false,
      new Float32Array(this.transforms.world)
    );
    this.gl.uniformMatrix4fv(
      this.locations.projection,
      false,
      new Float32Array(this.transforms.projection)
    );
    this.gl.uniformMatrix4fv(
      this.locations.view,
      false,
      new Float32Array(this.transforms.view)
    );

    // Just draw it
    this.gl.drawElements(
      this.gl.TRIANGLES,
      indices.length,
      this.gl.UNSIGNED_SHORT,
      0
    );
  }

  public init() {
    return Promise.resolve();
  }

  private objDraw(vbo: WebGLBuffer, ibo: WebGLBuffer, indexCount: number, modelMatrix: Mat4x4) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);

    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(this.locations.position, 3, this.gl.FLOAT, false, this.stride, 0);

    this.gl.enableVertexAttribArray(this.locations.normal);
    this.gl.vertexAttribPointer(this.locations.normal, 3, this.gl.FLOAT, false, this.stride, this.normalOffset);

    this.gl.enableVertexAttribArray(this.locations.textureCoordinates);
    this.gl.vertexAttribPointer(this.locations.textureCoordinates, 2, this.gl.FLOAT, false, this.stride, this.textureOffset);

    this.gl.uniformMatrix4fv(this.locations.model, false, new Float32Array(modelMatrix));
    this.gl.uniformMatrix4fv(this.locations.view, false, new Float32Array(this.transforms.view));
    this.gl.uniformMatrix4fv(this.locations.projection, false, new Float32Array(this.transforms.projection));

    this.gl.uniform4fv(this.locations.lightDirection, new Float32Array(this.light.direction));
    this.gl.uniform4fv(this.locations.lightColor, new Float32Array(this.light.color));
    this.gl.uniform4fv(this.locations.ambientLight, new Float32Array(this.light.ambient));

    if (this.wireFrameMode) {
      this.gl.uniform1f(this.locations.hasTexture, 0);
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
      this.gl.uniform4fv(this.locations.color, new Float32Array(this.WIREFRAME_COLOR));
      this.gl.drawElements(this.gl.LINE_LOOP, indexCount, this.gl.UNSIGNED_SHORT, 0);
      this.gl.disable(this.gl.BLEND);
    } else {
      this.gl.drawElements(this.gl.TRIANGLES, indexCount, this.gl.UNSIGNED_SHORT, 0);
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
  }

  private createShader(source: string, type: number) {
    const shader = this.gl.createShader(type);
    if (!shader) {
      throw new Error("shader could not be created");
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      var info = this.gl.getShaderInfoLog(shader);
      throw "Could not compile WebGL program. \n\n" + info;
    }

    return shader;
  }

  private linkProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader) {
    const program = this.gl.createProgram();

    if (!program) {
      throw new Error("program creation failed");
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
    const vertexShader = this.createShader(
      triVertShader,
      this.gl.VERTEX_SHADER
    );
    if (!vertexShader) {
      throw new Error("vertex shader could not be created");
    }

    const fragmentShader = this.createShader(
      triFragShader,
      this.gl.FRAGMENT_SHADER
    );
    if (!fragmentShader) {
      throw new Error("fragment shader could not be created");
    }
    return this.linkProgram(vertexShader, fragmentShader);
  }
}
