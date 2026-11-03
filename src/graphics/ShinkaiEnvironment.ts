// /src/graphics/ShinkaiEnvironment.ts

import * as THREE from 'three';
import { EnvironmentParams } from '../types/SkyLanternTypes';

export interface EnvironmentTextures {
  waterNormal: THREE.Texture;
  cloudPuff: THREE.Texture;
  paintedWood: THREE.Texture;
  mossStone: THREE.Texture;
}

export const SUN_DIRECTION = new THREE.Vector3(0.08, 0.4, -0.93).normalize();

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
precision highp float;

varying vec3 vDir;

uniform vec3 uSunDir;
uniform vec3 uFlashDir;
uniform vec2 uWind;
uniform float uTime;
uniform float uStorm;
uniform float uCloudCover;
uniform float uFlash;
uniform float uGap;
uniform float uRainbow;
uniform float uSunStrength;
uniform float uSkyBoost;
uniform vec3 uStormZenith;
uniform vec3 uStormHorizon;
uniform vec3 uClearZenith;
uniform vec3 uClearMid;
uniform vec3 uClearHorizon;
uniform vec3 uWarm;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float hash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v / 0.975;
}

float cloudLayer(vec3 dir, float scale, float t, float hole, out float detail, out float base) {
  vec2 uv = dir.xz / (max(dir.y, 0.0) + 0.155) * scale;
  vec2 p = uv + uWind * t * 0.006 + vec2(t * 0.0021, -t * 0.0014);
  float warp = fbm(p * 0.52 + vec2(t * 0.0035, -t * 0.0025));
  base = fbm(p + warp * 1.12);
  detail = fbm(p * 3.05 - vec2(t * 0.0075, 0.0));
  float field = base * 0.78 + detail * 0.29;
  float th = mix(0.575, 0.32, uStorm) - (uCloudCover - 0.5) * 0.15;
  float d = smoothstep(th, th + 0.115, field);
  d *= smoothstep(0.0, 0.075, dir.y);
  d *= 1.0 - hole;
  return d;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = clamp(dir.y, -1.0, 1.0);
  float clearF = pow(max(1.0 - uStorm, 0.0), 1.7);
  float sunDot = max(dot(dir, uSunDir), 0.0);
  float sd = sunDot;

  vec3 stormSky = mix(uStormHorizon, uStormZenith, pow(clamp(h, 0.0, 1.0), 0.52));
  stormSky += vec3(0.035, 0.042, 0.05) * exp(-abs(h) * 16.0);

  float sunAlign = max(dot(normalize(dir.xz + vec2(0.0001)), normalize(uSunDir.xz + vec2(0.0001))), 0.0);
  vec3 clearHigh = mix(uClearHorizon, uClearMid, smoothstep(0.0, 0.26, h));
  vec3 clearSky = mix(clearHigh, uClearZenith, smoothstep(0.14, 0.92, h));
  float lowSun = pow(1.0 - clamp(h, 0.0, 1.0), 6.0);
  clearSky = mix(clearSky, uWarm, lowSun * (0.2 + 0.8 * pow(sunAlign, 2.5)) * 0.85);

  vec3 sky = mix(stormSky, clearSky, clearF);

  float disc = smoothstep(0.99935, 0.99972, sd);
  float halo = pow(sd, 220.0) * 0.85 + pow(sd, 26.0) * 0.22 + pow(sd, 6.5) * 0.058;
  sky += vec3(1.0, 0.86, 0.64) * (disc * 9.0 + halo * 1.5) * uSunStrength * (0.3 + 0.7 * clearF);

  float gapGlow = pow(sd, 13.0) * uGap;
  sky += vec3(1.0, 0.6, 0.26) * gapGlow * 2.0;

  vec3 cell = floor(dir * 420.0);
  float hs = hash31(cell);
  float star = smoothstep(0.9972, 0.9997, hs);
  float twinkle = 0.62 + 0.38 * sin(uTime * 2.3 + hs * 90.0);
  sky += vec3(0.72, 0.84, 1.0) * star * twinkle * 1.25 * mix(0.08, 0.95, uStorm) * smoothstep(0.02, 0.26, h);

  float hole = uGap * smoothstep(0.972, 0.998, sd);
  hole += uSunStrength * clearF * smoothstep(0.986, 0.999, sd) * 0.55;

  float detailA;
  float baseA;
  float detailB;
  float baseB;
  float dHigh = cloudLayer(dir, 0.58, uTime * 0.8, hole * 0.7, detailA, baseA);
  float dMain = cloudLayer(dir, 1.18, uTime + 11.7, hole, detailB, baseB);

  float occlA = smoothstep(0.0, 0.42, dHigh);
  float occlB = smoothstep(0.0, 0.5, dMain);
  vec3 stormEdge = vec3(0.07, 0.1, 0.165);
  vec3 stormCore = vec3(0.006, 0.011, 0.024);
  vec3 stormCloud = mix(stormEdge, stormCore, occlB * 0.85);
  float silverD = (baseB - (mix(0.575, 0.32, uStorm) - (uCloudCover - 0.5) * 0.15) - 0.05) / 0.075;
  float silverRim = exp(-silverD * silverD);
  silverRim *= 0.25 + 0.75 * pow(sd, 3.0);
  stormCloud += vec3(0.5, 0.68, 1.0) * silverRim * (0.16 + uFlash * 1.4) * (0.35 + uStorm * 0.65);
  stormCloud += vec3(0.45, 0.6, 1.0) * uFlash * 0.55;
  stormCloud = mix(stormCloud, stormEdge, (1.0 - occlA) * 0.35);

  vec3 clearShade = vec3(0.40, 0.5, 0.65);
  vec3 clearLit = vec3(1.28, 1.24, 1.16);
  float lightSide = 0.5 + 0.5 * sunAlign;
  float puff = smoothstep(0.32, 0.78, baseB);
  vec3 clearCloud = mix(clearShade, clearLit, puff * 0.72 + lightSide * 0.28);
  float silver = pow(max(dot(dir, uSunDir), 0.0), 9.0);
  clearCloud += vec3(1.0, 0.85, 0.6) * silver * 1.35;
  clearCloud += vec3(0.12, 0.2, 0.3) * (1.0 - puff) * 0.2;

  vec3 cloudCol = mix(stormCloud, clearCloud, clearF);
  float cloudAlphaHigh = dHigh * mix(0.5, 0.34, clearF);
  float cloudAlphaMain = dMain * mix(0.96, 0.82, clearF);

  sky = mix(sky, cloudCol * 0.92, cloudAlphaHigh);
  sky = mix(sky, cloudCol, cloudAlphaMain);

  vec3 rbCenter = normalize(vec3(-0.12, -0.34, -0.93));
  float ang = acos(clamp(dot(dir, rbCenter), -1.0, 1.0));
  float bandDA = (ang - 0.705) / 0.032;
  float bandDB = (ang - 0.89) / 0.046;
  float bandA = exp(-bandDA * bandDA);
  float bandB = exp(-bandDB * bandDB) * 0.32;
  float rt = clamp((ang - 0.635) / 0.22, 0.0, 1.0);
  vec3 hue = 0.5 + 0.5 * cos(6.28318 * (rt * 0.9 + vec3(0.0, 0.33, 0.67)));
  float rbFade = smoothstep(0.02, 0.2, h) * (1.0 - cloudAlphaMain * 0.35);
  sky += hue * (bandA + bandB) * uRainbow * 0.62 * rbFade;

  float fl = uFlash * pow(max(dot(dir, uFlashDir), 0.0), 3.0);
  sky += vec3(0.5, 0.64, 1.0) * fl * 1.7 * uStorm;

  float mist = exp(-abs(h) * 38.0);
  sky = mix(sky, mix(uStormHorizon, uWarm, clearF * 0.34), mist * 0.14);

  sky += (hash21(gl_FragCoord.xy) - 0.5) * 0.0035;
  gl_FragColor = vec4(max(sky, vec3(0.0)) * uSkyBoost, 1.0);
}
`;

const WATER_VERTEX = /* glsl */ `
uniform mat4 uTextureMatrix;
varying vec4 vUvProj;
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vUvProj = uTextureMatrix * world;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const WATER_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uReflection;
uniform sampler2D uNormalMap;
uniform vec3 uSunDir;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uHorizonColor;
uniform vec2 uWind;
uniform float uTime;
uniform float uStorm;
uniform float uSunStrength;
uniform float uWake;
uniform float uWakeRadius;
uniform float uRipple;

