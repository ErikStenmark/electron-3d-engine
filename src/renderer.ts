import { BrowserWindow } from 'electron';

const canvas = document.createElement('canvas');
canvas.id = "canvas";
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.zIndex = '8';
canvas.style.position = "absolute";

const body = document.getElementsByTagName("body")[0];
let mainWin: BrowserWindow | null = null;

body.appendChild(canvas);

const draw = () => {
  const ctx = canvas.getContext("2d");
  if (!!ctx) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
    ctx.fillRect(100, 100, 200, 200);
    ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
    ctx.fillRect(150, 150, 200, 200);
    ctx.fillStyle = "rgba(0, 0, 255, 0.2)";
    ctx.fillRect(200, 50, 200, 200);
  }
}

window.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    //@ts-expect-error
    electron.toggleFullScreen();
  }
})

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
});

draw();

console.log('mainWin', mainWin);