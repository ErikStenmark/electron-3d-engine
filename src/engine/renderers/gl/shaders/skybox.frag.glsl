precision mediump float;

varying vec3 vWorldDir;

uniform float useTexture;
uniform sampler2D skyTexture;

const float PI = 3.14159265359;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Draw a layer of stars on a UV grid at given scale/density/size
float starLayer(vec2 uv, float scale, float density, float size) {
  vec2 scaled = uv * scale;
  vec2 grid = floor(scaled);
  vec2 f = fract(scaled) - 0.5;

  float brightness = 0.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 cell = grid + vec2(float(x), float(y));
      float h = hash(cell);
      if (h < density) {
        vec2 offset = vec2(hash(cell + 13.7) - 0.5, hash(cell + 7.3) - 0.5) * 0.7;
        vec2 delta = f - vec2(float(x), float(y)) - offset;
        float d = length(delta);
        float b = hash(cell + 0.1);
        brightness += smoothstep(size, 0.0, d) * b;
      }
    }
  }
  return min(brightness, 1.0);
}

void main() {
  vec3 dir = normalize(vWorldDir);

  if (useTexture >= 1.0) {
    float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
    float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    gl_FragColor = texture2D(skyTexture, vec2(u, v));
  } else {
    float u = atan(dir.z, dir.x) / (2.0 * PI) + 0.5;
    float v = asin(clamp(dir.y, -1.0, 1.0)) / PI + 0.5;
    vec2 uv = vec2(u, v);

    // Three layers: dense small, medium, rare large
    float s1 = starLayer(uv, 120.0, 0.25, 0.012);
    float s2 = starLayer(uv,  60.0, 0.15, 0.020);
    float s3 = starLayer(uv,  25.0, 0.08, 0.035);

    float stars = min(s1 + s2 + s3, 1.0);

    // Vary star color between warm white and cool blue-white
    float colorBias = hash(floor(uv * 60.0));
    vec3 starColor = mix(vec3(1.0, 1.0, 1.0), vec3(0.6, 0.8, 1.0), colorBias);

    gl_FragColor = vec4(starColor * stars, 1.0);
  }
}
