  //Each point has a position and color
attribute vec3 position;
attribute vec3 color;
attribute vec3 normal;

  // The transformation matrices
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

  // Pass the color attribute down to the fragment shader
varying vec4 vColor;
varying highp vec3 vLighting;

mat4 quickInverse(mat4 m) {
  mat4 matrix = mat4(0.0);

  matrix[0][0] = m[0][0];
  matrix[0][1] = m[1][0];
  matrix[0][2] = m[2][0];
  matrix[0][3] = 0.0;
  matrix[1][0] = m[0][1];
  matrix[1][1] = m[1][1];
  matrix[1][2] = m[2][1];
  matrix[1][3] = 0.0;
  matrix[2][0] = m[0][2];
  matrix[2][1] = m[1][2];
  matrix[2][2] = m[2][2];
  matrix[2][3] = 0.0;
  matrix[3][0] = -(m[3][0] * matrix[0][0] + m[3][1] * matrix[1][0] + m[3][2] * matrix[2][0]);
  matrix[3][1] = -(m[3][0] * matrix[0][1] + m[3][1] * matrix[1][1] + m[3][2] * matrix[2][1]);
  matrix[3][2] = -(m[3][0] * matrix[0][2] + m[3][1] * matrix[1][2] + m[3][2] * matrix[2][2]);
  matrix[3][3] = 1.0;

  return matrix;
}

void main() {
  mat4 viewInverse = quickInverse(view);

  highp vec3 ambientLight = vec3(0.0, 0.0, 0.0);
  highp vec3 directionalLightColor = vec3(1.0, 1.0, 1.0);
  highp vec3 directionalVector = normalize(vec3(0.0, 1.0, -1.0));
  highp float directional = max(dot(normal.xyz, directionalVector), 0.0);

  vColor = vec4(color, 1);
  vLighting = ambientLight + (directionalLightColor * directional);
  gl_Position = projection * viewInverse * model * vec4(position.x, position.y, position.z, 1.0);
}