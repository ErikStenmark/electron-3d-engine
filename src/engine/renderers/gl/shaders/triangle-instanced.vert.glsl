attribute vec3 position;
attribute vec3 normal;
attribute vec2 textureCoords;

// Per-instance model matrix (mat4 split into 4 vec4 attribute slots)
attribute vec4 iModel0;
attribute vec4 iModel1;
attribute vec4 iModel2;
attribute vec4 iModel3;

uniform vec4 color;
uniform vec4 tint;
uniform float transparency;

uniform vec4 lightDirection;
uniform vec4 lightColor;
uniform vec4 ambientLight;

uniform mat4 view;
uniform mat4 projection;
uniform float hasTexture;

varying vec4 vColor;
varying vec4 vTint;
varying highp vec3 vLighting;
varying vec2 vTexCoord;
varying float vHasTexture;
varying float vTransparency;

void main() {
  mat4 model = mat4(iModel0, iModel1, iModel2, iModel3);

  vec3 transformedNormal = normalize(mat3(model) * normal.xyz);
  highp float directional = max(dot(transformedNormal, lightDirection.xyz), 0.0);

  vColor = color;
  vTint = tint;
  vHasTexture = hasTexture;
  vTexCoord = textureCoords;
  vTransparency = transparency;

  vLighting = ambientLight.xyz * ambientLight.w + (lightColor.xyz * directional * lightColor.w);
  gl_Position = projection * view * model * vec4(position.x, position.y, position.z, 1.0);
}
