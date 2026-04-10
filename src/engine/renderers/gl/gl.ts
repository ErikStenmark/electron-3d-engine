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
import triInstancedVertShader from "./shaders/triangle-instanced.vert.glsl";
import triFragShader from "./shaders/triangle.frag.glsl";
import skyboxVertShader from "./shaders/skybox.vert.glsl";
import skyboxFragShader from "./shaders/skybox.frag.glsl";
import silhouetteVertShader from "./shaders/silhouette.vert.glsl";
import silhouetteFragShader from "./shaders/silhouette.frag.glsl";
import outlineVertShader from "./shaders/outline.vert.glsl";
import outlineFragShader from "./shaders/outline.frag.glsl";
import { Mat4x4 } from "../../vecmat";

type InstancedLocations = {
  position: number;
  normal: number;
  textureCoordinates: number;
  iModel0: number;
  iModel1: number;
  iModel2: number;
  iModel3: number;
  color: WebGLUniformLocation | null;
  tint: WebGLUniformLocation | null;
  transparency: WebGLUniformLocation | null;
  view: WebGLUniformLocation | null;
  projection: WebGLUniformLocation | null;
  lightDirection: WebGLUniformLocation | null;
  lightColor: WebGLUniformLocation | null;
  ambientLight: WebGLUniformLocation | null;
  sampler: WebGLUniformLocation | null;
  hasTexture: WebGLUniformLocation | null;
};

