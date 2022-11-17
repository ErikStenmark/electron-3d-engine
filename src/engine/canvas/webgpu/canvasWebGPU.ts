import { Canvas, ICanvas, DrawOpts, DrawTextOpts } from '../canvas';
import { Triangle, Vec4 } from '../../types';

export default class CanvasWebGpu extends Canvas implements ICanvas {
    constructor(zIndex: number, id = 'canvasWebGPU', lockPointer = false) {
        super(zIndex, id, lockPointer);
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

    }

    /** not implemented */
    public drawText(text: string, x: number, y: number, opts?: DrawTextOpts) {
        return;
    }

    /** not implemented */
    public draw(bx: number, by: number, ex: number, ey: number, opts?: DrawOpts) {
        return;
    }

}