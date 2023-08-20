  //Each point has a position and color
attribute vec3 position;
attribute vec3 color;

  // The transformation matrices
uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

  // Pass the color attribute down to the fragment shader
varying vec4 vColor;

void main() {

    // Pass the color down to the fragment shader
  vColor = vec4(color, 1);

    // Read the multiplication in reverse order, the point is taken from
    // the original model space and moved into world space. It is then
    // projected into clip space as a homogeneous point. Generally the
    // W value will be something other than 1 at the end of it.
  gl_Position = projection * view * model * vec4(position, 1.0);
}