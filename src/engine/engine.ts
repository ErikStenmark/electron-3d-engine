import { Electron } from './preload';
import Canvas from './canvas';

declare global { interface Window { electron: Electron; } }

type ConsoleMethod = (...args: any) => void;

type ConsoleOpts = Partial<{
  enabled: boolean;
  toggleButton: KeyboardEvent['key'];
  customMethods: ConsoleMethod[];
  holdToToggle: boolean;
}>;

type Constructor = Partial<{
  console: ConsoleOpts;
}>;

const consoleDefaultOptions: Required<ConsoleOpts> = {
  customMethods: [],
  enabled: false,
  holdToToggle: false,
  toggleButton: '§'
}

export abstract class Engine {
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

  private loop = () => 0;
  private gameLoop = () => { };

  protected canvas: Canvas;
  protected consoleCanvas: Canvas | null = null;

  protected aspectRatio = 0;
  protected screenWidth = 0;
  protected screenHeight = 0;
  protected screenXCenter = 0;
  protected screenYCenter = 0;

  protected delta = 0;
  protected elapsedTime = 0;

  constructor(opts?: Constructor) {
    this.isRunning = false;
    this.consoleSetOptions(opts?.console || {});

    this.canvas = new Canvas(8);
    this.aspectRatio = this.canvas.setSize(window.innerWidth, window.innerHeight);

    if (this.consoleIsEnabled) {
      this.enableConsole();
    }

    this.calculateScreen();

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
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
    this.canvas.clear();
    this.consoleCanvas?.clear();
  }

  public enableConsole() {
    this.consoleCanvas = new Canvas(16);
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
    this.consoleIsEnabled = typeof opts?.enabled === 'boolean' ? opts.enabled : this.consoleIsEnabled;
    this.consoleHoldToToggle = typeof opts?.holdToToggle === 'boolean' ? opts.holdToToggle : this.consoleHoldToToggle;
    this.consoleCustomMethods = opts?.customMethods || this.consoleCustomMethods;
    this.consoleToggleButton = opts?.toggleButton || this.consoleToggleButton;
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
    this.aspectRatio = this.canvas.setSize(window.innerWidth, window.innerHeight);

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
    this.consoleDisplayScreenDimensions();

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

    this.consoleCanvas.drawText(text, 20, this.screenHeight - 20, { align: 'left', color: 'lime' });
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

    this.consoleCanvas.drawText(text, this.screenXCenter, 20, { align: 'center', color: 'lime' });
  }

  private consoleDisplayKeysPressed() {
    if (!this.consoleIsEnabled || !this.consoleIsOpen || !this.keysPressed.length || !this.consoleCanvas) {
      return;
    }

    let text = 'pressed keys: ';
    text += this.keysPressed.join(', ');
    this.consoleCanvas.drawText(text, this.screenWidth - 20, this.screenHeight - 20, { align: 'right', color: 'lime' });
  }

}