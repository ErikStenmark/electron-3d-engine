precision mediump float;
varying vec4 vColor;
varying highp vec3 vLighting;

void main() {
  gl_FragColor = vec4(vColor.rgb * vLighting, 1.0);
    // gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}