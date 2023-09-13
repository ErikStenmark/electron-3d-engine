attribute vec4 position;
attribute vec3 color;
varying vec3 v_color;

  // The transformation matrices
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

#define PI 3.1415926538

mat4 quickInverse(mat4 m) {
  mat4 matrix = mat4(0.0);

  /**
  [ 0  1  2  3]
  [ 4  5  6  7]
  [ 8  9 10 11]
  [12 13 14 15]
*/

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
  v_color = color;

  mat4 viewInverse = quickInverse(view);
  gl_Position = projection * viewInverse * model * vec4(position.x, position.y, position.z, 1.0);

}