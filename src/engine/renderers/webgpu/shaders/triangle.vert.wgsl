struct Uniforms {
  view: mat4x4<f32>,
  projection: mat4x4<f32>,
  lightDirection: vec4<f32>,
  lightColor: vec4<f32>,
  ambientLight: vec4<f32>,
}

struct ObjectUniforms {
  model: mat4x4<f32>,
  color: vec4<f32>,
  tint: vec4<f32>,
  // x = hasTexture, y = transparency
  flags: vec4<f32>,
}

struct Output {
    @builtin(position) position: vec4<f32>,
    @location(0) lighting: vec3<f32>,
    @location(1) color: vec4<f32>,
    @location(2) tint: vec4<f32>,
    @location(3) texCoord: vec2<f32>,
    @location(4) hasTexture: f32,
};

@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var<uniform> object : ObjectUniforms;

@vertex
fn main(
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) texCoords: vec2<f32>,
) -> Output {
    let transformedNormal = normalize(mat3x3<f32>(
        object.model[0].xyz,
        object.model[1].xyz,
        object.model[2].xyz,
    ) * normal);

    let directional = max(dot(transformedNormal, uniforms.lightDirection.xyz), 0.0);

    var output: Output;
    output.position = uniforms.projection * uniforms.view * object.model * vec4<f32>(position, 1.0);
    output.lighting = uniforms.ambientLight.xyz * uniforms.ambientLight.w + uniforms.lightColor.xyz * directional * uniforms.lightColor.w;
    output.color = object.color;
    output.tint = object.tint;
    output.texCoord = texCoords;
    output.hasTexture = object.flags.x;

    return output;
}
