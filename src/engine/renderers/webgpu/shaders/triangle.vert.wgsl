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

fn quickInverse(input: mat4x4<f32>) -> mat4x4<f32> {
    var matrix: mat4x4<f32> = mat4x4<f32>(
        vec4<f32>(input[0][0], input[1][0], input[2][0], 0.0),
        vec4<f32>(input[0][1], input[1][1], input[2][1], 0.0),
        vec4<f32>(input[0][2], input[1][2], input[2][2], 0.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );

    matrix[3][0] = -(input[3][0] * matrix[0][0] + input[3][1] * matrix[1][0] + input[3][2] * matrix[2][0]);
    matrix[3][1] = -(input[3][0] * matrix[0][1] + input[3][1] * matrix[1][1] + input[3][2] * matrix[2][1]);
    matrix[3][2] = -(input[3][0] * matrix[0][2] + input[3][1] * matrix[1][2] + input[3][2] * matrix[2][2]);

    return matrix;
}

@vertex
fn main(
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) texCoords: vec2<f32>,
) -> Output {
    let viewInverse = quickInverse(uniforms.view);
    let transformedNormal = normalize(mat3x3<f32>(
        object.model[0].xyz,
        object.model[1].xyz,
        object.model[2].xyz,
    ) * normal);

    let directional = max(dot(transformedNormal, uniforms.lightDirection.xyz), 0.0);

    var output: Output;
    output.position = uniforms.projection * viewInverse * object.model * vec4<f32>(position, 1.0);
    output.lighting = uniforms.ambientLight.xyz * uniforms.ambientLight.w + uniforms.lightColor.xyz * directional * uniforms.lightColor.w;
    output.color = object.color;
    output.tint = object.tint;
    output.texCoord = texCoords;
    output.hasTexture = object.flags.x;

    return output;
}
