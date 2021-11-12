(async () => {
  const canvas = document.createElement('canvas');
  canvas.id = "canvas";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.zIndex = '8';
  canvas.style.position = "absolute";

  const body = document.getElementsByTagName("body")[0];

  body.appendChild(canvas);

  let isFull: boolean = false;
  const ctx = canvas.getContext("2d");

  let xPos = 0;
  let yPos = 0;
  let speed = 1;

  const clear = () => {
    if (!!ctx) {
      ctx.fillStyle = "rgba(255, 255, 255, 1)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  const keyState: { [key: string]: boolean } = {};

  window.addEventListener('keydown', async (e: KeyboardEvent) => {
    e.preventDefault();
    keyState[e.key] = true;

    if (e.key === 'Escape') {
      //@ts-expect-error
      await electron.toggleFullScreen();
      //@ts-expect-error
      isFull = await electron.isFullScreen();
    }

    if (e.key === '+' && speed < 10) {
      speed++;
    }
    if (e.key === '-' && speed > 1) {
      speed--;
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    keyState[e.key] = false;
  });

  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  const move = () => {
    if (!!keyState['ArrowLeft']) {
      xPos = xPos - speed;
    }
    if (!!keyState['ArrowRight']) {
      xPos = xPos + speed;
    }
    if (!!keyState['ArrowUp']) {
      yPos = yPos - speed;
    }
    if (!!keyState['ArrowDown']) {
      yPos = yPos + speed;
    }
  }

  const draw = () => {
    if (!!ctx) {
      clear();

      ctx.fillStyle = "rgba(255, 0, 0, 1)";
      ctx.fillText(`full screen: ${isFull}`, canvas.width - 100, 20);
      ctx.fillText(`speed: ${speed}`, canvas.width - 100, 30);
      ctx.fillText(`y: ${yPos}`, canvas.width - 100, 40);
      ctx.fillText(`x: ${xPos}`, canvas.width - 100, 50);

      ctx.fillStyle = "rgba(255, 0, 0, 1)";
      ctx.fillRect(xPos, yPos, 50, 50);
    }
  }

  const loop = () => {
    window.requestAnimationFrame(gameLoop);
  }

  const gameLoop = () => {
    move();
    draw();
    loop();
  }

  loop();
})();