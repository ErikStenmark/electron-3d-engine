import { Electron } from '../electron/preload';

import RendererCPU from './renderers/cpu';
import RendererGL from './renderers/gl';
import RendererWebGPU from './renderers/webgpu';
import RendererGLLight from './renderers/gl-light/gl-light';

import { DrawTextOpts, IGLRenderer, Renderer } from './renderers';
import { screenToGLPos } from './renderers/utils';

declare global { interface Window { electron: Electron; } }

export const renderModes = ['light', 'wgpu', 'gl', 'cpu'] as const;
type RenderMode = typeof renderModes[number];

type ConsoleMethod = (...args: any) => void;

type Constructor = Partial<{
  console: ConsoleOpts;
  cpuRenderer: boolean;
  renderer: RenderMode;
}>;

type ConsoleOpts = Partial<{
  enabled: boolean;
  toggleButton: KeyboardEvent['key'];
  customMethods: ConsoleMethod[];
  holdToToggle: boolean;
  color: string;
}>;

const consoleDefaultOptions: Required<ConsoleOpts> = {
  customMethods: [],
  enabled: false,
  holdToToggle: false,
  toggleButton: '§',
  color: 'lime'
}

export abstract class Engine {
  protected renderMode: RenderMode;

  protected renderer: Renderer;
  protected consoleRenderer: RendererCPU | null = null;
  private rendererMap: { [key in RenderMode]: Renderer };

  private prevFrameTime = 0;

  private timeArrPos = 0;
  private maxTimeArr = 20;
  private fpsArr: number[] = [];
  private deltaArr: number[] = [];

  private fps = 0;
  private fpsAvg = 0;
  private deltaAvg = 0;

  private isRunning: boolean;

  private keysPressed: KeyboardEvent['key'][] = [];

  private toggleButtonsPressed: KeyboardEvent['key'][] = [];

  private consoleIsOpen = false;
  private consoleHoldToToggle = consoleDefaultOptions.holdToToggle;
  private consoleIsEnabled = consoleDefaultOptions.enabled;
  private consoleToggleButton = consoleDefaultOptions.toggleButton;
  private consoleCustomMethods = consoleDefaultOptions.customMethods;
  protected consoleColor = consoleDefaultOptions.color;

  private loop = () => 0;
  private gameLoop = () => { };

  protected aspectRatio = 0;
  protected screenWidth = 0;
  protected screenHeight = 0;
  protected screenXCenter = 0;
  protected screenYCenter = 0;

  private consoleMargin = 20;
  private consoleLeft = this.consoleMargin;
  private consoleRight = this.screenWidth - this.consoleMargin;
  private consoleTop = this.consoleMargin;
  private consoleBottom = this.screenHeight - this.consoleMargin;

  protected delta = 0;
  protected elapsedTime = 0;

  protected mouseX = -1;
  protected mouseY = -1;

  protected mouseMovementX = 0;
  protected mouseMovementY = 0;

  constructor(opts?: Constructor) {
    this.renderMode = opts?.renderer || renderModes[0];
    this.isRunning = false;
    this.consoleSetOptions(opts?.console || {});


    this.rendererMap = {
      gl: new RendererGL(10),
      light: new RendererGLLight(10),
      wgpu: new RendererWebGPU(10),
      cpu: new RendererCPU(10)
    }

    this.renderer = this.rendererMap[this.renderMode];
    this.aspectRatio = this.renderer.append();
    this.renderer.addPointerLockListener();

    if (this.consoleIsEnabled) {
      this.enableConsole();
    }

    this.addMouseTracker();
    this.calculateScreen();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
  }

  protected abstract onLoad(): Promise<void>

  protected abstract onUpdate(): void

  public async run(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    await this.engineOnLoad();
    await this.onLoad();
    this.isRunning = true;

    this.loop = () => window.requestAnimationFrame(this.gameLoop);

    this.gameLoop = () => {
      if (this.isRunning) {
        this.engineOnUpdate();
        this.onUpdate();
        this.loop();
      }
    }

    this.loop();
  }

