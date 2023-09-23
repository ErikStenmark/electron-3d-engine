precision mediump float;
varying vec4 vColor;
varying highp vec3 vLighting;

void main() {
  gl_FragColor = vec4(vColor.rgb * vLighting, 1.0);
}