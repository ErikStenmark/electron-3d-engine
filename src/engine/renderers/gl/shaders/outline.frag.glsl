precision mediump float;

uniform sampler2D silhouette;
uniform vec2 texelSize;   // 1.0 / vec2(width, height)
uniform vec4 glowColor;
uniform float radius;     // glow radius in pixels

varying vec2 vUv;

void main() {
  float selfAlpha = texture2D(silhouette, vUv).a;

  // Inside the silhouette — don't draw glow here
  if (selfAlpha > 0.5) {
    discard;
  }

  // Sample neighbours; track maximum weighted coverage
  // Only count silhouette pixels (alpha > 0.5)
  float maxGlow = 0.0;
  for (int x = -8; x <= 8; x++) {
    for (int y = -8; y <= 8; y++) {
      float d = length(vec2(float(x), float(y)));
      if (d > radius) continue;
      vec2 offset = vec2(float(x), float(y)) * texelSize;
      float a = texture2D(silhouette, vUv + offset).a;
      if (a > 0.5) {
        float glow = 1.0 - d / radius;
        maxGlow = max(maxGlow, glow);
      }
    }
  }

  if (maxGlow <= 0.0) discard;

  gl_FragColor = vec4(glowColor.rgb, maxGlow * glowColor.a);
}
