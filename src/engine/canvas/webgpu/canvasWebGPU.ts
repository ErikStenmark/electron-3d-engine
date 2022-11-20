import { Canvas, ICanvas, DrawOpts, DrawTextOpts } from '../canvas';
import { Triangle, Vec4 } from '../../types';

import triVertShader from './shaders/triangle.vert.wgsl';
import triFragShader from './shaders/triangle.frag.wgsl';

export default class CanvasWebGpu extends Canvas implements ICanvas {

    private context: GPUCanvasContext;
    private adapter!: GPUAdapter;
    private device!: GPUDevice;
    private format!: GPUTextureFormat;
    private pipeline!: GPURenderPipeline;
    private vertsPerTriangle = 3;
    private valuesPerTriangle = 21;

    constructor(zIndex: number, id = 'canvasWebGPU', lockPointer = false) {
        super(zIndex, id, lockPointer);

        this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    }

    public setSize(w: number, h: number) {
        const aspectRatio = super.setSize(w, h);
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
        const { width, height } = this.getSize();

        const triangleAmount = mesh.length;
        const vertCount = triangleAmount * this.vertsPerTriangle;

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

        const vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(vertexBuffer, 0, vertices);

        const screen = new Float32Array([width, height]);
        const screenBuffer = this.device.createBuffer({
            size: screen.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.device.queue.writeBuffer(screenBuffer, 0, screen);

        const groupEntry: GPUBindGroupEntry = {
            binding: 0,
            resource: {
                buffer: screenBuffer
            }
        }

        const group = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [groupEntry]
        })

        const encoder = this.device.createCommandEncoder();

        const colAt: GPURenderPassColorAttachment = {
            view: this.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store'
        }

        const depthTexture = this.device.createTexture({
            size: [width, height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        })

        const renderPass = encoder.beginRenderPass({
            colorAttachments: [colAt],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.setBindGroup(0, group);

        renderPass.draw(vertCount);
        renderPass.end();
        const buffer = encoder.finish();
        this.device.queue.submit([buffer]);
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