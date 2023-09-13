import { RendererBase, IGLRenderer, DrawOpts } from '../renderer';
import { Obj, Triangle, Vec4 } from '../../types';
import triVertShader from './shaders/triangle.vert.wgsl';
import triFragShader from './shaders/triangle.frag.wgsl';
import { Mat4x4 } from '../../vecmat';

export default class RendererWebGpu extends RendererBase implements IGLRenderer {
  private context: GPUCanvasContext;
  private adapter!: GPUAdapter;
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private depthTexture!: GPUTexture;

  private vertsPerTriangle = 3;
  private valuesPerTriangle = 21;

  private screen = [0, 0, 0, 0];
  private model = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private view = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  private projection = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  private uniforms = this.createUniformsArray();
  private uniformsBuffer!: GPUBuffer;

  constructor(zIndex: number, id = 'canvasWebGPU', lockPointer = false) {
    super(zIndex, id, 'gl', lockPointer);

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    const { width, height } = this.getSize();
    this.screen = [width, height, 0, 0];
  }

  private createUniformsArray() {
    return new Float32Array([
      ...this.model,
      ...this.view,
      ...this.projection
    ])
  }

  public setWorldMatrix(mat: Mat4x4): void {
    this.model = mat;
  }

  public setViewMatrix(mat: Mat4x4): void {
    this.view = mat;
  }

  public setProjectionMatrix(mat: Mat4x4): void {
    this.projection = mat;
  }

  public setSize(w: number, h: number) {
    const aspectRatio = super.setSize(w, h);
    this.screen = [w, h, 0, 0];

    this.setUniformBuffer();
    this.setDepthTexture();

    return aspectRatio;
  }

  public clear() {
    this.fill([0, 0, 0, 0]);
  }

  public fill(color?: Vec4) {
    if (!color || !color.length) {
      color = [0, 0, 0, 1];
    }
  }

  public drawObject(object: Obj): void {

  }

  public drawTriangle(triangle: Triangle<Vec4>, opts?: DrawOpts) {
    const [p1, p2, p3, col] = triangle;
    const vertex = new Float32Array([...p1, ...p2, ...p3]);

    const vertexBuffer = this.device.createBuffer({
      size: vertex.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.device.queue.writeBuffer(vertexBuffer, 0, vertex);

    const encoder = this.device.createCommandEncoder();

    const colAt: GPURenderPassColorAttachment = {
      view: this.context.getCurrentTexture().createView(),
      clearValue: { r: 0, g: 0, b: 0, a: 1 },
      loadOp: 'clear',
      storeOp: 'store'
    }

    const renderPass = encoder.beginRenderPass({ colorAttachments: [colAt] });
    renderPass.setPipeline(this.pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);

    renderPass.draw(3);
    renderPass.end();
    const buffer = encoder.finish();
    this.device.queue.submit([buffer]);
  }

  public drawMesh(mesh: Triangle[], opts?: DrawOpts) {
    if (!mesh.length) {
      return;
    }

    this.setUniformBuffer();
    this.uniforms = this.createUniformsArray();

    const { vertices, count } = this.meshToArray(mesh);

    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    const encoder = this.device.createCommandEncoder();

    const renderPass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        storeOp: 'store'
      } as GPURenderPassColorAttachment],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    this.device.queue.writeBuffer(vertexBuffer, 0, vertices);
    this.device.queue.writeBuffer(this.uniformsBuffer, 0, this.uniforms);

    renderPass.setPipeline(this.pipeline);

    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.uniformsBuffer
          }
        },
      ]
    }));

    renderPass.draw(count);
    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
  }

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

    this.device = await this.adapter.requestDevice({
      requiredFeatures: ["texture-compression-bc" as GPUFeatureName],
      requiredLimits: {
        maxStorageBufferBindingSize: this.adapter.limits.maxStorageBufferBindingSize
      }
    });

    this.setDepthTexture();
    this.setUniformBuffer();

    if (!this.context) {
      throw new Error('no webGPU context');
    }

    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: 'opaque'
    });

    await this.initTriPipeline();
  }

  private setUniformBuffer() {
    if (!this.device) {
      return;
    }

    this.uniformsBuffer = this.device.createBuffer({
      size: this.uniforms.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  private setDepthTexture() {
    if (!this.device) {
      return;
    }

    this.depthTexture = this.device.createTexture({
      size: new Float32Array([this.screen[0], this.screen[1]]),
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  private meshToArray(mesh: Triangle[]) {
    const triangleAmount = mesh.length;
    const count = triangleAmount * this.vertsPerTriangle;

    let meshIndex = triangleAmount;
    const vertices = new Float32Array(meshIndex * this.valuesPerTriangle); // amount of values per triangle

    while (meshIndex--) {
      let firstVertIndex = meshIndex * this.valuesPerTriangle;

      const [p1, p2, p3, color] = mesh[meshIndex];
      const [r, g, b] = color;

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
    };

    return { vertices, count };
  }

  private async initTriPipeline() {
    if (!this.device) {
      throw new Error('no GPU device available');
    }

    if (!this.format) {
      throw new Error('no GPU format available');
    }

    const vertexShader = this.device.createShaderModule({ code: triVertShader });

    const fragShader = this.device.createShaderModule({ code: triFragShader });

    const vertexAttributes: GPUVertexAttribute = {
      format: 'float32x4',
      offset: 0,
      shaderLocation: 0
    }

    const colorAttributes: GPUVertexAttribute = {
      format: 'float32x3',
      offset: 4 * Float32Array.BYTES_PER_ELEMENT,
      shaderLocation: 1
    }

    const vertexLayout: GPUVertexBufferLayout = {
      arrayStride: 7 * Float32Array.BYTES_PER_ELEMENT,
      attributes: [
        vertexAttributes,
        colorAttributes
      ]
    }

    const uniforms: GPUBindGroupLayoutEntry = {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' }
    }

    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [uniforms]
    });

    const layout = this.device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

    this.pipeline = await this.device.createRenderPipelineAsync({
      layout,
      vertex: {
        module: vertexShader,
        entryPoint: 'main',
        buffers: [vertexLayout]
      },
      fragment: {
        module: fragShader,
        entryPoint: 'main',
        targets: [{ format: this.format }]
      },
      primitive: {
        topology: 'triangle-list'
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus'
      }
    });
  }

}