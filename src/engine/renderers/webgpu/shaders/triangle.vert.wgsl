struct Uniforms {
  model: mat4x4<f32>,
  view: mat4x4<f32>,
  projection: mat4x4<f32>
}

struct Output {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@binding(0) @group(0) var<uniform> uniforms : Uniforms;

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
    @location(0) position: vec4<f32>,
    @location(1) color: vec3<f32>
) -> Output {
    let viewInverse = quickInverse(uniforms.view);

    var output: Output;
    output.position = uniforms.projection * viewInverse * uniforms.model * position;
    output.color = color;

    return output;
}