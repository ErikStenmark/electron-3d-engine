attribute vec4 position;
attribute vec3 color;
uniform vec2 dimensions;
varying vec3 v_color;

#define PI 3.1415926538

float trans(float val, float high, float low, float ohigh, float olow) {
  float res = ((val - low) / (high - low)) * (ohigh - olow) + olow;
  return res;
}

vec4 translatepos(vec4 position) {
  float x = trans(position.x, dimensions.x, 0.0, 1.0, -1.0);
  float y = trans(position.y, dimensions.y, 0.0, 1.0, -1.0) * -1.0;
  float z = position.z * -1.0;
  vec4 res = vec4(x, y, z, 1.0);
  return res;
}

vec4 matMulVec(mat4 m, vec4 v) {
  return vec4(
    v.x * m[0][0] + v.y * m[0][1] + v.z * m[0][2] + v.w * m[0][3],
    v.x * m[1][0] + v.y * m[1][1] + v.z * m[1][2] + v.w * m[1][3],
    v.x * m[2][0] + v.y * m[2][1] + v.z * m[2][2] + v.w * m[2][3],
    v.x * m[3][0] + v.y * m[3][1] + v.z * m[3][2] + v.w * m[3][3]
  );
}

vec4 project(vec4 v) {
  float fov = 90.0;
  float far = 1000.0;
  float near = 0.1;
  float middle = far - near;
  float fovRad = 1.0 / tan(fov * 0.5 / 180.0 * PI);
  float aspectRatio = dimensions.y / dimensions.x;
  mat4 projection = mat4(0.0);

  projection[0][0] = aspectRatio * fovRad;
  projection[1][1] = fovRad;
  projection[2][2] = far / middle;
  projection[3][2] = -1.0;
  projection[2][3] = (-far * near) / middle;

  vec4 res = matMulVec(projection, v);
  return res;
}

void main() {
  // Project from 3D --> 2D
  vec4 projected = project(position);

  // normalize into cartesian space
  vec4 normCartesian = vec4(projected / projected.w);

  // Offset verts into visible normalized space
  vec4 viewOffset = vec4(1.0, 1.0, 0.0, 1.0);
  vec4 offset = normCartesian + viewOffset;

  // center
  offset.x = offset.x * dimensions.x / 2.0;
  offset.y = offset.y * dimensions.y / 2.0;

  v_color = color;
  gl_Position = translatepos(offset);
}