  public end() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.renderer.fill();
    this.consoleRenderer?.clear();
  }

  private addMouseTracker() {
    document.onmousemove = (event) => {
      this.mouseMovementX = event.movementX;
      this.mouseMovementY = event.movementY;
      this.mouseX = event.pageX;
      this.mouseY = event.pageY;
    }

    document.onmouseleave = () => {
      this.mouseX = -1;
      this.mouseY = -1;
    }
  }

  public enableConsole() {
    this.consoleRenderer = new RendererCPU(16, 'console');
    this.consoleRenderer.append();
    this.consoleIsEnabled = true;
  }

  public consoleDisable() {
    this.consoleRenderer?.remove();
    this.consoleRenderer = null;
    this.consoleIsEnabled = false;
    this.consoleIsOpen = false;
  }

  protected resetMouseMovement() {
    this.mouseMovementX = 0;
    this.mouseMovementY = 0;
  }

  protected isKeyPressed(key: KeyboardEvent['key']) {
    return this.keysPressed.includes(key.toLocaleLowerCase());
  }

  protected addConsoleCustomMethod(method: ConsoleMethod) {
    this.consoleCustomMethods.push(method);
  }

  protected setConsoleToggleButton(key: KeyboardEvent['key']) {
    this.consoleToggleButton = key;
  }

  protected setRenderMode(mode: RenderMode) {
    this.renderer.clear();
    this.renderer.removePointerLockListener();
    this.renderer.remove();

    this.renderer = this.rendererMap[mode];

    this.aspectRatio = this.renderer.append();
    this.renderer.addPointerLockListener();
    this.renderMode = mode;
  }

  protected consoleSetOptions(opts: ConsoleOpts) {
    this.consoleIsEnabled = typeof opts.enabled === 'boolean' ? opts.enabled : this.consoleIsEnabled;
    this.consoleHoldToToggle = typeof opts.holdToToggle === 'boolean' ? opts.holdToToggle : this.consoleHoldToToggle;
    this.consoleCustomMethods = opts.customMethods || this.consoleCustomMethods;
    this.consoleToggleButton = opts.toggleButton || this.consoleToggleButton;
    this.consoleColor = opts.color || this.consoleColor;
  }

  protected isToggleButtonPressed(button: string) {
    return this.toggleButtonsPressed.includes(button);
  }

  protected addTogglePressed(button: string) {
    this.toggleButtonsPressed.push(button);
  }

  protected removeToggleButtonPressed(button: string) {
    this.toggleButtonsPressed.splice(this.toggleButtonsPressed.indexOf(button), 1);
  }

  protected handleToggle(button: string, action: () => void) {
    if (this.isKeyPressed(button) && !this.isToggleButtonPressed(button)) {
      this.addTogglePressed(button);
      action();
    } else if (
      this.toggleButtonsPressed.length &&
      this.toggleButtonsPressed.includes(button) &&
      !this.isKeyPressed(button)
    ) {
      this.removeToggleButtonPressed(button);
    }
  }

  private onResize = () => {
    this.aspectRatio = this.renderer.setFullScreen();

    if (this.consoleRenderer) {
      this.consoleRenderer.setFullScreen();
    }

    this.calculateScreen();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    let { key } = e;

    if (!key || key === 'Unidentified') {
      return;
    }

    if (key === 'Escape') {
      window.electron.close();
    }


    key = key.toLocaleLowerCase();
    if (!this.keysPressed.includes(key)) {
      this.keysPressed.push(key);
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed = this.keysPressed.filter(k => k !== e.key.toLocaleLowerCase());
  }

  private handleEngineKeys() {
    this.consoleHandleToggle();
  }

  private consoleHandleToggle() {
    if (!this.consoleIsEnabled) {
      return;
    }

    if (this.consoleHoldToToggle) {
      if (this.isKeyPressed(this.consoleToggleButton)) {
        this.consoleIsOpen = true;
      } else {
        this.consoleIsOpen = false;
      }

      return;
    }

    this.handleToggle(this.consoleToggleButton, () => {
      this.consoleIsOpen = !this.consoleIsOpen;
    });
  }

  private async engineOnLoad() {
    Object.values(this.rendererMap).forEach(renderer => {
      if (typeof (renderer as IGLRenderer).init === 'function') {
        (renderer as IGLRenderer).init();
      }
    });
  }

  private engineOnUpdate() {
    this.calculateTime();
    this.handleEngineKeys();

    if (this.consoleRenderer) {
      this.consoleRenderer.clear();
    }

    if (this.consoleIsEnabled && this.consoleIsOpen) {
      this.consoleMethods();
    }
  }

  private consoleMethods() {
    this.consoleDisplayClockInfo();
    this.consoleDisplayKeysPressed();
    this.consoleDisplayMousePos();
    this.consoleDisplayScreenDimensions();
    this.consoleDrawCrossHair();
    this.consoleRenderMode();

    for (const method of this.consoleCustomMethods) {
      method();
    }
  }

  private calculateScreen() {
    const { width, height } = this.renderer.getSize();
    this.screenWidth = width;
    this.screenHeight = height;
    this.screenXCenter = width / 2;
    this.screenYCenter = height / 2;

    this.consoleBottom = this.screenHeight - this.consoleMargin;
    this.consoleRight = this.screenWidth - this.consoleMargin;
  }

  private calculateTime() {
    const timeNow = new Date().getTime();

    this.delta = this.prevFrameTime > 0
      ? timeNow - this.prevFrameTime
      : 0;

    this.prevFrameTime = timeNow;
    this.elapsedTime += this.delta;

    if (this.consoleIsOpen) {
      this.calculateConsoleTimeInfo();
    }
  }

  private calculateConsoleTimeInfo() {
    const deltaInSeconds = this.delta / 1000;
    this.fps = Math.round(1 / deltaInSeconds);

    this.timeArrPos = this.timeArrPos < this.maxTimeArr
      ? this.timeArrPos
      : 0;

    this.fpsArr[this.timeArrPos] = this.fps;
    this.deltaArr[this.timeArrPos] = this.delta;
    this.timeArrPos++;

    let timeArrLength = this.fpsArr.length;

    let fpsTot = 0;
    let deltaTot = 0;

    while (timeArrLength--) {
      fpsTot += this.fpsArr[timeArrLength];
      deltaTot += this.deltaArr[timeArrLength];
    }

    // limit updates to each 4:th frame for smoother display
    if (this.elapsedTime % 4) {
      return;
    }

    this.fpsAvg = Math.round(fpsTot / this.fpsArr.length);
    this.deltaAvg = Math.round(deltaTot / this.deltaArr.length);
  }

  private prependZero(number: number): string {
    return number < 10 ? `0${number}` : `${number}`
  }

  private msToHMS(ms: number) {
    let seconds = parseInt(`${ms / 1000}`, 10);
    const hours = parseInt(`${seconds / 3600}`, 10);
    seconds = seconds % 3600;
    const minutes = parseInt(`${seconds / 60}`, 10);
    seconds = seconds % 60;

    return `${this.prependZero(hours)}:${this.prependZero(minutes)}:${this.prependZero((seconds))}`;
  }

  private consoleDisplayScreenDimensions() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleRenderer) {
      return
    }

    let text = 'width: ';
    text += this.screenWidth;
    text += ' height: ';
    text += this.screenHeight;
    text += ' aspect ratio: ';
    text += Math.round(this.aspectRatio * 100) / 100;

    this.consoleRenderer.drawText(
      text,
      this.consoleLeft,
      this.consoleBottom,
      { align: 'left', color: this.consoleColor }
    );
  }

  private consoleDisplayClockInfo() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleRenderer) {
      return
    }

    let text = 'fps: ';
    text += this.fpsAvg;
    text += ' delta: ';
    text += this.deltaAvg;
    text += ' run time: ';
    text += this.msToHMS(this.elapsedTime);

    this.consoleRenderer.drawText(
      text,
      this.screenXCenter,
      this.consoleLeft,
      { align: 'center', color: this.consoleColor }
    );
  }

  private consoleDisplayKeysPressed() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.keysPressed.length || !this.consoleRenderer) {
      return;
    }

    let text = 'pressed keys: ';
    text += this.keysPressed.join(', ');
    this.consoleRenderer.drawText(
      text,
      this.consoleRight,
      this.consoleTop,
      { align: 'right', color: this.consoleColor }
    );
  }

  private consoleDisplayMousePos() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleRenderer) {
      return;
    }

    const glX = this.mouseX > -1
      ? screenToGLPos(this.mouseX, this.screenWidth, 'x').toFixed(3)
      : -1

    const glY = this.mouseY > -1
      ? screenToGLPos(this.mouseY, this.screenHeight, 'y').toFixed(3)
      : -1

    const opts: DrawTextOpts = {
      align: 'right',
      color: this.consoleColor
    };

    this.consoleRenderer.drawText(
      'X:' + this.mouseX,
      this.consoleRight - this.consoleMargin * 3,
      this.consoleBottom - this.consoleMargin,
      opts
    );

    this.consoleRenderer.drawText(
      'Y: ' + this.mouseY,
      this.consoleRight,
      this.consoleBottom - this.consoleMargin,
      opts
    );

    this.consoleRenderer.drawText(
      'X:' + glX,
      this.consoleRight - this.consoleMargin * 3,
      this.consoleBottom,
      opts
    );

    this.consoleRenderer.drawText(
      'Y: ' + glY,
      this.consoleRight,
      this.consoleBottom,
      opts
    );
  }

  private consoleDrawCrossHair() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleRenderer) {
      return;
    }

    this.consoleRenderer.draw(
      this.screenXCenter - 10,
      this.screenYCenter,
      this.screenXCenter + 10,
      this.screenYCenter,
      { color: { stroke: this.consoleColor } }
    );

    this.consoleRenderer.draw(
      this.screenXCenter,
      this.screenYCenter - 10,
      this.screenXCenter,
      this.screenYCenter + 10,
      { color: { stroke: this.consoleColor } }
    );
  }

  private consoleRenderMode() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleRenderer) {
      return;
    }

    const text = 'renderer: ' + this.renderMode;
    this.consoleRenderer.drawText(
      text,
      this.consoleLeft,
      this.consoleTop,
      { align: 'left', color: this.consoleColor }
    )
  }

}