varying vec4 vUvProj;
varying vec3 vWorld;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 hash22(vec2 p) {
  return vec2(hash21(p), hash21(p + 17.31));
}

float rippleField(vec2 p, float t) {
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  vec2 center = (hash22(id) - 0.5) * 0.42;
  float h = hash21(id + 4.17);
  float phase = fract(t * 0.42 + h);
  float r = length(f - center);
  float wave = sin((r - phase * 0.48) * 26.0);
  return wave * exp(-r * 5.2) * smoothstep(0.0, 0.14, phase) * (1.0 - phase);
}

void main() {
  vec2 p = vWorld.xz;
  float t = uTime;

  vec2 nu = texture2D(uNormalMap, p * 0.024 + uWind * t * 0.004 + vec2(t * 0.0025, t * 0.0015)).rg * 2.0 - 1.0;
  vec2 nv = texture2D(uNormalMap, p * 0.055 - uWind * t * 0.003 + vec2(-t * 0.002, t * 0.0035)).rg * 2.0 - 1.0;
  vec2 nrm = nu * 0.6 + nv * 0.4;
  nrm *= mix(0.24, 0.6, uStorm);

  float hC = rippleField(p * 0.34, t);
  float hX = rippleField((p + vec2(0.16, 0.0)) * 0.34, t);
  float hZ = rippleField((p + vec2(0.0, 0.16)) * 0.34, t);
  nrm += vec2(hX - hC, hZ - hC) * 3.2 * uRipple;

  float distToCenter = length(p);
  float wakeD = (distToCenter - uWakeRadius) / 3.2;
  float wakeRing = exp(-wakeD * wakeD) * uWake;
  nrm += normalize(p + vec2(0.0001)) * wakeRing * 0.65;

  vec3 N = normalize(vec3(nrm.x, 1.0, nrm.y));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.6);
  float reflFactor = clamp(0.12 + 0.88 * fres, 0.12, 0.985);

  vec4 proj = vUvProj;
  proj.xy += nrm * (0.007 + uStorm * 0.006) * proj.w;
  vec3 refl = texture2DProj(uReflection, proj).rgb;

  vec3 deep = mix(uDeepColor, uShallowColor, 0.28 + 0.18 * sin(p.x * 0.011 + p.y * 0.007));
  vec3 col = mix(deep, refl, reflFactor);

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 520.0) * 5.0;
  float glitter = pow(max(dot(N, H), 0.0), 1400.0) * 26.0;
  col += vec3(1.0, 0.82, 0.55) * (spec + glitter) * uSunStrength;

  col += vec3(0.5, 0.74, 1.0) * wakeRing * 1.6;
  float rimGlow = pow(fres, 5.0);
  col += refl * rimGlow * 0.16;

  float d = length(cameraPosition - vWorld);
  float haze = smoothstep(120.0, 780.0, d) * 0.72;
  col = mix(col, uHorizonColor, haze);
  col += vec3(0.42, 0.62, 0.9) * uStorm * pow(fres, 8.0) * 0.12;

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

