// /src/graphics/GodRaysPostProcessor.ts

import * as THREE from 'three';
import {
  BloomEffect,
  BlendFunction,
  ChromaticAberrationEffect,
  Effect,
  EffectAttribute,
  EffectComposer,
  EffectPass,
  NoiseEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';

const SHAFTS_FRAGMENT = /* glsl */ `
uniform vec2 sunScreen;
uniform float intensity;
uniform float time;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 delta = uv - sunScreen;
  float dist = length(delta);
  float accum = 0.0;
  vec2 stepv = delta * (0.34 / 22.0);
  vec2 coord = uv;
  for (int i = 0; i < 22; i++) {
    coord -= stepv;
    float inside = step(0.0, coord.x) * step(coord.x, 1.0) * step(0.0, coord.y) * step(coord.y, 1.0);
    vec3 c = texture2D(inputBuffer, clamp(coord, vec2(0.0), vec2(1.0))).rgb;
    float lum = smoothstep(0.8, 1.7, max(max(c.r, c.g), c.b));
    accum += lum * inside;
  }
  accum /= 22.0;

  float angle = atan(delta.y, delta.x + 1e-5);
  float streak = 0.6 + 0.4 * sin(angle * 37.0 + time * 0.22) * sin(angle * 13.0 - time * 0.15);
  float falloff = smoothstep(0.92, 0.02, dist) * smoothstep(0.0, 0.08, dist);
  vec3 col = vec3(1.0, 0.79, 0.5) * accum * streak * falloff * max(intensity, 0.0) * 0.42;
  outputColor = vec4(col, 1.0);
}
`;

class SunShaftsEffect extends Effect {
  readonly sunScreenUniform: THREE.Uniform;
  readonly intensityUniform: THREE.Uniform;
  readonly timeUniform: THREE.Uniform;

  constructor() {
    const sunScreen = new THREE.Uniform(new THREE.Vector2(0.5, 0.5));
    const intensity = new THREE.Uniform(0);
    const time = new THREE.Uniform(0);
    super('SunShaftsEffect', SHAFTS_FRAGMENT, {
      blendFunction: BlendFunction.ADD,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ['sunScreen', sunScreen],
        ['intensity', intensity],
        ['time', time],
      ]),
    });
    this.sunScreenUniform = sunScreen;
    this.intensityUniform = intensity;
    this.timeUniform = time;
  }
}

export class GodRaysPostProcessor {
  readonly composer: EffectComposer;
  readonly bloom: BloomEffect;
  readonly sunShafts: SunShaftsEffect;
  readonly toneMapping: ToneMappingEffect;

  private baseShafts = 0;
  private elapsed = 0;
  private readonly sunProjected = new THREE.Vector3();
  private readonly camForward = new THREE.Vector3();
  private readonly toSun = new THREE.Vector3();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly sunMesh: THREE.Mesh,
  ) {
    this.composer = new EffectComposer(renderer, {
      frameBufferType: THREE.HalfFloatType,
      multisampling: 2,
      stencilBuffer: false,
    });

    this.composer.addPass(new RenderPass(scene, camera));

    this.sunShafts = new SunShaftsEffect();
    this.composer.addPass(new EffectPass(camera, this.sunShafts));

    this.bloom = new BloomEffect({
      blendFunction: BlendFunction.SCREEN,
      luminanceThreshold: 0.9,
      luminanceSmoothing: 0.25,
      intensity: 0.7,
      radius: 0.78,
      levels: 8,
      mipmapBlur: true,
    });
    this.composer.addPass(new EffectPass(camera, this.bloom));

    this.toneMapping = new ToneMappingEffect({
      mode: ToneMappingMode.ACES_FILMIC,
    });

    const chromatic = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(0.00035, 0.00045),
      radialModulation: true,
      modulationOffset: 0.35,
    });

    const vignette = new VignetteEffect({
      blendFunction: BlendFunction.NORMAL,
      offset: 0.18,
      darkness: 0.62,
    });

    const noise = new NoiseEffect({
      blendFunction: BlendFunction.OVERLAY,
      premultiply: true,
    });
    noise.blendMode.opacity.value = 0.055;

    this.composer.addPass(new EffectPass(camera, chromatic, vignette, this.toneMapping, noise));
  }

  setGodRays(strength: number): void {
    this.baseShafts = THREE.MathUtils.clamp(strength, 0, 1);
  }

  setBloom(intensity: number): void {
    this.bloom.intensity = intensity;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(delta: number): void {
    this.elapsed += delta;
    this.camera.getWorldDirection(this.camForward);
    this.toSun.copy(this.sunMesh.position).sub(this.camera.position).normalize();
    const facing = this.camForward.dot(this.toSun);
    this.sunProjected.copy(this.sunMesh.position).project(this.camera);
    const sx = this.sunProjected.x * 0.5 + 0.5;
    const sy = this.sunProjected.y * 0.5 + 0.5;
    this.sunShafts.sunScreenUniform.value.set(sx, sy);
    this.sunShafts.timeUniform.value = this.elapsed;

    const onScreen =
      THREE.MathUtils.smoothstep(sx, -0.35, 0.05) *
      (1 - THREE.MathUtils.smoothstep(sx, 0.95, 1.35)) *
      THREE.MathUtils.smoothstep(sy, -0.35, 0.05) *
      (1 - THREE.MathUtils.smoothstep(sy, 0.95, 1.35));
    const visibility = THREE.MathUtils.smoothstep(facing, 0.15, 0.85);
    this.sunShafts.intensityUniform.value = this.baseShafts * visibility * onScreen;
    this.composer.render(delta);
  }

  dispose(): void {
    this.composer.dispose();
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }
}
