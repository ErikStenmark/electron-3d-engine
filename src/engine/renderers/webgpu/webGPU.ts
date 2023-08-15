import { Renderer, IRenderer, DrawOpts, DrawTextOpts } from '../renderer';
import { Triangle, Vec4 } from '../../types';
import triVertShader from './shaders/triangle.vert.wgsl';
import triFragShader from './shaders/triangle.frag.wgsl';

export default class CanvasWebGpu extends Renderer implements IRenderer {
  private context: GPUCanvasContext;
  private adapter!: GPUAdapter;
  private device!: GPUDevice;
  private format!: GPUTextureFormat;
  private pipeline!: GPURenderPipeline;
  private screen: Float32Array;
  private screenBuffer!: GPUBuffer;
  private depthTexture!: GPUTexture;

  private vertsPerTriangle = 3;
  private valuesPerTriangle = 21;

  constructor(zIndex: number, id = 'canvasWebGPU', lockPointer = false) {
    super(zIndex, id, lockPointer);

    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    const { width, height } = this.getSize();
    this.screen = new Float32Array([width, height]);
  }

  public setSize(w: number, h: number) {
    const aspectRatio = super.setSize(w, h);
    this.screen = new Float32Array([w, h]);

    this.setScreenBuffer();
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
    this.device.queue.writeBuffer(this.screenBuffer, 0, this.screen);

    renderPass.setPipeline(this.pipeline);

    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: {
          buffer: this.screenBuffer
        }
      }]
    }));

    renderPass.draw(count);
    renderPass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  /** not implemented */
  public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
    return;
  }

  /** not implemented */
  public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
    return;
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
    this.setScreenBuffer();

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

  private setScreenBuffer() {
    if (!this.device) {
      return;
    }

    this.screenBuffer = this.device.createBuffer({
      size: this.screen.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  private setDepthTexture() {
    if (!this.device) {
      return;
    }

    this.depthTexture = this.device.createTexture({
      size: this.screen,
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

    const entry: GPUBindGroupLayoutEntry = {
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' }
    }

    var bindGroupLayout = this.device.createBindGroupLayout({
      entries: [entry]
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