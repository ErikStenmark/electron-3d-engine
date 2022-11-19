struct Uniforms {
  screen: vec2<f32>,
}

struct Output {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@binding(0) @group(0) var<uniform> uniforms : Uniforms;

fn trans(val: f32, high: f32, low: f32, ohigh: f32, olow: f32) -> f32 {
    var res: f32 = ((val - low) / (high - low)) * (ohigh - olow) + olow;
    return res;
}

fn translatepos(position: vec4<f32>) -> vec4<f32> {
    var x: f32 = trans(position.x, uniforms.screen.x, 0.0, 1.0, -1.0);
    var y: f32 = trans(position.y, uniforms.screen.y, 0.0, 1.0, -1.0) * -1.0;
    var res: vec4<f32> = vec4<f32>(x, y, 0.0, 1.0);
    return res;
}

@vertex
fn main(
    @location(0) position: vec4<f32>,
    @location(1) color: vec3<f32>
) -> Output {
    var output: Output;
    output.position = translatepos(position);
    output.color = color;
    return output;
}