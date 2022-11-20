struct Uniforms {
  screen: vec2<f32>,
}

struct Output {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
};

@binding(0) @group(0) var<uniform> uniforms : Uniforms;

fn trans(val: f32, high: f32, low: f32, ohigh: f32, olow: f32) -> f32 {
    return ((val - low) / (high - low)) * (ohigh - olow) + olow;
}

fn translatepos(position: vec4<f32>) -> vec4<f32> {
    let x: f32 = trans(position.x, uniforms.screen.x, 0.0, 1.0, -1.0);
    let y: f32 = trans(position.y, uniforms.screen.y, 0.0, 1.0, -1.0) * -1.0;
    let z: f32 = position.z * -1.0;

    return vec4<f32>(x, y, z, 1.0);
}

fn project(v: vec4<f32>) -> vec4<f32> {
    let pi = 3.1415926538;
    let fov = 90.0;
    let far = 1000.0;
    let near = 0.1;
    let fulkrum = far - near;
    let fovRad = 1.0 / tan(fov * 0.5 / 180.0 * pi);
    let aspectRatio = uniforms.screen.y / uniforms.screen.x;

    let r0 = vec4<f32>(aspectRatio * fovRad, 0.0, 0.0, 0.0);
    let r1 = vec4<f32>(0.0, fovRad, 0.0, 0.0);
    let r2 = vec4<f32>(0.0, 0.0, far / fulkrum, -1.0);
    let r3 = vec4<f32>(0.0, 0.0, (-far * near) / fulkrum, 0.0);
    let projection = mat4x4<f32>(r0, r1, r2, r3);

    return projection * v;
}

@vertex
fn main(
    @location(0) position: vec4<f32>,
    @location(1) color: vec3<f32>
) -> Output {
    // Project from 3D --> 2D
    let projected = project(position);

    // normalize into cartesian space
    let cartesian = vec4<f32>(projected / projected.w);

    // Offset verts into visible normalized space
    let viewOffset = vec4<f32>(1.0, 1.0, 0.0, 1.0);
    var offset = cartesian + viewOffset;

    // center
    offset.x = offset.x * uniforms.screen.x / 2.0;
    offset.y = offset.y * uniforms.screen.y / 2.0;

    var output: Output;
    output.position = translatepos(offset);
    output.color = color;

    return output;
}