precision mediump float;
varying highp vec3 vLighting;
uniform sampler2D sampler;

varying vec4 vColor;
varying vec4 vTint;
varying vec2 vTexCoord;
varying float vHasTexture;
varying float vTransparency;

void main() {

  if(vHasTexture >= 1.0) {

    // Y is inverted, why?
    vec2 texCoord = vec2(vTexCoord.x, 1.0 - vTexCoord.y); // Invert texture vertically

    vec4 texColor = texture2D(sampler, texCoord);
    vec3 tintedColor = mix(texColor.rgb, vTint.rgb, vTint.a);
    gl_FragColor = vec4(tintedColor.rgb * vLighting, texColor.a);
  } else {
    vec3 tintedColor = mix(vColor.rgb, vTint.rgb, vTint.a);
    gl_FragColor = vec4(tintedColor.rgb * vLighting, vColor.a);
  }
}
