import { Electron } from './preload';
import Canvas2D from './canvas/canvas2D';
import CanvasGL from './canvas/canvasGL';
import { Canvas } from './canvas';

declare global { interface Window { electron: Electron; } }

type ConsoleMethod = (...args: any) => void;

type ConsoleOpts = Partial<{
  enabled: boolean;
  toggleButton: KeyboardEvent['key'];
  customMethods: ConsoleMethod[];
  holdToToggle: boolean;
  color: string;
}>;

type Constructor = Partial<{
  console: ConsoleOpts;
  mode: RenderMode;
}>;

const consoleDefaultOptions: Required<ConsoleOpts> = {
  customMethods: [],
  enabled: false,
  holdToToggle: false,
  toggleButton: '§',
  color: 'lime'
}

type RenderMode = '2d' | 'gl';

export abstract class Engine {
  private canvasGL: CanvasGL;
  private canvas2D: Canvas2D;

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

  private consoleIsTogglePressed = false;
  private consoleIsOpen = false;
  private consoleHoldToToggle = consoleDefaultOptions.holdToToggle;
  private consoleIsEnabled = consoleDefaultOptions.enabled;
  private consoleToggleButton = consoleDefaultOptions.toggleButton;
  private consoleCustomMethods = consoleDefaultOptions.customMethods;
  private consoleColor = consoleDefaultOptions.color;

  private loop = () => 0;
  private gameLoop = () => { };

  protected renderMode: RenderMode;
  protected canvas: Canvas;
  protected consoleCanvas: Canvas2D | null = null;

  protected aspectRatio = 0;
  protected screenWidth = 0;
  protected screenHeight = 0;
  protected screenXCenter = 0;
  protected screenYCenter = 0;

  protected delta = 0;
  protected elapsedTime = 0;

  protected mouseX = -1;
  protected mouseY = -1;

  constructor(opts?: Constructor) {
    this.renderMode = opts?.mode || '2d';
    this.isRunning = false;
    this.consoleSetOptions(opts?.console || {});

    this.canvasGL = new CanvasGL(8);
    this.canvas2D = new Canvas2D(12);
    this.canvas = this.renderMode === '2d' ? this.canvas2D : this.canvasGL;

    this.aspectRatio = this.canvasGL.setSize(window.innerWidth, window.innerHeight);
    this.aspectRatio = this.canvas2D.setSize(window.innerWidth, window.innerHeight);

    if (this.consoleIsEnabled) {
      this.enableConsole();
    }

    this.addMouseTracker();
    this.calculateScreen();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
  }

  private addMouseTracker() {
    document.onmousemove = (event) => {
      this.mouseX = event.pageX;
      this.mouseY = event.pageY;
    }

    document.onmouseleave = () => {
      this.mouseX = -1;
      this.mouseY = -1;
    }
  }

  protected abstract onLoad(): void

  protected abstract onUpdate(): void

  public async run(): Promise<void> {
    if (this.isRunning) {
      return;
    }

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
    this.canvas.fill();
    this.consoleCanvas?.clear();
  }

  public enableConsole() {
    this.consoleCanvas = new Canvas2D(16);
    this.consoleCanvas.setSize(window.innerWidth, window.innerHeight);
    this.consoleIsEnabled = true;
  }

  public consoleDisable() {
    this.consoleCanvas?.removeCanvas();
    this.consoleCanvas = null;
    this.consoleIsEnabled = false;
    this.consoleIsOpen = false;
  }

  protected isKeyPressed(key: KeyboardEvent['key']) {
    return this.keysPressed.includes(key);
  }

  protected addConsoleCustomMethod(method: ConsoleMethod) {
    this.consoleCustomMethods.push(method);
  }

  protected setConsoleToggleButton(key: KeyboardEvent['key']) {
    this.consoleToggleButton = key;
  }

