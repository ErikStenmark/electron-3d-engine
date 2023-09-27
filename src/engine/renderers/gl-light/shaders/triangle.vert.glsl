attribute vec3 position;
attribute vec3 normal;
attribute vec2 textureCoords;
attribute vec4 color;
attribute vec4 tint;

uniform vec4 lightDirection;
uniform vec4 lightColor;
uniform vec4 ambientLight;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;
uniform float hasTexture;

varying vec4 vColor;
varying vec4 vTint;
varying highp vec3 vLighting;
varying vec2 vTexCoord;
varying float vHasTexture;

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

  highp float directional = max(dot(normal.xyz, lightDirection.xyz), 0.0);

  vColor = color;
  vTint = tint;
  vHasTexture = hasTexture;
  vLighting = ambientLight.xyz * ambientLight.w + (lightColor.xyz * directional * lightColor.w);
  vTexCoord = textureCoords;

  gl_Position = projection * viewInverse * model * vec4(position.x, position.y, position.z, 1.0);
}