export default class RendererGL
  extends RendererBase
  implements IGLRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private instancedProgram: WebGLProgram;
  private instancedLocations!: InstancedLocations;
  private instanceExt: ANGLE_instanced_arrays | null = null;
  private instanceBufferCache = new Map<string, WebGLBuffer>();

  private skyboxProgram: WebGLProgram | null = null;
  private skyboxLocations: {
    position: number;
    invProjection: WebGLUniformLocation | null;
    invView: WebGLUniformLocation | null;
    skyColorTop: WebGLUniformLocation | null;
    skyColorHorizon: WebGLUniformLocation | null;
    groundColor: WebGLUniformLocation | null;
    useTexture: WebGLUniformLocation | null;
    skyTexture: WebGLUniformLocation | null;
  } | null = null;
  private skyboxQuadVbo: WebGLBuffer | null = null;
  private skyboxEnabled = true;
  private skyboxTexture: WebGLTexture | null = null;

  // Silhouette / outline pass
  private silhouetteProgram: WebGLProgram | null = null;
  private silhouetteLocations: {
    position: number;
    model: WebGLUniformLocation | null;
    view: WebGLUniformLocation | null;
    projection: WebGLUniformLocation | null;
    silhouetteColor: WebGLUniformLocation | null;
  } | null = null;

  private outlineProgram: WebGLProgram | null = null;
  private outlineLocations: {
    position: number;
    silhouette: WebGLUniformLocation | null;
    texelSize: WebGLUniformLocation | null;
    glowColor: WebGLUniformLocation | null;
    radius: WebGLUniformLocation | null;
  } | null = null;

  private outlineQuadVbo: WebGLBuffer | null = null;
  private silhouetteFbo: WebGLFramebuffer | null = null;
  private silhouetteTexture: WebGLTexture | null = null;
  private silhouetteDepth: WebGLRenderbuffer | null = null;

  private hoveredId: string | null = null;
  private selectedId: string | null = null;

  private readonly HOVER_COLOR: Vec4 = [0.0, 0.9, 1.0, 1.0];   // cyan
  private readonly SELECT_COLOR: Vec4 = [1.0, 0.5, 0.0, 1.0];  // orange

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

  private mat4Buf = new Float32Array(16);
  private vec4Buf = new Float32Array(4);

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

    this.instanceExt = this.gl.getExtension("ANGLE_instanced_arrays");

    this.program = this.createProgram(triVertShader, triFragShader);
    this.instancedProgram = this.createProgram(triInstancedVertShader, triFragShader);
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

    this.instancedLocations = {
      position: this.gl.getAttribLocation(this.instancedProgram, "position"),
      normal: this.gl.getAttribLocation(this.instancedProgram, "normal"),
      textureCoordinates: this.gl.getAttribLocation(this.instancedProgram, "textureCoords"),
      iModel0: this.gl.getAttribLocation(this.instancedProgram, "iModel0"),
      iModel1: this.gl.getAttribLocation(this.instancedProgram, "iModel1"),
      iModel2: this.gl.getAttribLocation(this.instancedProgram, "iModel2"),
      iModel3: this.gl.getAttribLocation(this.instancedProgram, "iModel3"),
      color: this.gl.getUniformLocation(this.instancedProgram, "color"),
      tint: this.gl.getUniformLocation(this.instancedProgram, "tint"),
      transparency: this.gl.getUniformLocation(this.instancedProgram, "transparency"),
      view: this.gl.getUniformLocation(this.instancedProgram, "view"),
      projection: this.gl.getUniformLocation(this.instancedProgram, "projection"),
      lightDirection: this.gl.getUniformLocation(this.instancedProgram, "lightDirection"),
      lightColor: this.gl.getUniformLocation(this.instancedProgram, "lightColor"),
      ambientLight: this.gl.getUniformLocation(this.instancedProgram, "ambientLight"),
      sampler: this.gl.getUniformLocation(this.instancedProgram, "sampler"),
      hasTexture: this.gl.getUniformLocation(this.instancedProgram, "hasTexture"),
    };

    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);

    this.initSkybox();
    this.initOutlinePass();
  }

  private initSkybox() {
    this.skyboxProgram = this.createProgram(skyboxVertShader, skyboxFragShader);
    this.skyboxLocations = {
      position: this.gl.getAttribLocation(this.skyboxProgram, "position"),
      invProjection: this.gl.getUniformLocation(this.skyboxProgram, "invProjection"),
      invView: this.gl.getUniformLocation(this.skyboxProgram, "invView"),
      skyColorTop: this.gl.getUniformLocation(this.skyboxProgram, "skyColorTop"),
      skyColorHorizon: this.gl.getUniformLocation(this.skyboxProgram, "skyColorHorizon"),
      groundColor: this.gl.getUniformLocation(this.skyboxProgram, "groundColor"),
      useTexture: this.gl.getUniformLocation(this.skyboxProgram, "useTexture"),
      skyTexture: this.gl.getUniformLocation(this.skyboxProgram, "skyTexture"),
    };

    // Fullscreen triangle (covers entire screen, more efficient than a quad)
    const quadVerts = new Float32Array([
      -1, -1, 0,
       3, -1, 0,
      -1,  3, 0,
    ]);
    this.skyboxQuadVbo = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.skyboxQuadVbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVerts, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }

  private initOutlinePass() {
    const gl = this.gl;

    this.silhouetteProgram = this.createProgram(silhouetteVertShader, silhouetteFragShader);
    this.silhouetteLocations = {
      position: gl.getAttribLocation(this.silhouetteProgram, "position"),
      model: gl.getUniformLocation(this.silhouetteProgram, "model"),
      view: gl.getUniformLocation(this.silhouetteProgram, "view"),
      projection: gl.getUniformLocation(this.silhouetteProgram, "projection"),
      silhouetteColor: gl.getUniformLocation(this.silhouetteProgram, "silhouetteColor"),
    };

    this.outlineProgram = this.createProgram(outlineVertShader, outlineFragShader);
    this.outlineLocations = {
      position: gl.getAttribLocation(this.outlineProgram, "position"),
      silhouette: gl.getUniformLocation(this.outlineProgram, "silhouette"),
      texelSize: gl.getUniformLocation(this.outlineProgram, "texelSize"),
      glowColor: gl.getUniformLocation(this.outlineProgram, "glowColor"),
      radius: gl.getUniformLocation(this.outlineProgram, "radius"),
    };

    // Fullscreen triangle (same as skybox)
    const quadVerts = new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]);
    this.outlineQuadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.outlineQuadVbo);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.allocateSilhouetteFbo();
  }

  private allocateSilhouetteFbo() {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;

    if (this.silhouetteFbo) gl.deleteFramebuffer(this.silhouetteFbo);
    if (this.silhouetteTexture) gl.deleteTexture(this.silhouetteTexture);
    if (this.silhouetteDepth) gl.deleteRenderbuffer(this.silhouetteDepth);

    this.silhouetteTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.silhouetteTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.silhouetteDepth = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.silhouetteDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);

    this.silhouetteFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.silhouetteFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.silhouetteTexture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.silhouetteDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  public setEditHighlights(hoveredId: string | null, selectedId: string | null): void {
    this.hoveredId = hoveredId;
    this.selectedId = selectedId;
  }

  private drawOutlineForObjects(objects: Obj[], color: Vec4) {
    const gl = this.gl;
    const loc = this.silhouetteLocations!;

    gl.useProgram(this.silhouetteProgram);

    this.mat4Buf.set(this.transforms.view);
    gl.uniformMatrix4fv(loc.view, false, this.mat4Buf);
    this.mat4Buf.set(this.transforms.projection);
    gl.uniformMatrix4fv(loc.projection, false, this.mat4Buf);
    this.vec4Buf.set(color);
    gl.uniform4fv(loc.silhouetteColor, this.vec4Buf);

    for (const obj of objects) {
      this.mat4Buf.set(obj.modelMatrix);
      gl.uniformMatrix4fv(loc.model, false, this.mat4Buf);

      for (const group of Object.values(obj.groups)) {
        for (const material of Object.values(group.materials)) {
          const cacheKey = `${obj.sourceId ?? obj.id}:${group.id}:${material.id}`;
          const cached = this.bufferCache.get(cacheKey);
          if (!cached) continue;

          gl.bindBuffer(gl.ARRAY_BUFFER, cached.vbo);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cached.ibo);
          gl.enableVertexAttribArray(loc.position);
          gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, this.stride, 0);
          gl.drawElements(gl.TRIANGLES, cached.indexCount, gl.UNSIGNED_SHORT, 0);
          gl.disableVertexAttribArray(loc.position);
          gl.bindBuffer(gl.ARRAY_BUFFER, null);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
      }
    }
  }

  private compositeOutlineGlow(color: Vec4) {
    const gl = this.gl;
    const loc = this.outlineLocations!;

    gl.useProgram(this.outlineProgram);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.silhouetteTexture);
    gl.uniform1i(loc.silhouette, 0);
    gl.uniform2f(loc.texelSize, 1.0 / this.canvas.width, 1.0 / this.canvas.height);
    this.vec4Buf.set(color);
    gl.uniform4fv(loc.glowColor, this.vec4Buf);
    gl.uniform1f(loc.radius, 8.0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.outlineQuadVbo);
    gl.enableVertexAttribArray(loc.position);
    gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(loc.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
  }

  public applyEdgeGlow(objects: Obj[], color: Vec4): void {
    if (!this.silhouetteProgram || !this.outlineProgram || !this.silhouetteFbo) return;
    if (!objects.length) return;

    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.silhouetteFbo);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.drawOutlineForObjects(objects, color);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    this.compositeOutlineGlow(color);
  }

  public drawOutlines(objects: Obj[]): void {
    if (!this.hoveredId && !this.selectedId) return;

    if (this.hoveredId) {
      this.applyEdgeGlow(objects.filter(o => o.id === this.hoveredId), this.HOVER_COLOR);
    }
    if (this.selectedId) {
      this.applyEdgeGlow(objects.filter(o => o.id === this.selectedId), this.SELECT_COLOR);
    }
  }

  public drawSkybox() {
    if (!this.skyboxEnabled || !this.skyboxProgram || !this.skyboxLocations || !this.skyboxQuadVbo) return;

    const gl = this.gl;
    const loc = this.skyboxLocations;

    gl.useProgram(this.skyboxProgram);
    gl.depthMask(false); // Don't write to depth buffer

    // Compute inverse matrices
    const invProj = this.vecMat.matrixInverse([...this.transforms.projection] as Mat4x4);
    // View matrix without translation (rotation only) for infinite skybox
    const viewRotOnly: Mat4x4 = [...this.transforms.view] as Mat4x4;
    viewRotOnly[12] = 0; viewRotOnly[13] = 0; viewRotOnly[14] = 0;
    const invView = this.vecMat.matrixInverse(viewRotOnly);

    if (invProj) {
      this.mat4Buf.set(invProj);
      gl.uniformMatrix4fv(loc.invProjection, false, this.mat4Buf);
    }
    if (invView) {
      this.mat4Buf.set(invView);
      gl.uniformMatrix4fv(loc.invView, false, this.mat4Buf);
    }

    if (this.skyboxTexture) {
      gl.uniform1f(loc.useTexture, 1.0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.skyboxTexture);
      gl.uniform1i(loc.skyTexture, 0);
    } else {
      gl.uniform1f(loc.useTexture, 0.0);
      gl.uniform3f(loc.skyColorTop, 0.2, 0.4, 0.8);
      gl.uniform3f(loc.skyColorHorizon, 0.7, 0.8, 0.95);
      gl.uniform3f(loc.groundColor, 0.35, 0.3, 0.25);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyboxQuadVbo);
    gl.enableVertexAttribArray(loc.position);
    gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.disableVertexAttribArray(loc.position);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.depthMask(true); // Re-enable depth writing
    gl.useProgram(this.program); // Restore main program
  }

  public clearSkyboxTexture(): void {
    if (this.skyboxTexture) {
      this.gl.deleteTexture(this.skyboxTexture);
      this.skyboxTexture = null;
    }
  }

  public async setSkyboxTexture(fileName: string): Promise<void> {
    const base64 = await window.electron.readFileBase64(fileName);
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

    const img = new Image();
    img.src = `data:${mime};base64,${base64}`;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load skybox image: ${fileName}`));
    });

    const gl = this.gl;
    this.skyboxTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.skyboxTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, null);
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
    if (this.silhouetteFbo) this.allocateSilhouetteFbo();
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

  private uploadSceneUniforms() {
    this.mat4Buf.set(this.transforms.view);
    this.gl.uniformMatrix4fv(this.locations.view, false, this.mat4Buf);
    this.mat4Buf.set(this.transforms.projection);
    this.gl.uniformMatrix4fv(this.locations.projection, false, this.mat4Buf);
    this.vec4Buf.set(this.light.direction);
    this.gl.uniform4fv(this.locations.lightDirection, this.vec4Buf);
    this.vec4Buf.set(this.light.color);
    this.gl.uniform4fv(this.locations.lightColor, this.vec4Buf);
    this.vec4Buf.set(this.light.ambient);
    this.gl.uniform4fv(this.locations.ambientLight, this.vec4Buf);
  }

  public drawObjects(objects: Obj[]): void {
    this.uploadSceneUniforms();

    if (this.instanceExt) {
      const groups = new Map<string, Obj[]>();
      for (const obj of objects) {
        const key = obj.sourceId ?? obj.id;
        let group = groups.get(key);
        if (!group) { group = []; groups.set(key, group); }
        group.push(obj);
      }
      for (const group of groups.values()) {
        if (group.length > 1) {
          this.drawInstanced(group);
        } else {
          this.drawObject(group[0]);
        }
      }
    } else {
      for (const object of objects) {
        this.drawObject(object);
      }
    }

    if (this.showHitboxMode) {
      for (const object of objects) {
        this.drawHitbox(object);
      }
    }

    if (this.showOriginalMode) {
      const identity = this.vecMat.matrixCreateIdentity();
      for (const object of objects) {
        this.drawObjectOverride(object, identity);
      }
    }
  }

  private drawInstanced(objects: Obj[]): void {
    const ext = this.instanceExt!;
    const gl = this.gl;
    const representative = objects[0];

    gl.useProgram(this.instancedProgram);

    this.mat4Buf.set(this.transforms.view);
    gl.uniformMatrix4fv(this.instancedLocations.view, false, this.mat4Buf);
    this.mat4Buf.set(this.transforms.projection);
    gl.uniformMatrix4fv(this.instancedLocations.projection, false, this.mat4Buf);
    this.vec4Buf.set(this.light.direction);
    gl.uniform4fv(this.instancedLocations.lightDirection, this.vec4Buf);
    this.vec4Buf.set(this.light.color);
    gl.uniform4fv(this.instancedLocations.lightColor, this.vec4Buf);
    this.vec4Buf.set(this.light.ambient);
    gl.uniform4fv(this.instancedLocations.ambientLight, this.vec4Buf);

    const instanceCount = objects.length;
    const matrixData = new Float32Array(instanceCount * 16);
    for (let i = 0; i < instanceCount; i++) {
      matrixData.set(objects[i].modelMatrix, i * 16);
    }

    for (const group of Object.values(representative.groups)) {
      for (const material of Object.values(group.materials)) {
        const usedColor = material.color || group.color || representative.color;
        const usedTint = material.tint || group.tint || representative.tint;
        const usedTexture = material.texture || group.texture || representative.texture;
        const usedTransparency = material.transparency || group.transparency || representative.transparency;

        this.vec4Buf.set(usedColor);
        gl.uniform4fv(this.instancedLocations.color, this.vec4Buf);
        this.vec4Buf.set(usedTint);
        gl.uniform4fv(this.instancedLocations.tint, this.vec4Buf);
        gl.uniform1f(this.instancedLocations.transparency, usedTransparency);

        if (usedTexture && !this.diffuseOnlyMode) {
          const { img, id } = usedTexture;
          if (!this.textureCache[id]) {
            const tex = this.createTexture(img);
            if (tex) this.textureCache[id] = tex;
          }
          gl.bindTexture(gl.TEXTURE_2D, this.textureCache[id]);
          gl.activeTexture(gl.TEXTURE0);
          gl.uniform1i(this.instancedLocations.sampler, 0);
        }
        gl.uniform1f(this.instancedLocations.hasTexture, (usedTexture && !this.diffuseOnlyMode) ? 1 : 0);

        const cacheKey = `${representative.sourceId ?? representative.id}:${group.id}:${material.id}`;
        let cached = this.bufferCache.get(cacheKey);
        if (!cached) {
          const valuesPerVert = this.bufferAttrNum;
          let vertIndex = material.vertices.length;
          const vertices = new Float32Array(vertIndex * valuesPerVert);
          const indices = new Uint16Array(material.indexes);
          while (vertIndex--) {
            let vi = vertIndex * valuesPerVert;
            const { x, y, z, nx, ny, nz, u, v } = material.vertices[vertIndex];
            vertices[vi++] = x; vertices[vi++] = y; vertices[vi++] = z;
            vertices[vi++] = nx; vertices[vi++] = ny; vertices[vi++] = nz;
            vertices[vi++] = u; vertices[vi++] = v;
          }
          const vbo = gl.createBuffer()!;
          gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
          gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
          const ibo = gl.createBuffer()!;
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
          cached = { vbo, ibo, indexCount: indices.length };
          this.bufferCache.set(cacheKey, cached);
        }

        let instanceVbo = this.instanceBufferCache.get(cacheKey);
        if (!instanceVbo) {
          instanceVbo = gl.createBuffer()!;
          this.instanceBufferCache.set(cacheKey, instanceVbo);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, instanceVbo);
        gl.bufferData(gl.ARRAY_BUFFER, matrixData, gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, cached.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cached.ibo);

        const loc = this.instancedLocations;
        gl.enableVertexAttribArray(loc.position);
        gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, this.stride, 0);
        gl.enableVertexAttribArray(loc.normal);
        gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, this.stride, this.normalOffset);
        gl.enableVertexAttribArray(loc.textureCoordinates);
        gl.vertexAttribPointer(loc.textureCoordinates, 2, gl.FLOAT, false, this.stride, this.textureOffset);

        gl.bindBuffer(gl.ARRAY_BUFFER, instanceVbo);
        const mat4Stride = 16 * Float32Array.BYTES_PER_ELEMENT;
        const vec4Size = 4 * Float32Array.BYTES_PER_ELEMENT;
        const iModelLocs = [loc.iModel0, loc.iModel1, loc.iModel2, loc.iModel3];
        for (let col = 0; col < 4; col++) {
          gl.enableVertexAttribArray(iModelLocs[col]);
          gl.vertexAttribPointer(iModelLocs[col], 4, gl.FLOAT, false, mat4Stride, col * vec4Size);
          ext.vertexAttribDivisorANGLE(iModelLocs[col], 1);
        }

        if (this.wireFrameMode) {
          gl.uniform1f(loc.hasTexture, 0);
          this.vec4Buf.set(this.WIREFRAME_COLOR);
          gl.uniform4fv(loc.color, this.vec4Buf);
          ext.drawElementsInstancedANGLE(gl.LINE_LOOP, cached.indexCount, gl.UNSIGNED_SHORT, 0, instanceCount);
        } else {
          ext.drawElementsInstancedANGLE(gl.TRIANGLES, cached.indexCount, gl.UNSIGNED_SHORT, 0, instanceCount);
        }

        for (let col = 0; col < 4; col++) {
          ext.vertexAttribDivisorANGLE(iModelLocs[col], 0);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
    }

    gl.useProgram(this.program);
  }

  private drawHitbox(object: Obj) {
    const { vertices, indices } = RendererGL.createAABBLineData(object.dimensions);

    const vbo = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STREAM_DRAW);

    const ibo = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, indices, this.gl.STREAM_DRAW);

    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(this.locations.position, 3, this.gl.FLOAT, false, this.stride, 0);
    this.gl.enableVertexAttribArray(this.locations.normal);
    this.gl.vertexAttribPointer(this.locations.normal, 3, this.gl.FLOAT, false, this.stride, this.normalOffset);
    this.gl.enableVertexAttribArray(this.locations.textureCoordinates);
    this.gl.vertexAttribPointer(this.locations.textureCoordinates, 2, this.gl.FLOAT, false, this.stride, this.textureOffset);

    this.vec4Buf.set([1, 1, 0, 1]);
    this.gl.uniform4fv(this.locations.color, this.vec4Buf); // yellow
    this.vec4Buf.set([0, 0, 0, 0]);
    this.gl.uniform4fv(this.locations.tint, this.vec4Buf);
    this.gl.uniform1f(this.locations.hasTexture, 0);
    this.mat4Buf.set(object.modelMatrix);
    this.gl.uniformMatrix4fv(this.locations.model, false, this.mat4Buf);

    this.gl.drawElements(this.gl.LINES, indices.length, this.gl.UNSIGNED_SHORT, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
  }

  private drawObjectOverride(object: Obj, modelMatrix: Mat4x4) {
    for (const group of Object.values(object.groups)) {
      for (const material of Object.values(group.materials)) {
        const cacheKey = `${object.sourceId ?? object.id}:${group.id}:${material.id}`;
        let cached = this.bufferCache.get(cacheKey);

        if (!cached) continue;

        this.vec4Buf.set(this.WIREFRAME_COLOR);
        this.gl.uniform4fv(this.locations.color, this.vec4Buf);
        this.vec4Buf.set([0, 0, 0, 0]);
        this.gl.uniform4fv(this.locations.tint, this.vec4Buf);
        this.gl.uniform1f(this.locations.hasTexture, 0);
        this.gl.uniform1f(this.locations.transparency, 1);

        this.objDraw(cached.vbo, cached.ibo, cached.indexCount, modelMatrix, true);
      }
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

        this.vec4Buf.set(usedColor);
        this.gl.uniform4fv(this.locations.color, this.vec4Buf);
        this.vec4Buf.set(usedTint);
        this.gl.uniform4fv(this.locations.tint, this.vec4Buf);
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

        const cacheKey = `${object.sourceId ?? object.id}:${group.id}:${material.id}`;
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

  private objDraw(vbo: WebGLBuffer, ibo: WebGLBuffer, indexCount: number, modelMatrix: Mat4x4, forceWireframe = false) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);

    this.gl.enableVertexAttribArray(this.locations.position);
    this.gl.vertexAttribPointer(this.locations.position, 3, this.gl.FLOAT, false, this.stride, 0);

    this.gl.enableVertexAttribArray(this.locations.normal);
    this.gl.vertexAttribPointer(this.locations.normal, 3, this.gl.FLOAT, false, this.stride, this.normalOffset);

    this.gl.enableVertexAttribArray(this.locations.textureCoordinates);
    this.gl.vertexAttribPointer(this.locations.textureCoordinates, 2, this.gl.FLOAT, false, this.stride, this.textureOffset);

    this.mat4Buf.set(modelMatrix);
    this.gl.uniformMatrix4fv(this.locations.model, false, this.mat4Buf);

    if (this.wireFrameMode || forceWireframe) {
      this.gl.uniform1f(this.locations.hasTexture, 0);
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
      if (!forceWireframe) {
        this.vec4Buf.set(this.WIREFRAME_COLOR);
        this.gl.uniform4fv(this.locations.color, this.vec4Buf);
      }
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

  private createProgram(vertSrc: string, fragSrc: string) {
    const vertexShader = this.createShader(vertSrc, this.gl.VERTEX_SHADER);
    if (!vertexShader) {
      throw new Error("vertex shader could not be created");
    }

    const fragmentShader = this.createShader(fragSrc, this.gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      throw new Error("fragment shader could not be created");
    }
    return this.linkProgram(vertexShader, fragmentShader);
  }
}