const SUN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CLOUD_SEA_VERTEX = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const CLOUD_SEA_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uOpacity;
uniform float uStorm;
uniform float uFlash;
uniform vec2 uWind;

varying vec3 vWorld;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = rot * p * 2.03;
    a *= 0.5;
  }
  return v / 0.9375;
}

void main() {
  vec2 p = vWorld.xz * 0.0032;
  vec2 drift = uWind * uTime * 0.005 + vec2(uTime * 0.0012, -uTime * 0.0008);
  float warp = fbm(p * 0.7 + drift * 0.4 + 3.1);
  float base = fbm(p + drift + warp * 1.35);
  float detail = fbm(p * 3.3 - drift * 1.3 + 11.0);
  float field = base * 0.78 + detail * 0.3;

  float cover = smoothstep(0.33, 0.6, field);
  float dist = length(vWorld.xz);
  float edge = 1.0 - smoothstep(430.0, 1350.0, dist);
  float clearF = pow(max(1.0 - uStorm, 0.0), 1.6);
  float alpha = clamp(cover * 1.08 + clearF * 0.4, 0.0, 1.0) * edge * uOpacity * 0.97;

  vec3 deep = mix(vec3(0.012, 0.02, 0.038), vec3(0.42, 0.5, 0.64), clearF);
  vec3 top = mix(vec3(0.1, 0.145, 0.23), vec3(1.02, 0.97, 0.9), clearF);
  vec3 col = mix(deep, top, smoothstep(0.2, 0.9, field) * 0.82 + detail * 0.18);
  col += vec3(0.16, 0.22, 0.35) * smoothstep(0.5, 0.75, detail) * 0.6 * (1.0 - clearF * 0.6);
  col += vec3(0.4, 0.55, 0.92) * uFlash * 0.85;
  col += vec3(0.012, 0.02, 0.04) * uStorm;
  col += vec3(1.0, 0.78, 0.5) * clearF * smoothstep(0.58, 0.9, field) * 0.45;

  gl_FragColor = vec4(max(col, vec3(0.0)), alpha);
}
`;

const SUN_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uOpacity;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float disc = smoothstep(0.30, 0.21, r);
  float halo = exp(-pow(r * 2.4, 2.0)) * 0.5 + exp(-pow(r * 5.2, 2.0)) * 0.65;
  float alpha = clamp(disc * 1.15 + halo, 0.0, 1.0) * uOpacity;
  vec3 core = mix(vec3(1.0, 0.68, 0.32), vec3(1.0, 0.99, 0.93), disc);
  gl_FragColor = vec4(core * (0.55 + disc * 3.2), alpha);
}
`;

interface CloudSprite {
  sprite: THREE.Sprite;
  baseOpacity: number;
  phase: number;
  speed: number;
  baseX: number;
  baseZ: number;
}

