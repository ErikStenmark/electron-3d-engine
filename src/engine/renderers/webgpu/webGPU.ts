import { RendererBase, IGLRenderer, Light } from '../renderer';
import { Obj, TextureSample, Triangle, Vec4 } from '../../types';
import triVertShader from './shaders/triangle.vert.wgsl';
import triFragShader from './shaders/triangle.frag.wgsl';
import { Mat4x4 } from '../../vecmat';

type CachedBuffer = {
  vbo: GPUBuffer;
  ibo: GPUBuffer;
  indexCount: number;
  wireIbo: GPUBuffer;
  wireIndexCount: number;
};

type DrawCall = {
  bindGroup: GPUBindGroup;
  vbo: GPUBuffer;
  ibo: GPUBuffer;
  indexCount: number;
};

export default class RendererWebGpu extends RendererBase implements IGLRenderer {
  private context: GPUCanvasContext;
  private adapter!: GPUAdapter;
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private wireframePipeline!: GPURenderPipeline;
  private depthTexture!: GPUTexture;

  private view = this.vecMat.matrixCreateIdentity();
  private projection = this.vecMat.matrixCreateIdentity();

  private light: Light = {
    color: [1, 1, 1, 1],
    direction: [0, 1, -1, 1],
    ambient: [0, 0, 0, 0]
  };

  private sceneUniformsBuffer!: GPUBuffer;
  private bindGroupLayout!: GPUBindGroupLayout;
  private sampler!: GPUSampler;
  private dummyTextureView!: GPUTextureView;

  private bufferCache = new Map<string, CachedBuffer>();
  private textureCache = new Map<string, GPUTextureView>();

  private bufferAttrNum = 8;
  private stride = this.bufferAttrNum * Float32Array.BYTES_PER_ELEMENT;

  // ObjectUniforms: model(16) + color(4) + tint(4) + flags(4) = 28 floats = 112 bytes
  private objectUniformSize = 112;

  constructor(zIndex: number, id = 'canvasWebGPU', lockPointer = false) {
    super(zIndex, id, 'gl', lockPointer);
    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
  }

  public setWorldMatrix(_mat: Mat4x4): void { }

  public setViewMatrix(mat: Mat4x4): void {
    this.view = mat;
  }

  public setProjectionMatrix(mat: Mat4x4): void {
    this.projection = mat;
  }

  public setLight({ color, direction, ambient }: Partial<Light>): void {
    if (color) this.light.color = color;
    if (direction) this.light.direction = direction;
    if (ambient) this.light.ambient = ambient;
  }

  public setSize(w: number, h: number) {
    const aspectRatio = super.setSize(w, h);
    if (this.device) {
      this.setDepthTexture();
    }
    return aspectRatio;
  }

  public clear() { this.fill([0, 0, 0, 0]); }
  public fill(_color?: Vec4) { }