  protected consoleSetOptions(opts: ConsoleOpts) {
    this.consoleIsEnabled = typeof opts.enabled === 'boolean' ? opts.enabled : this.consoleIsEnabled;
    this.consoleHoldToToggle = typeof opts.holdToToggle === 'boolean' ? opts.holdToToggle : this.consoleHoldToToggle;
    this.consoleCustomMethods = opts.customMethods || this.consoleCustomMethods;
    this.consoleToggleButton = opts.toggleButton || this.consoleToggleButton;
    this.consoleColor = opts.color || this.consoleColor;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Unidentified') {
      return;
    }

    if (!this.keysPressed.includes(e.key)) {
      this.keysPressed.push(e.key);
    }
  }

  private onResize = () => {
    this.aspectRatio = this.canvasGL.setSize(window.innerWidth, window.innerHeight);
    this.aspectRatio = this.canvas2D.setSize(window.innerWidth, window.innerHeight);

    if (this.consoleCanvas) {
      this.consoleCanvas.setSize(window.innerWidth, window.innerHeight);
    }

    this.calculateScreen();
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysPressed = this.keysPressed.filter(k => k !== e.key);
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

    if (this.isKeyPressed(this.consoleToggleButton) && !this.consoleIsTogglePressed) {
      this.consoleIsTogglePressed = true;
      this.consoleIsOpen = !this.consoleIsOpen;
    } else if (!this.isKeyPressed(this.consoleToggleButton)) {
      this.consoleIsTogglePressed = false;
    }
  }

  private engineOnUpdate() {
    this.calculateTime();
    this.handleEngineKeys();

    if (this.consoleCanvas) {
      this.consoleCanvas.clear();
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
    this.consoleDrawCrossHair()

    for (const method of this.consoleCustomMethods) {
      method();
    }
  }

  private calculateScreen() {
    const { width, height } = this.canvas.getSize();
    this.screenWidth = width;
    this.screenHeight = height;
    this.screenXCenter = width / 2;
    this.screenYCenter = height / 2;
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

    let timeArrLength = this.fpsArr.length;

    let fpsTot = 0;
    let deltaTot = 0;

    while (timeArrLength--) {
      fpsTot += this.fpsArr[timeArrLength];
      deltaTot += this.deltaArr[timeArrLength];
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
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleCanvas) {
      return
    }

    let text = 'width: ';
    text += this.screenWidth;
    text += ' height: ';
    text += this.screenHeight;
    text += ' aspect ratio: ';
    text += Math.round(this.aspectRatio * 100) / 100;

    this.consoleCanvas.drawText(text, 20, this.screenHeight - 20, { align: 'left', color: this.consoleColor });
  }

  private consoleDisplayClockInfo() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleCanvas) {
      return
    }

    let text = 'fps: ';
    text += this.fpsAvg;
    text += ' delta: ';
    text += this.deltaAvg;
    text += ' run time: ';
    text += this.msToHMS(this.elapsedTime);

    this.consoleCanvas.drawText(
      text,
      this.screenXCenter, 20,
      { align: 'center', color: this.consoleColor }
    );
  }

  private consoleDisplayKeysPressed() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.keysPressed.length || !this.consoleCanvas) {
      return;
    }

    let text = 'pressed keys: ';
    text += this.keysPressed.join(', ');
    this.consoleCanvas.drawText(
      text,
      this.screenWidth - 20,
      this.screenHeight - 40,
      { align: 'right', color: this.consoleColor }
    );
  }
  private consoleDisplayMousePos() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleCanvas) {
      return;
    }

    let text = 'mouse X:';
    text += this.mouseX;
    text += ' Y: ';
    text += this.mouseY;
    this.consoleCanvas.drawText(
      text,
      this.screenWidth - 20,
      this.screenHeight - 20,
      { align: 'right', color: this.consoleColor }
    );
  }

  private consoleDrawCrossHair() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.consoleCanvas) {
      return;
    }

    this.consoleCanvas.draw(
      this.screenXCenter - 10,
      this.screenYCenter,
      this.screenXCenter + 10,
      this.screenYCenter,
      { color: { stroke: this.consoleColor } }
    );

    this.consoleCanvas.draw(
      this.screenXCenter,
      this.screenYCenter - 10,
      this.screenXCenter,
      this.screenYCenter + 10,
      { color: { stroke: this.consoleColor } }
    );
  }

}