@binding(2) @group(0) var texSampler: sampler;
@binding(3) @group(0) var texImage: texture_2d<f32>;

@fragment
fn main(
    @location(0) lighting: vec3<f32>,
    @location(1) color: vec4<f32>,
    @location(2) tint: vec4<f32>,
    @location(3) texCoord: vec2<f32>,
    @location(4) hasTexture: f32,
) -> @location(0) vec4<f32> {
    let flippedCoord = vec2<f32>(texCoord.x, 1.0 - texCoord.y);
    let texColor = textureSample(texImage, texSampler, flippedCoord);

    let texTinted = mix(texColor.rgb, tint.rgb, tint.a);
    let flatTinted = mix(color.rgb, tint.rgb, tint.a);

    let useTex = hasTexture >= 1.0;
    let finalColor = select(flatTinted, texTinted, useTex);
    let finalAlpha = select(color.a, texColor.a, useTex);

    return vec4<f32>(finalColor * lighting, finalAlpha);
}
