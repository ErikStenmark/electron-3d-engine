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

    public drawTriangle(triangle: Triangle, opts?: DrawOpts) {

    }

    public drawMesh(mesh: Triangle[], opts?: DrawOpts) {
        const encoder = this.device.createCommandEncoder();

        const colAt: GPURenderPassColorAttachment = {
            view: this.context.getCurrentTexture().createView(),
            loadOp: 'clear',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
            storeOp: 'store'
        }

        const renderPass = encoder.beginRenderPass({ colorAttachments: [colAt] });

        renderPass.setPipeline(this.pipeline);
        renderPass.draw(3);
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

        await this.initPipeline();
    }

    private async initPipeline() {
        if (!this.device) {
            throw new Error('no GPU device available');
        }

        if (!this.format) {
            throw new Error('no GPU format available');
        }

        const vertexShader = this.device.createShaderModule({ code: triVertShader });

        const fragShader = this.device.createShaderModule({ code: triFragShader });

        this.pipeline = await this.device.createRenderPipelineAsync({
            vertex: {
                module: vertexShader,
                entryPoint: 'main',
            },
            fragment: {
                module: fragShader,
                entryPoint: 'main',
                targets: [{ format: this.format }]
            },
            primitive: {
                topology: 'triangle-list'
            },
            layout: 'auto'
        });
    }

}