  public drawObjects(objects: Obj[]): void {
    if (!this.device || !this.pipeline) return;

    this.writeSceneUniforms();
    const drawCalls = this.prepareDrawCalls(objects);

    const encoder = this.device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    renderPass.setPipeline(this.wireFrameMode ? this.wireframePipeline : this.pipeline);

    for (const call of drawCalls) {
      renderPass.setBindGroup(0, call.bindGroup);
      renderPass.setVertexBuffer(0, call.vbo);
      renderPass.setIndexBuffer(call.ibo, 'uint16');
      renderPass.drawIndexed(call.indexCount);
    }

    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  public drawObject(object: Obj): void {
    this.drawObjects([object]);
  }

  private prepareDrawCalls(objects: Obj[]): DrawCall[] {
    const calls: DrawCall[] = [];

    for (const object of objects) {
      const { color: objColor, tint: objTint, texture: objTexture } = object;

      for (const group of Object.values(object.groups)) {
        const { color: groupColor, tint: groupTint, texture: groupTexture } = group;

        for (const material of Object.values(group.materials)) {
          const { color: mtlColor, tint: mtlTint, texture: mtlTexture } = material;

          const usedColor = mtlColor || groupColor || objColor;
          const usedTint = mtlTint || groupTint || objTint;
          const usedTexture = mtlTexture || groupTexture || objTexture;
          const modelMatrix = material.modelMatrix ?? group.modelMatrix ?? object.modelMatrix;

          const cacheKey = `${object.id}:${group.id}:${material.id}`;

          let cached = this.bufferCache.get(cacheKey);
          if (!cached) {
            cached = this.createGeometryBuffers(material);
            this.bufferCache.set(cacheKey, cached);
          }

          // Resolve texture view
          const textureView = usedTexture
            ? this.getOrCreateTexture(usedTexture)
            : this.dummyTextureView;

          // Build per-object uniform data: model(16) + color(4) + tint(4) + flags(4) = 28 floats
          const objData = new Float32Array(28);
          objData.set(modelMatrix, 0);
          if (this.wireFrameMode) {
            objData.set([0, 1, 0, 1], 16); // green wireframe color
            objData.set([0, 0, 0, 0], 20); // no tint
            objData[24] = 0; // no texture
          } else {
            objData.set(usedColor, 16);
            objData.set(usedTint, 20);
            objData[24] = (usedTexture && !this.diffuseOnlyMode) ? 1 : 0;
          }

          const uniformBuffer = this.device.createBuffer({
            size: this.objectUniformSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
          });
          this.device.queue.writeBuffer(uniformBuffer, 0, objData);

          const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
              { binding: 0, resource: { buffer: this.sceneUniformsBuffer } },
              { binding: 1, resource: { buffer: uniformBuffer } },
              { binding: 2, resource: this.sampler },
              { binding: 3, resource: textureView },
            ]
          });

          const ibo = this.wireFrameMode ? cached.wireIbo : cached.ibo;
          const indexCount = this.wireFrameMode ? cached.wireIndexCount : cached.indexCount;
          calls.push({ bindGroup, vbo: cached.vbo, ibo, indexCount });
        }
      }
    }

    return calls;
  }

  private getOrCreateTexture(texture: TextureSample): GPUTextureView {
    const existing = this.textureCache.get(texture.id);
    if (existing) return existing;

    const { img } = texture;
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    if (!width || !height) return this.dummyTextureView;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const gpuTexture = this.device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.device.queue.copyExternalImageToTexture(
      { source: canvas },
      { texture: gpuTexture },
      [width, height]
    );

    const view = gpuTexture.createView();
    this.textureCache.set(texture.id, view);
    return view;
  }

  private createGeometryBuffers(material: { vertices: { x: number; y: number; z: number; nx: number; ny: number; nz: number; u: number; v: number }[]; indexes: number[] }): CachedBuffer {
    const valuesPerVert = this.bufferAttrNum;
    let vertIndex = material.vertices.length;
    const vertices = new Float32Array(vertIndex * valuesPerVert);

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

    const indices = new Uint16Array(material.indexes);

    // Build line indices from triangle indices: each triangle (a,b,c) -> lines (a,b), (b,c), (c,a)
    const lineIndices = new Uint16Array(indices.length * 2);
    for (let i = 0; i < indices.length; i += 3) {
      const base = i * 2;
      lineIndices[base] = indices[i];
      lineIndices[base + 1] = indices[i + 1];
      lineIndices[base + 2] = indices[i + 1];
      lineIndices[base + 3] = indices[i + 2];
      lineIndices[base + 4] = indices[i + 2];
      lineIndices[base + 5] = indices[i];
    }

    const vbo = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(vbo, 0, vertices);

    const ibo = this.device.createBuffer({
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(ibo, 0, indices);

    const wireIbo = this.device.createBuffer({
      size: lineIndices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(wireIbo, 0, lineIndices);

    return { vbo, ibo, indexCount: indices.length, wireIbo, wireIndexCount: lineIndices.length };
  }

  private writeSceneUniforms() {
    const data = new Float32Array(48);
    data.set(this.view, 0);
    data.set(this.projection, 16);
    data.set(this.light.direction, 32);
    data.set(this.light.color, 36);
    data.set(this.light.ambient, 40);
    this.device.queue.writeBuffer(this.sceneUniformsBuffer, 0, data);
  }

  public drawMeshes(_meshes: Triangle[][]): void { }
  public drawMesh(_mesh: Triangle[]): void { }

  public async init() {
    if (!navigator.gpu) {
      throw new Error('webgpu not supported');
    }

    this.adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance'
    }) as GPUAdapter;

    if (!this.adapter) {
      throw new Error('no webGPU adapter available');
    }

    this.device = await this.adapter.requestDevice();

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque'
    });

    this.setDepthTexture();

    // Sampler for texture filtering
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });

    // 1x1 white dummy texture for materials without textures
    const dummyTexture = this.device.createTexture({
      size: [1, 1],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.device.queue.writeTexture(
      { texture: dummyTexture },
      new Uint8Array([255, 255, 255, 255]),
      { bytesPerRow: 4 },
      [1, 1]
    );
    this.dummyTextureView = dummyTexture.createView();

    // Scene uniforms buffer: 48 floats = 192 bytes
    this.sceneUniformsBuffer = this.device.createBuffer({
      size: 192,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
      ]
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout]
    });

    const vertexShader = this.device.createShaderModule({ code: triVertShader });
    const fragShader = this.device.createShaderModule({ code: triFragShader });

    const vertexBuffers: GPUVertexBufferLayout[] = [{
      arrayStride: this.stride,
      attributes: [
        { format: 'float32x3', offset: 0, shaderLocation: 0 },
        { format: 'float32x3', offset: 3 * Float32Array.BYTES_PER_ELEMENT, shaderLocation: 1 },
        { format: 'float32x2', offset: 6 * Float32Array.BYTES_PER_ELEMENT, shaderLocation: 2 },
      ]
    }];

    const depthStencil: GPUDepthStencilState = {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus'
    };

    this.pipeline = await this.device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: { module: vertexShader, entryPoint: 'main', buffers: vertexBuffers },
      fragment: { module: fragShader, entryPoint: 'main', targets: [{ format: this.format }] },
      primitive: { topology: 'triangle-list' },
      depthStencil,
    });

    this.wireframePipeline = await this.device.createRenderPipelineAsync({
      layout: pipelineLayout,
      vertex: { module: vertexShader, entryPoint: 'main', buffers: vertexBuffers },
      fragment: { module: fragShader, entryPoint: 'main', targets: [{ format: this.format }] },
      primitive: { topology: 'line-list' },
      depthStencil,
    });
  }

  private setDepthTexture() {
    const { width, height } = this.getSize();
    this.depthTexture = this.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }
}
