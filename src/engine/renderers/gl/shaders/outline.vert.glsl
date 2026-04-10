attribute vec3 position;

varying vec2 vUv;

void main() {
  // Fullscreen triangle — map clip coords to [0,1] UV
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
