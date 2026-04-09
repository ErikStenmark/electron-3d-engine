attribute vec3 position;

uniform mat4 invProjection;
uniform mat4 invView;

varying vec3 vWorldDir;

void main() {
  // Fullscreen quad at far plane
  gl_Position = vec4(position.xy, 1.0, 1.0);

  // Reconstruct world-space view direction from clip coords
  vec4 clipDir = invProjection * vec4(position.xy, 1.0, 1.0);
  clipDir = vec4(clipDir.xyz / clipDir.w, 0.0);
  vWorldDir = (invView * clipDir).xyz;
}
