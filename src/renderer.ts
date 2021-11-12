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
      xPos--;
    }
    if (!!keyState['ArrowRight']) {
      xPos++;
    }
    if (!!keyState['ArrowUp']) {
      yPos--;
    }
    if (!!keyState['ArrowDown']) {
      yPos++;
    }
  }

  const draw = () => {
    if (!!ctx) {
      clear();

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