export class ShinkaiEnvironment {
  readonly group = new THREE.Group();
  readonly params: EnvironmentParams = {
    storm: 0.92,
    cloudCover: 0.8,
    rainGlow: 1,
    flash: 0,
    gap: 0,
    rainbow: 0,
    sunStrength: 0.05,
    wake: 0,
    wakeRadius: 0,
    cloudSea: 0,
    windX: 0.35,
    windZ: 0.15,
    windStrength: 0.7,
    timeScale: 1,
  };

  readonly skyUniforms: Record<string, THREE.IUniform>;
  readonly waterUniforms: Record<string, THREE.IUniform>;
  readonly sunMesh: THREE.Mesh;
  readonly sunMaterial: THREE.ShaderMaterial;
  readonly keyLight: THREE.DirectionalLight;
  readonly fillLight: THREE.HemisphereLight;
  readonly toriiGroup: THREE.Group;

  private readonly sky: THREE.Mesh;
  private readonly water: THREE.Mesh;
  private readonly cloudSea: THREE.Mesh;
  private readonly cloudSeaUniforms: Record<string, THREE.IUniform>;
  private readonly reflectionRT: THREE.WebGLRenderTarget;
  private readonly reflectionCamera = new THREE.PerspectiveCamera();
  private readonly textureMatrix = new THREE.Matrix4();
  private readonly cloudSprites: CloudSprite[] = [];
  private readonly stoneLights: { light: THREE.PointLight; phase: number; base: number }[] = [];
  private readonly lanternWindows: THREE.Mesh[] = [];
  private flashDir = new THREE.Vector3(0.2, 0.9, -0.4).normalize();
  private time = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    private readonly camera: THREE.PerspectiveCamera,
    textures: EnvironmentTextures,
  ) {
    this.texturesRef = textures;
    this.scene.add(this.group);

    this.keyLight = new THREE.DirectionalLight(0xa8bce6, 1.35);
    this.keyLight.position.copy(SUN_DIRECTION).multiplyScalar(200);
    this.keyLight.target.position.set(0, 0, 0);
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);
    this.fillLight = new THREE.HemisphereLight(0x6b86b8, 0x0a1220, 0.85);
    this.scene.add(this.fillLight);

    this.skyUniforms = {
      uSunDir: { value: SUN_DIRECTION.clone() },
      uFlashDir: { value: this.flashDir },
      uWind: { value: new THREE.Vector2(0.4, 0.2) },
      uTime: { value: 0 },
      uStorm: { value: this.params.storm },
      uCloudCover: { value: this.params.cloudCover },
      uFlash: { value: 0 },
      uGap: { value: 0 },
      uRainbow: { value: 0 },
      uSunStrength: { value: this.params.sunStrength },
      uSkyBoost: { value: 1.06 },
      uStormZenith: { value: new THREE.Color('#02050c') },
      uStormHorizon: { value: new THREE.Color('#1a2a44') },
      uClearZenith: { value: new THREE.Color('#0a63bd') },
      uClearMid: { value: new THREE.Color('#57b6ef') },
      uClearHorizon: { value: new THREE.Color('#b9e8ff') },
      uWarm: { value: new THREE.Color('#ffd59c') },
    };

    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 32), skyMaterial);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.scene.add(this.sky);

    this.sunMaterial = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0.06 } },
      vertexShader: SUN_VERTEX,
      fragmentShader: SUN_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.sunMesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), this.sunMaterial);
    this.sunMesh.frustumCulled = false;
    this.sunMesh.renderOrder = 10;
    this.scene.add(this.sunMesh);

    this.waterUniforms = {
      uReflection: { value: null },
      uNormalMap: { value: textures.waterNormal },
      uTextureMatrix: { value: this.textureMatrix },
      uSunDir: { value: SUN_DIRECTION.clone() },
      uDeepColor: { value: new THREE.Color('#0a2029') },
      uShallowColor: { value: new THREE.Color('#194a52') },
      uHorizonColor: { value: new THREE.Color('#2b3b52') },
      uWind: { value: new THREE.Vector2(0.4, 0.2) },
      uTime: { value: 0 },
      uStorm: { value: this.params.storm },
      uSunStrength: { value: 0.05 },
      uWake: { value: 0 },
      uWakeRadius: { value: 0 },
      uRipple: { value: 1 },
    };

    const reflectionScale = 0.55;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.reflectionRT = new THREE.WebGLRenderTarget(
      Math.max(2, Math.floor(size.x * reflectionScale)),
      Math.max(2, Math.floor(size.y * reflectionScale)),
      { type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: false },
    );
    this.reflectionRT.texture.minFilter = THREE.LinearFilter;
    this.reflectionRT.texture.magFilter = THREE.LinearFilter;
    this.waterUniforms.uReflection.value = this.reflectionRT.texture;

    const waterGeometry = new THREE.PlaneGeometry(2400, 2400, 1, 1);
    const waterMaterial = new THREE.ShaderMaterial({
      uniforms: this.waterUniforms,
      vertexShader: WATER_VERTEX,
      fragmentShader: WATER_FRAGMENT,
      toneMapped: false,
    });
    this.water = new THREE.Mesh(waterGeometry, waterMaterial);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0;
    this.water.renderOrder = 2;
    this.scene.add(this.water);

    this.cloudSeaUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uStorm: { value: 1 },
      uFlash: { value: 0 },
      uWind: { value: new THREE.Vector2(0.4, 0.2) },
    };
    const cloudSeaMaterial = new THREE.ShaderMaterial({
      uniforms: this.cloudSeaUniforms,
      vertexShader: CLOUD_SEA_VERTEX,
      fragmentShader: CLOUD_SEA_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.cloudSea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 1, 1), cloudSeaMaterial);
    this.cloudSea.rotation.x = -Math.PI / 2;
    this.cloudSea.position.y = 38;
    this.cloudSea.renderOrder = 3;
    this.cloudSea.visible = false;
    this.group.add(this.cloudSea);

    this.toriiGroup = this.buildTorii();
    this.group.add(this.toriiGroup);
    this.group.add(this.buildStoneStairway());
    this.group.add(this.buildBackgroundTorii());
    this.buildStoneLanterns();
    this.buildCloudDeck(textures.cloudPuff);
  }

  private makePaintMaterial(texture: THREE.Texture): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.74,
      metalness: 0.06,
      color: 0xffffff,
    });
  }

  private buildTorii(): THREE.Group {
    const group = new THREE.Group();

    const woodMat = new THREE.MeshStandardMaterial({
      map: this.getPaintedWood(),
      roughness: 0.72,
      metalness: 0.05,
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x151413, roughness: 0.45, metalness: 0.2 });
    const strawMat = new THREE.MeshStandardMaterial({ color: 0x9c8656, roughness: 0.95, metalness: 0 });
    const paperMat = new THREE.MeshStandardMaterial({
      color: 0xf3ead6,
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: 0x2a2418,
      emissiveIntensity: 0.4,
    });

    const pillarGeo = new THREE.CylinderGeometry(0.88, 1.16, 17, 24, 1, false);
    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, woodMat);
      pillar.position.set(side * 5.9, 4.6, 0);
      pillar.rotation.z = side * -0.017;
      group.add(pillar);

      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.45, 1.7, 1.5, 18),
        new THREE.MeshStandardMaterial({ map: this.getMossStone(), roughness: 0.95 }),
      );
      base.position.set(side * 5.9, -0.35, 0);
      group.add(base);
    }

    const bendBeam = (width: number, height: number, depth: number, lift: number, segs = 40): THREE.BufferGeometry => {
      const geo = new THREE.BoxGeometry(width, height, depth, segs, 1, 1);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const k = Math.pow(Math.abs(x) / (width * 0.5), 2.4);
        pos.setY(i, y + k * lift);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      return geo;
    };

    const kasagi = new THREE.Mesh(bendBeam(18.2, 0.95, 1.6, 1.15), woodMat);
    kasagi.position.set(0, 13.05, 0);
    group.add(kasagi);

    const cap = new THREE.Mesh(bendBeam(18.9, 0.24, 1.24, 1.22), blackMat);
    cap.position.set(0, 13.62, 0);
    group.add(cap);

    const shimaki = new THREE.Mesh(bendBeam(16.6, 0.6, 1.15, 0.62), woodMat);
    shimaki.position.set(0, 11.85, 0);
    group.add(shimaki);

    const nuki = new THREE.Mesh(bendBeam(16.2, 0.68, 1.0, 0.28), woodMat);
    nuki.position.set(0, 8.55, 0);
    group.add(nuki);

    const gakuzuka = new THREE.Mesh(new THREE.BoxGeometry(0.95, 3.1, 0.7), woodMat);
    gakuzuka.position.set(0, 10.25, 0);
    group.add(gakuzuka);

    const plaque = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.2, 0.24), blackMat);
    plaque.position.set(0, 10.3, 0.46);
    group.add(plaque);

    const plaqueFace = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.8),
      new THREE.MeshBasicMaterial({ map: this.createPlaqueTexture(), transparent: true, toneMapped: false }),
    );
    plaqueFace.position.set(0, 10.3, 0.59);
    group.add(plaqueFace);

    const ropeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-6.7, 9.7, 0.1),
      new THREE.Vector3(-3.4, 9.1, 0.1),
      new THREE.Vector3(0, 8.9, 0.1),
      new THREE.Vector3(3.4, 9.1, 0.1),
      new THREE.Vector3(6.7, 9.7, 0.1),
    ]);
    const rope = new THREE.Mesh(new THREE.TubeGeometry(ropeCurve, 32, 0.19, 7, false), strawMat);
    group.add(rope);

    for (let i = 0; i < 5; i++) {
      const shide = new THREE.Group();
      const x = -5.4 + i * 2.7;
      for (let s = 0; s < 3; s++) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.7), paperMat);
        strip.position.set((s % 2 === 0 ? -0.17 : 0.17), -0.55 - s * 0.62, 0.02);
        strip.rotation.z = (s % 2 === 0 ? 1 : -1) * 0.12;
        shide.add(strip);
      }
      shide.position.set(x, 9.15, 0.2);
      group.add(shide);
    }

    return group;
  }

  private rawWoodTexture: THREE.Texture | null = null;
  private rawStoneTexture: THREE.Texture | null = null;

  private getPaintedWood(): THREE.Texture {
    if (!this.rawWoodTexture) this.rawWoodTexture = this.texturesRef.paintedWood;
    return this.rawWoodTexture;
  }

  private getMossStone(): THREE.Texture {
    if (!this.rawStoneTexture) this.rawStoneTexture = this.texturesRef.mossStone;
    return this.rawStoneTexture;
  }

  private texturesRef!: EnvironmentTextures;

  setTextures(textures: EnvironmentTextures): void {
    this.texturesRef = textures;
  }

  private buildStoneStairway(): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.getMossStone(),
      roughness: 0.97,
      metalness: 0.02,
      color: 0xcfd6c8,
    });
    for (let i = 0; i < 11; i++) {
      const w = 15 - i * 0.42;
      const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 1.9), stoneMat);
      step.position.set((Math.sin(i * 2.7) * 0.2), -1.3 + i * 0.42, -8.5 - i * 1.75);
      step.rotation.y = Math.sin(i * 1.3) * 0.008;
      group.add(step);
    }
    const platform = new THREE.Mesh(new THREE.BoxGeometry(13, 1.2, 9), stoneMat);
    platform.position.set(0, 2.45, -29);
    group.add(platform);

    const shrineWall = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 7, 6),
      new THREE.MeshStandardMaterial({ color: 0x2a2621, roughness: 0.9, map: this.getMossStone() }),
    );
    shrineWall.position.set(0, 6.0, -34);
    group.add(shrineWall);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(8.2, 3.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x181b1d, roughness: 0.65, metalness: 0.1 }),
    );
    roof.position.set(0, 10.6, -34);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    const rockMat = new THREE.MeshStandardMaterial({ map: this.getMossStone(), roughness: 0.95 });
    for (let i = 0; i < 16; i++) {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 1.1, 1), rockMat);
      rock.position.set(
        (Math.random() - 0.5) * 34,
        -0.55 + Math.random() * 0.5,
        (Math.random() - 0.5) * 24 - 2,
      );
      rock.scale.y = 0.5 + Math.random() * 0.5;
      rock.rotation.set(Math.random() * 2, Math.random() * 4, Math.random() * 2);
      group.add(rock);
    }
    return group;
  }

  private buildBackgroundTorii(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      map: this.getPaintedWood(),
      roughness: 0.85,
      color: 0x8a7468,
    });
    const positions = [
      { z: -95, s: 0.62, x: -26 },
      { z: -175, s: 0.42, x: 42 },
      { z: -260, s: 0.3, x: -12 },
    ];
    for (const item of positions) {
      const torii = new THREE.Group();
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 16, 12), mat);
        p.position.set(side * 5.8, 5, 0);
        torii.add(p);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(17, 0.9, 1.4), mat);
      top.position.set(0, 13, 0);
      torii.add(top);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(15, 0.65, 1), mat);
      tie.position.set(0, 8.7, 0);
      torii.add(tie);
      torii.position.set(item.x, -0.3, item.z);
      torii.scale.setScalar(item.s);
      group.add(torii);
    }
    return group;
  }

  private buildStoneLanterns(): void {
    const stoneMat = new THREE.MeshStandardMaterial({
      map: this.getMossStone(),
      roughness: 0.96,
      color: 0xc4cabc,
    });
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb45f').multiplyScalar(1.5), toneMapped: false });
    const positions = [
      { x: -7.4, z: 5.5, y: -1.45, s: 1.1 },
      { x: 8.6, z: 2.5, y: -1.9, s: 1.32 },
      { x: -7.6, z: -13, y: 0.0, s: 1.0 },
      { x: 8.2, z: -18.5, y: 0.1, s: 0.92 },
    ];
    positions.forEach((item, index) => {
      const lantern = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 1.05, 0.5, 8), stoneMat);
      base.position.y = 0.25;
      lantern.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.55, 8), stoneMat);
      shaft.position.y = 1.25;
      lantern.add(shaft);
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.68, 0.3, 8), stoneMat);
      plate.position.y = 2.1;
      lantern.add(plate);
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.0, 1.15), stoneMat);
      box.position.y = 2.78;
      lantern.add(box);
      for (let s = 0; s < 4; s++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), glowMat);
        const a = (s / 4) * Math.PI * 2;
        win.position.set(Math.sin(a) * 0.585, 2.78, Math.cos(a) * 0.585);
        win.rotation.y = a;
        lantern.add(win);
        this.lanternWindows.push(win);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.42, 0.72, 6), stoneMat);
      roof.position.y = 3.62;
      roof.rotation.y = Math.PI / 6;
      lantern.add(roof);
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), stoneMat);
      orb.position.y = 4.12;
      lantern.add(orb);

      lantern.position.set(item.x, item.y, item.z);
      lantern.scale.setScalar(item.s);
      lantern.rotation.z = index === 1 ? 0.09 : index === 2 ? -0.05 : 0.02;
      lantern.rotation.y = index * 0.9;
      this.group.add(lantern);

      if (index < 2) {
        const light = new THREE.PointLight(0xffa14d, 150, 38, 2);
        light.position.set(item.x, item.y + 2.8 * item.s, item.z);
        this.scene.add(light);
        this.stoneLights.push({ light, phase: index * 2.7, base: 150 });
      }
    });
  }

  private buildCloudDeck(cloudTexture: THREE.Texture): void {
    const count = 26;
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: new THREE.Color('#26374f'),
        toneMapped: false,
        rotation: Math.random() * Math.PI * 2,
      });
      const sprite = new THREE.Sprite(mat);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 45 + Math.random() * 150;
      const y = 38 + Math.random() * 105;
      const scale = 55 + Math.random() * 110;
      sprite.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      sprite.scale.set(scale, scale * (0.42 + Math.random() * 0.2), 1);
      sprite.renderOrder = 5;
      this.group.add(sprite);
      this.cloudSprites.push({
        sprite,
        baseOpacity: 0.08 + Math.random() * 0.14,
        phase: Math.random() * 10,
        speed: 0.1 + Math.random() * 0.25,
        baseX: sprite.position.x,
        baseZ: sprite.position.z,
      });
    }
  }

  private createPlaqueTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 340;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0e0d0c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#c9a45f';
    ctx.lineWidth = 5;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.strokeStyle = 'rgba(201, 164, 95, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);
    ctx.fillStyle = '#e3c07c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 120px "Noto Serif Display", "Cormorant Garamond", serif';
    ctx.fillText('灯', canvas.width / 2, canvas.height * 0.47);
    ctx.font = '500 30px "Noto Serif Display", serif';
    ctx.fillStyle = 'rgba(227, 192, 124, 0.78)';
    ctx.fillText('天 の 灯', canvas.width / 2, canvas.height * 0.78);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  setWaterNormalTexture(texture: THREE.Texture): void {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    this.waterUniforms.uNormalMap.value = texture;
  }

  setWind(windX: number, windZ: number, strength: number): void {
    this.params.windX = windX;
    this.params.windZ = windZ;
    this.params.windStrength = strength;
  }

  triggerFlash(direction: THREE.Vector3, strength: number): void {
    this.flashDir.copy(direction).normalize();
    this.params.flash = strength;
    this.skyUniforms.uFlashDir.value = this.flashDir;
  }

  update(elapsed: number, dt: number): void {
    this.time = elapsed;
    const p = this.params;

    this.reflectionCamera.far = this.camera.far;
    this.sky.position.copy(this.camera.position);
    this.sunMesh.position.copy(this.camera.position).addScaledVector(SUN_DIRECTION, 3200);
    this.sunMesh.lookAt(this.camera.position);

    this.skyUniforms.uTime.value = elapsed;
    this.skyUniforms.uStorm.value = p.storm;
    this.skyUniforms.uCloudCover.value = THREE.MathUtils.clamp(p.cloudCover, 0.05, 1);
    this.skyUniforms.uFlash.value = p.flash;
    this.skyUniforms.uGap.value = p.gap;
    this.skyUniforms.uRainbow.value = p.rainbow;
    this.skyUniforms.uSunStrength.value = p.sunStrength;
    this.skyUniforms.uWind.value.set(p.windX, p.windZ);

    this.sunMaterial.uniforms.uOpacity.value = THREE.MathUtils.clamp(p.sunStrength * (1 - p.storm), 0, 1) * 0.7;

    this.waterUniforms.uTime.value = elapsed;
    this.waterUniforms.uStorm.value = p.storm;
    this.waterUniforms.uSunStrength.value = p.sunStrength;
    this.waterUniforms.uWake.value = p.wake;
    this.waterUniforms.uWakeRadius.value = p.wakeRadius;
    this.waterUniforms.uWind.value.set(p.windX, p.windZ);
    this.waterUniforms.uHorizonColor.value.setRGB(
      0.12 + 0.3 * (1 - p.storm),
      0.17 + 0.38 * (1 - p.storm),
      0.25 + 0.35 * (1 - p.storm),
    );
    this.waterUniforms.uRipple.value = 0.35 + p.storm * 0.5;

    const cloudSea = this.cloudSeaUniforms;
    cloudSea.uTime.value = elapsed;
    cloudSea.uOpacity.value = p.cloudSea;
    cloudSea.uStorm.value = p.storm;
    cloudSea.uFlash.value = p.flash;
    cloudSea.uWind.value.set(p.windX, p.windZ);
    this.cloudSea.visible = p.cloudSea > 0.002;

    this.keyLight.intensity = 0.55 + (1 - p.storm) * 1.5 + p.flash * 9;
    this.keyLight.color.setRGB(
      0.55 + 0.45 * (1 - p.storm),
      0.66 + 0.3 * (1 - p.storm),
      0.88 - 0.3 * (1 - p.storm),
    );
    this.fillLight.intensity = 0.45 + (1 - p.storm) * 0.8;

    for (const stone of this.stoneLights) {
      const flicker = 0.86 + 0.14 * Math.sin(elapsed * 6.3 + stone.phase) * Math.sin(elapsed * 2.7 + stone.phase * 1.7);
      stone.light.intensity = stone.base * flicker * (0.85 + 0.35 * (1 - p.storm));
    }
    const windowGlow = 1.25 + 0.22 * Math.sin(elapsed * 5.1);
    for (const win of this.lanternWindows) {
      const mat = win.material as THREE.MeshBasicMaterial;
      mat.color.setRGB(1.0 * windowGlow, 0.62 * windowGlow, 0.3 * windowGlow);
    }

    const spriteOpacityBase = p.storm * p.cloudCover;
    for (let i = 0; i < this.cloudSprites.length; i++) {
      const c = this.cloudSprites[i];
      const drift = elapsed * c.speed * (0.4 + p.windStrength);
      c.sprite.position.x = c.baseX + Math.sin(elapsed * 0.02 + c.phase) * 12 + p.windX * drift * 6;
      c.sprite.position.z = c.baseZ + Math.cos(elapsed * 0.017 + c.phase) * 12 + p.windZ * drift * 6;
      const dist = c.sprite.position.distanceTo(this.camera.position);
      const nearFade = THREE.MathUtils.smoothstep(dist, 14, 65);
      const farFade = 1 - THREE.MathUtils.smoothstep(dist, 260, 480);
      const opacity = c.baseOpacity * spriteOpacityBase * nearFade * farFade * 1.1;
      (c.sprite.material as THREE.SpriteMaterial).opacity = opacity;
      (c.sprite.material as THREE.SpriteMaterial).rotation += dt * 0.008;
    }

    this.params.flash = Math.max(0, p.flash - dt * 6.5);
  }

  renderReflection(): void {
    const camera = this.camera;
    camera.updateMatrixWorld();
    const vc = this.reflectionCamera;
    const normal = new THREE.Vector3(0, 1, 0);
    const reflectorPos = new THREE.Vector3(0, 0, 0);
    const cameraPos = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);

    const view = new THREE.Vector3().subVectors(reflectorPos, cameraPos);
    view.reflect(normal).negate().add(reflectorPos);

    const rotation = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const lookAt = new THREE.Vector3(0, 0, -1).applyMatrix4(rotation).add(cameraPos);
    const target = new THREE.Vector3().subVectors(reflectorPos, lookAt).reflect(normal).negate().add(reflectorPos);

    vc.position.copy(view);
    const up = new THREE.Vector3(0, 1, 0).applyMatrix4(rotation).reflect(normal);
    vc.up.copy(up);
    vc.lookAt(target);
    vc.near = camera.near;
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, reflectorPos);
    plane.applyMatrix4(vc.matrixWorldInverse);
    const clipPlane = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const projection = vc.projectionMatrix;
    const q = new THREE.Vector4();
    q.x = (Math.sign(clipPlane.x) + projection.elements[8]) / projection.elements[0];
    q.y = (Math.sign(clipPlane.y) + projection.elements[9]) / projection.elements[5];
    q.z = -1;
    q.w = (1 + projection.elements[10]) / projection.elements[14];
    clipPlane.multiplyScalar(2 / clipPlane.dot(q));
    projection.elements[2] = clipPlane.x;
    projection.elements[6] = clipPlane.y;
    projection.elements[10] = clipPlane.z + 1 - 0.003;
    projection.elements[14] = clipPlane.w;

    this.water.visible = false;
    this.sky.position.copy(vc.position);
    const currentTarget = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.reflectionRT);
    this.renderer.clear();
    this.renderer.render(this.scene, vc);
    this.renderer.setRenderTarget(currentTarget);
    this.sky.position.copy(this.camera.position);
    this.water.visible = true;
  }

  resize(width: number, height: number): void {
    const scale = 0.55;
    this.reflectionRT.setSize(Math.max(2, Math.floor(width * scale)), Math.max(2, Math.floor(height * scale)));
  }

  dispose(): void {
    this.reflectionRT.dispose();
  }
}
