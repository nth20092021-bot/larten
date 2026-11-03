// /src/graphics/ReverseRainShader.ts

import * as THREE from 'three';
import { RainParams } from '../types/SkyLanternTypes';

const RAIN_VERTEX = /* glsl */ `
precision highp float;

attribute vec4 aData;
attribute float aSeed;

uniform float uTime;
uniform float uClock;
uniform float uReverse;
uniform float uIntensity;
uniform float uStorm;
uniform float uSparkle;
uniform vec3 uCenter;
uniform vec2 uWind;
uniform float uWindStrength;

varying vec2 vUv;
varying float vSeed;
varying float vFade;
varying float vReverse;
varying float vBright;

void main() {
  vUv = uv;
  float seed = fract(aSeed * 13.137 + aData.x * 3.7);
  vSeed = seed;
  vReverse = uReverse;

  float boxR = 88.0;
  float boxH = 156.0;

  vec2 radial = vec2(cos(aData.x), sin(aData.x)) * aData.y * boxR;
  radial += uWind * uTime * (4.0 + uWindStrength * 8.0);
  vec2 wrap = mod(radial + boxR, boxR * 2.0) - boxR;

  float fallQ = fract(aData.z + uTime * (0.11 + aData.w * 0.17));
  float riseQ = fract(aData.z * 0.731 + uTime * (0.16 + aData.w * 0.24));

  float yFall = boxH * 0.48 - fallQ * boxH;
  float yRise = -boxH * 0.44 + riseQ * boxH * 1.02;
  float mixT = smoothstep(0.0, 1.0, uReverse);
  float y = mix(yFall, yRise, mixT);
  y += sin(mixT * 3.14159265) * sin(uClock * 5.0 + seed * 47.0) * 0.55;

  vec2 wobble = vec2(
    sin(uClock * 0.9 + seed * 31.0),
    cos(uClock * 0.74 + seed * 23.0)
  ) * (0.3 + uReverse * 0.85);

  vec3 world = uCenter + vec3(wrap.x + wobble.x, y, wrap.y + wobble.y);

  vec4 mv = viewMatrix * vec4(world, 1.0);

  float width = mix(0.038, 0.085, uReverse) * (0.55 + aData.w * 0.8);
  float stretch = mix(1.3, 3.6, uReverse) * (0.5 + aData.w);
  float lean = (uWind.x * 0.7 + 0.12) * position.y;
  mv.x += position.x * width + lean * 0.35;
  mv.y += position.y * stretch;

  gl_Position = projectionMatrix * mv;

  float distFade = smoothstep(1.0, 7.0, -mv.z);
  float edgeFade = 1.0 - smoothstep(boxR * 0.68, boxR * 0.98, max(abs(wrap.x), abs(wrap.y)));
  float verticalFade = smoothstep(0.0, 4.0, y + boxH * 0.44) * (1.0 - smoothstep(boxH * 0.38, boxH * 0.5, y));
  vFade = distFade * edgeFade * verticalFade * uIntensity;
  vBright = 0.55 + fract(seed * 8.31) * 0.9 + uSparkle * 0.6;
  vBright *= mix(1.0, 1.35, uReverse);
}
`;

const RAIN_FRAGMENT = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying float vSeed;
varying float vFade;
varying float vReverse;
varying float vBright;

uniform float uStorm;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float across = p.x;
  float along = p.y;

  float coreD = across / 0.34;
  float core = exp(-coreD * coreD);
  float taper = smoothstep(1.0, 0.5, abs(along));
  float alpha = core * taper * vFade * 0.8;
  if (alpha < 0.002) discard;

  float dR = (across + 0.3) / 0.42;
  float dG = across / 0.3;
  float dB = (across - 0.3) / 0.42;
  vec3 chromatic = vec3(exp(-dR * dR), exp(-dG * dG), exp(-dB * dB));

  vec3 spectral = 0.5 + 0.5 * cos(6.28318 * (vSeed + across * 0.5 + vec3(0.0, 0.33, 0.67)));
  float edge = smoothstep(0.08, 0.85, abs(across));
  vec3 base = vec3(0.72, 0.86, 1.0);
  vec3 col = mix(base, spectral, 0.22 + 0.4 * edge + vSeed * 0.14);
  col += chromatic * 0.18;
  col += vec3(0.35, 0.5, 0.8) * uStorm * 0.25;

  gl_FragColor = vec4(col * vBright, clamp(alpha, 0.0, 1.0));
}
`;

export class ReverseRainSystem {
  readonly mesh: THREE.Mesh;
  readonly params: RainParams = {
    intensity: 1,
    reverse: 0,
    timeScale: 1,
    windX: 0.3,
    windZ: 0.1,
    storm: 0.9,
    sparkle: 0.4,
  };

  private readonly uniforms: Record<string, THREE.IUniform>;
  private clock = 0;
  private realClock = 0;

  constructor(count = 10000) {
    const base = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = base.index;
    geometry.setAttribute('position', base.attributes.position);
    geometry.setAttribute('uv', base.attributes.uv);

    const data = new Float32Array(count * 4);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random());
      data[i * 4] = angle;
      data[i * 4 + 1] = radius;
      data[i * 4 + 2] = Math.random();
      data[i * 4 + 3] = Math.random();
      seeds[i] = Math.random();
    }
    geometry.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    geometry.instanceCount = count;
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 100000);

    this.uniforms = {
      uTime: { value: 0 },
      uClock: { value: 0 },
      uReverse: { value: 0 },
      uIntensity: { value: 1 },
      uStorm: { value: 0.9 },
      uSparkle: { value: 0.4 },
      uCenter: { value: new THREE.Vector3() },
      uWind: { value: new THREE.Vector2(0.3, 0.1) },
      uWindStrength: { value: 0.6 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: RAIN_VERTEX,
      fragmentShader: RAIN_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, windStrength: number): void {
    this.realClock += dt;
    this.clock += dt * this.params.timeScale;
    this.uniforms.uTime.value = this.clock;
    this.uniforms.uClock.value = this.realClock;
    this.uniforms.uReverse.value = this.params.reverse;
    this.uniforms.uIntensity.value = this.params.intensity;
    this.uniforms.uStorm.value = this.params.storm;
    this.uniforms.uSparkle.value = this.params.sparkle;
    this.uniforms.uCenter.value.copy(camera.position);
    this.uniforms.uWind.value.set(this.params.windX, this.params.windZ);
    this.uniforms.uWindStrength.value = windStrength;
    this.mesh.visible = this.params.intensity > 0.002;
  }
}
