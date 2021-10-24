"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var canvas = document.createElement('canvas');
canvas.id = "canvas";
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
canvas.style.zIndex = '8';
canvas.style.position = "absolute";
var body = document.getElementsByTagName("body")[0];
var mainWin = null;
// window.electron.receive('fromMain', data => {
//   console.log(data);
//   mainWin = data;
// });
// //@ts-expect-error
// window.electron.send('getMain');
body.appendChild(canvas);
var draw = function () {
    var ctx = canvas.getContext("2d");
    if (!!ctx) {
        ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
        ctx.fillRect(100, 100, 200, 200);
        ctx.fillStyle = "rgba(0, 255, 0, 0.2)";
        ctx.fillRect(150, 150, 200, 200);
        ctx.fillStyle = "rgba(0, 0, 255, 0.2)";
        ctx.fillRect(200, 50, 200, 200);
    }
};
window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        //@ts-expect-error
        electron.toggleFullScreen();
    }
});
window.addEventListener('resize', function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
});
draw();
console.log('mainWin', mainWin);
