// /src/graphics/SkyLanternManager.ts

import * as THREE from 'three';
import gsap from 'gsap';
import { LanternFlightParams, LANTERN_COUNT, StudentProfile } from '../types/SkyLanternTypes';

const HISTORY = 40;
const EMBERS = 24;

const LANTERN_VERTEX = /* glsl */ `
precision highp float;

attribute float aSeed;
attribute float aGlow;
attribute float aGrey;
attribute float aAlpha;

uniform float uTime;

varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vSeed;
varying float vGlow;
varying float vGrey;
varying float vAlpha;
varying float vHeight;

void main() {
  vUv = uv;
  vSeed = aSeed;
  vGlow = aGlow;
  vGrey = aGrey;
  vAlpha = aAlpha;
  vHeight = uv.y;

  vec3 transformed = position;
  float sway = sin(uTime * 1.6 + aSeed * 31.0 + position.y * 3.4) * 0.028 * aGlow;
  transformed.x += sway;
  transformed.z += sway * 0.75;

  vec4 local = instanceMatrix * vec4(transformed, 1.0);
  vec4 world = modelMatrix * local;
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const LANTERN_FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uPaper;
uniform float uTime;
uniform float uStorm;

varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vSeed;
varying float vGlow;
varying float vGrey;
varying float vAlpha;
varying float vHeight;

void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(normalize(vNormal), V), 0.0, 1.0), 2.1);
  vec3 paperTex = texture2D(uPaper, vUv * vec2(4.0, 2.2)).rgb;
  float fibers = dot(paperTex, vec3(0.3333));

  float flick = 0.8 + 0.2 * sin(uTime * 9.0 + vSeed * 53.0) * sin(uTime * 3.9 + vSeed * 17.0);
  float low = clamp(1.0 - vHeight, 0.0, 1.0);
  float glow = vGlow * (0.5 + 1.9 * pow(low, 2.1)) * flick;
  float rim = smoothstep(0.0, 0.055, vHeight) * smoothstep(1.0, 0.94, vHeight);

  vec3 warmCore = vec3(1.0, 0.34, 0.04) * 2.0;
  vec3 warmMid = vec3(1.0, 0.52, 0.14);
  vec3 paperBase = vec3(0.42, 0.23, 0.09) * (0.55 + fibers * 0.45);
  float vertical = 0.3 + 0.7 * pow(clamp(low, 0.0, 1.0), 0.7);

  vec3 col = paperBase * vertical * mix(0.5, 1.0, rim);
  col += warmCore * glow * (0.07 + pow(low, 2.4) * 1.55);
  col += warmMid * glow * 0.12;
  col += vec3(1.0, 0.44, 0.12) * fres * glow * 0.28;
  col += vec3(0.09, 0.13, 0.21) * uStorm * (1.0 - vGrey) * 0.12;

  vec3 deadCol = vec3(0.22, 0.29, 0.37) * (0.55 + fibers * 0.45);
  deadCol += vec3(0.3, 0.42, 0.52) * fres * 0.35;
  col = mix(col, deadCol, vGrey);

  float alpha = vAlpha * (0.94 + 0.06 * rim);
  gl_FragColor = vec4(max(col, vec3(0.0)), alpha);
}
`;

const BILLBOARD_VERTEX = /* glsl */ `
precision highp float;

attribute float aSeed;
attribute float aGlow;
attribute float aGrey;
attribute float aAlpha;

uniform float uTime;
uniform float uSize;
uniform float uOffsetY;

varying vec2 vUv;
varying float vSeed;
varying float vGlow;
varying float vGrey;
varying float vAlpha;

void main() {
  vUv = uv;
  vSeed = aSeed;
  vGlow = aGlow;
  vGrey = aGrey;
  vAlpha = aAlpha;

  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  center.y += uOffsetY;

  vec3 toCam = normalize(cameraPosition - center);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = cross(toCam, right);

  vec3 world = center + (right * position.x + up * position.y) * uSize;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const HALO_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vGlow;
varying float vGrey;
varying float vAlpha;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float core = exp(-d * d * 5.5);
  float flick = 0.82 + 0.18 * sin(uTime * 7.0 + vSeed * 43.0);
  vec3 col = mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.83, 0.48), exp(-d * 3.4));
  float alpha = core * 0.18 * vGlow * flick * vAlpha * (1.0 - vGrey);
  gl_FragColor = vec4(col * (1.0 + core * 1.1), alpha);
}
`;

const FLAME_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
varying vec2 vUv;
varying float vSeed;
varying float vGlow;
varying float vGrey;
varying float vAlpha;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(vec2(p.x * 1.8, p.y * 1.1 + 0.18));
  if (d > 1.0) discard;
  float flick = 0.75 + 0.25 * sin(uTime * 13.0 + vSeed * 51.0);
  float core = exp(-d * d * 7.0);
  float alpha = core * 0.55 * vGlow * flick * vAlpha * (1.0 - vGrey);
  vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.97, 0.82), core);
  gl_FragColor = vec4(col * (1.0 + core * 3.5), alpha);
}
`;

const EMBER_VERTEX = /* glsl */ `
precision highp float;

attribute float aAlpha;
attribute float aSize;
attribute float aSeed;

varying float vAlpha;
varying float vSeed;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * (240.0 / max(1.0, -mv.z));
  vAlpha = aAlpha;
  vSeed = aSeed;
}
`;

const EMBER_FRAGMENT = /* glsl */ `
precision highp float;

varying float vAlpha;
varying float vSeed;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d = length(p);
  if (d > 1.0) discard;
  float core = exp(-d * d * 5.0);
  float twinkle = 0.65 + 0.35 * sin(vSeed * 90.0);
  vec3 col = mix(vec3(1.0, 0.35, 0.06), vec3(1.0, 0.9, 0.62), core);
  gl_FragColor = vec4(col * (1.0 + core * 2.0), core * vAlpha * twinkle);
}
`;

const PETAL_VERTEX = /* glsl */ `
precision highp float;
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const PETAL_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
varying float vSeed;
varying vec3 vWorld;

void main() {
  float edge = clamp(1.0 - abs(vUv.x * 2.0 - 1.0), 0.0, 1.0);
  float taper = clamp(sin(vUv.y * 3.14159), 0.0, 1.0);
  float alpha = pow(edge, 1.6) * pow(taper, 0.7);
  alpha *= uOpacity;
  float shimmer = 0.75 + 0.25 * sin(uTime * 2.2 + vSeed * 20.0 + vUv.y * 6.0);
  vec3 col = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.95, 0.78), pow(clamp(vUv.y, 0.0, 1.0), 1.3));
  col += vec3(1.0, 0.85, 0.55) * pow(edge, 5.0) * 0.6;
  gl_FragColor = vec4(col * shimmer * 1.7, alpha * 0.9);
}
`;

const RAY_VERTEX = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RAY_FRAGMENT = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float rays = pow(0.5 + 0.5 * cos(a * 22.0 + uTime * 0.12), 30.0);
  float falloff = exp(-r * 2.7) * smoothstep(1.0, 0.1, r);
  float core = exp(-r * r * 22.0);
  vec3 col = mix(vec3(1.0, 0.5, 0.12), vec3(1.0, 0.97, 0.82), core);
  float alpha = (core * 0.85 + rays * falloff * 0.5) * uOpacity;
  gl_FragColor = vec4(col * (core * 3.2 + rays * falloff * 1.7), alpha);
}
`;

interface LanternRuntime {
  id: number;
  student: StudentProfile;
  alive: boolean;
  ascended: boolean;
  deathAge: number;
  deathJourney: number;
  driftAngle: number;
  seed: number;
  ringAngle: number;
  startRadius: number;
  startY: number;
  bobPhase: number;
  scale: number;
  grey: number;
  glow: number;
  alpha: number;
}

interface LanternPaperAttributes {
  seed: THREE.InstancedBufferAttribute;
  glow: THREE.InstancedBufferAttribute;
  grey: THREE.InstancedBufferAttribute;
  alpha: THREE.InstancedBufferAttribute;
}

export interface LanternFlightParamsPublic extends LanternFlightParams {
  glowBoost: number;
}

function createPaperGeometry(): THREE.BufferGeometry {
  const profile = [
    new THREE.Vector2(0.6, -0.85),
    new THREE.Vector2(0.76, -0.72),
    new THREE.Vector2(0.9, -0.3),
    new THREE.Vector2(0.94, 0.15),
    new THREE.Vector2(0.87, 0.56),
    new THREE.Vector2(0.72, 0.78),
    new THREE.Vector2(0.58, 0.84),
  ];
  const geo = new THREE.LatheGeometry(profile, 26);
  geo.computeVertexNormals();
  return geo;
}

function createBillboardGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.deleteAttribute('normal');
  return geo;
}

function createPetalGeometry(): THREE.BufferGeometry {
  const su = 8;
  const sv = 10;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= sv; j++) {
    const v = j / sv;
    const w = Math.sin(Math.PI * v) * 0.17;
    for (let i = 0; i <= su; i++) {
      const u = i / su;
      const x = (u * 2 - 1) * w;
      const z = Math.sin(v * Math.PI) * 0.16 + v * v * 0.06;
      positions.push(x, v, z);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < sv; j++) {
    for (let i = 0; i < su; i++) {
      const a = j * (su + 1) + i;
      const b = a + su + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export class SkyLanternManager {
  readonly group = new THREE.Group();
  readonly params: LanternFlightParamsPublic = {
    journey: 0,
    storm: 0.9,
    windX: 0.3,
    windZ: 0.1,
    windStrength: 0.7,
    elapsed: 0,
    glowBoost: 1,
  };

  readonly lanterns: LanternRuntime[] = [];
  destinyId = -1;
  destinyT = 0;
  readonly destinyTarget = new THREE.Vector3(0, 168, -62);
  protectedId = -1;

  private readonly shell: THREE.InstancedMesh;
  private readonly halo: THREE.InstancedMesh;
  private readonly flame: THREE.InstancedMesh;
  private readonly embers: THREE.Points;
  private readonly shellAttrs: LanternPaperAttributes;
  private readonly haloAttrs: LanternPaperAttributes;
  private readonly flameAttrs: LanternPaperAttributes;
  private readonly shellMaterial: THREE.ShaderMaterial;
  private readonly haloMaterial: THREE.ShaderMaterial;
  private readonly flameMaterial: THREE.ShaderMaterial;

  private readonly history: Float32Array;
  private readonly historyIndex: Int32Array = new Int32Array(LANTERN_COUNT);
  private readonly emberPositions: Float32Array;
  private readonly emberAlphas: Float32Array;
  private readonly emberSizes: Float32Array;
  private readonly emberSeeds: Float32Array;

  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly euler = new THREE.Euler();
  private readonly scaleVec = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly basePosition = new THREE.Vector3();
  private readonly center = new THREE.Vector3(0, 8, 0);

  readonly bloom: VictoryBloom;

  private winnerGlow = 0;

  constructor(
    students: StudentProfile[],
    paperTexture: THREE.Texture,
    glowTexture: THREE.Texture,
  ) {
    this.history = new Float32Array(LANTERN_COUNT * HISTORY * 3);
    this.emberPositions = new Float32Array(LANTERN_COUNT * EMBERS * 3);
    this.emberAlphas = new Float32Array(LANTERN_COUNT * EMBERS);
    this.emberSizes = new Float32Array(LANTERN_COUNT * EMBERS);
    this.emberSeeds = new Float32Array(LANTERN_COUNT * EMBERS);

    this.shellMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPaper: { value: paperTexture },
        uTime: { value: 0 },
        uStorm: { value: 0.9 },
      },
      vertexShader: LANTERN_VERTEX,
      fragmentShader: LANTERN_FRAGMENT,
      transparent: true,
      depthWrite: true,
      side: THREE.FrontSide,
      toneMapped: false,
    });

    const shellGeo = createPaperGeometry();
    this.shell = new THREE.InstancedMesh(shellGeo, this.shellMaterial, LANTERN_COUNT);
    this.shell.frustumCulled = false;
    this.shell.renderOrder = 30;
    this.shellAttrs = this.attachAttributes(shellGeo);

    const haloGeo = createBillboardGeometry();
    this.haloMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: 3.4 }, uOffsetY: { value: 0 } },
      vertexShader: BILLBOARD_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.halo = new THREE.InstancedMesh(haloGeo, this.haloMaterial, LANTERN_COUNT);
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 31;
    this.haloAttrs = this.attachAttributes(haloGeo);

    const flameGeo = createBillboardGeometry();
    this.flameMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uSize: { value: 0.72 }, uOffsetY: { value: -0.55 } },
      vertexShader: BILLBOARD_VERTEX,
      fragmentShader: FLAME_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.flame = new THREE.InstancedMesh(flameGeo, this.flameMaterial, LANTERN_COUNT);
    this.flame.frustumCulled = false;
    this.flame.renderOrder = 32;
    this.flameAttrs = this.attachAttributes(flameGeo);

    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(this.emberPositions, 3));
    emberGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.emberAlphas, 1));
    emberGeo.setAttribute('aSize', new THREE.BufferAttribute(this.emberSizes, 1));
    emberGeo.setAttribute('aSeed', new THREE.BufferAttribute(this.emberSeeds, 1));
    this.embers = new THREE.Points(
      emberGeo,
      new THREE.ShaderMaterial({
        vertexShader: EMBER_VERTEX,
        fragmentShader: EMBER_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    this.embers.frustumCulled = false;
    this.embers.renderOrder = 33;

    this.group.add(this.shell, this.halo, this.flame, this.embers);

    this.bloom = new VictoryBloom(glowTexture);
    this.group.add(this.bloom.group);

    this.reset(students, -1);
  }

  private attachAttributes(geo: THREE.BufferGeometry): LanternPaperAttributes {
    const seed = new THREE.InstancedBufferAttribute(new Float32Array(LANTERN_COUNT), 1);
    const glow = new THREE.InstancedBufferAttribute(new Float32Array(LANTERN_COUNT), 1);
    const grey = new THREE.InstancedBufferAttribute(new Float32Array(LANTERN_COUNT), 1);
    const alpha = new THREE.InstancedBufferAttribute(new Float32Array(LANTERN_COUNT), 1);
    for (let i = 0; i < LANTERN_COUNT; i++) {
      seed.setX(i, Math.random());
      glow.setX(i, 1);
      grey.setX(i, 0);
      alpha.setX(i, 1);
    }
    geo.setAttribute('aSeed', seed);
    geo.setAttribute('aGlow', glow);
    geo.setAttribute('aGrey', grey);
    geo.setAttribute('aAlpha', alpha);
    return { seed, glow, grey, alpha };
  }

  reset(students: StudentProfile[], protectedId: number): void {
    this.lanterns.length = 0;
    this.protectedId = protectedId;
    this.destinyId = protectedId >= 0 ? protectedId : -1;
    this.destinyT = 0;
    this.winnerGlow = 0;
    this.bloom.hide();

    for (let i = 0; i < LANTERN_COUNT; i++) {
      const seed = Math.random();
      const lantern: LanternRuntime = {
        id: i,
        student: students[i] ?? { id: i, name: `Học sinh ${i + 1}`, slot: i },
        alive: true,
        ascended: false,
        deathAge: -1,
        deathJourney: 0,
        driftAngle: Math.random() * Math.PI * 2,
        seed,
        ringAngle: (i / LANTERN_COUNT) * Math.PI * 2 + seed * 0.55,
        startRadius: 12.0 + (i % 7) * 2.2 + seed * 2.6,
        startY: 3.0 + (i % 6) * 1.5 + seed * 1.6,
        bobPhase: Math.random() * Math.PI * 2,
        scale: 0.82 + seed * 0.24,
        grey: 0,
        glow: 1,
        alpha: 1,
      };
      this.lanterns.push(lantern);

      const attrSeed = this.shellAttrs.seed;
      attrSeed.setX(i, seed);
      this.shellAttrs.glow.setX(i, 1);
      this.shellAttrs.grey.setX(i, 0);
      this.shellAttrs.alpha.setX(i, 1);
      this.haloAttrs.seed.setX(i, seed);
      this.flameAttrs.seed.setX(i, seed);
      this.haloAttrs.grey.setX(i, 0);
      this.flameAttrs.grey.setX(i, 0);

      this.historyIndex[i] = 0;
      this.computePosition(lantern, 0, this.basePosition);
      for (let h = 0; h < HISTORY; h++) {
        const base = (i * HISTORY + h) * 3;
        this.history[base] = this.basePosition.x;
        this.history[base + 1] = this.basePosition.y - h * 0.02;
        this.history[base + 2] = this.basePosition.z;
      }
      for (let e = 0; e < EMBERS; e++) {
        const idx = i * EMBERS + e;
        this.emberSeeds[idx] = Math.random();
        this.emberSizes[idx] = 0.8 + Math.random() * 1.1;
      }
    }

    this.shellAttrs.seed.needsUpdate = true;
    this.haloAttrs.seed.needsUpdate = true;
    this.flameAttrs.seed.needsUpdate = true;
    this.updateAttributes();
    this.updateEmbers(0, true);
  }

  private computePosition(lantern: LanternRuntime, elapsed: number, out: THREE.Vector3): void {
    const p = this.params;
    const jBase = lantern.alive ? p.journey : lantern.deathJourney;
    let j = jBase;

    if (lantern.id === this.destinyId && lantern.alive && this.destinyT > 0) {
      j = THREE.MathUtils.lerp(jBase, 1, this.destinyT);
    }

    const eased = THREE.MathUtils.smoothstep(j, 0, 1);
    const angle = lantern.ringAngle + eased * (2.0 + lantern.seed * 1.5);
    const radius = THREE.MathUtils.lerp(lantern.startRadius, 4.2 + lantern.seed * 3.4, eased);
    let x = Math.cos(angle) * radius * 1.35;
    let z = Math.sin(angle) * radius * 0.95 - eased * 26;
    let y = lantern.startY + eased * 150 + Math.sin(elapsed * 0.9 + lantern.bobPhase) * 1.35;

    const gust = 0.6 + Math.sin(elapsed * 1.4 + lantern.seed * 12.0) * 0.4;
    x += p.windX * (1.4 + p.storm * 2.2) * gust;
    z += p.windZ * (1.4 + p.storm * 2.2) * gust;
    x += Math.sin(elapsed * 0.55 + lantern.bobPhase * 2.0) * (0.8 + p.storm * 0.9);
    z += Math.cos(elapsed * 0.47 + lantern.bobPhase) * 0.8;

    if (lantern.id === this.destinyId && lantern.alive && this.destinyT > 0) {
      const k = THREE.MathUtils.smoothstep(this.destinyT, 0, 1);
      x = THREE.MathUtils.lerp(x, this.destinyTarget.x, k);
      y = THREE.MathUtils.lerp(y, this.destinyTarget.y, k);
      z = THREE.MathUtils.lerp(z, this.destinyTarget.z, k);
      x += Math.sin(k * Math.PI) * Math.sin(elapsed * 2.3) * 4;
      y += Math.sin(k * Math.PI) * 5;
    }

    if (!lantern.alive && !lantern.ascended) {
      const age = Math.max(0, lantern.deathAge);
      const k = THREE.MathUtils.smoothstep(age, 0, 3.4);
      x += Math.cos(lantern.driftAngle) * k * 30;
      z += Math.sin(lantern.driftAngle) * k * 30;
      y -= k * 9;
      x += Math.sin(age * 2.0 + lantern.driftAngle) * k * 1.5;
    }

    out.set(x, y, z);
  }

  update(dt: number, elapsed: number, camera: THREE.Camera): void {
    this.params.elapsed = elapsed;
    const p = this.params;
    this.shellMaterial.uniforms.uTime.value = elapsed;
    this.shellMaterial.uniforms.uStorm.value = p.storm;
    this.haloMaterial.uniforms.uTime.value = elapsed;
    this.flameMaterial.uniforms.uTime.value = elapsed;

    const alive = this.lanterns.filter((l) => l.alive && !l.ascended);
    this.center.set(0, 0, 0);
    if (alive.length > 0) {
      for (const lantern of alive) {
        this.computePosition(lantern, elapsed, this.position);
        this.center.add(this.position);
      }
      this.center.divideScalar(alive.length);
    } else {
      this.center.set(0, THREE.MathUtils.lerp(0, 160, this.params.journey), -20);
    }

    for (const lantern of this.lanterns) {
      const i = lantern.id;
      this.computePosition(lantern, elapsed, this.position);

      if (lantern.ascended) {
        lantern.alpha = THREE.MathUtils.lerp(lantern.alpha, 0, Math.min(1, dt * 4));
      }

      if (!lantern.alive && !lantern.ascended) {
        lantern.deathAge += dt;
        const age = lantern.deathAge;
        lantern.grey = THREE.MathUtils.smoothstep(age, 0.0, 0.55);
        lantern.glow = 1 - THREE.MathUtils.smoothstep(age, 0.0, 0.4);
        lantern.alpha = 1 - THREE.MathUtils.smoothstep(age, 1.7, 3.5);
        lantern.glow *= 1 + Math.max(0, 1 - age * 14) * 4;
      } else if (!lantern.ascended) {
        lantern.grey = Math.max(0, lantern.grey - dt * 2);
        lantern.glow = p.glowBoost;
        lantern.alpha = 1;
      }
      if (lantern.id === this.destinyId && this.destinyT > 1.01) {
        this.winnerGlow = Math.min(1, this.winnerGlow + dt);
        lantern.glow = p.glowBoost * (1 + this.winnerGlow * 2.5);
      }

      const tilt = Math.sin(elapsed * 1.15 + lantern.seed * 21.0) * (0.05 + p.storm * 0.11) +
        (lantern.alive ? 0 : Math.min(1, lantern.deathAge * 0.5) * 0.5);
      const spin = elapsed * (0.16 + lantern.seed * 0.1) + lantern.seed * 6.0;
      this.euler.set(tilt * 0.7, spin, tilt);
      this.quaternion.setFromEuler(this.euler);
      const scale = lantern.scale * (1 + Math.sin(elapsed * 1.1 + lantern.bobPhase) * 0.025);
      this.scaleVec.set(scale, scale, scale);
      this.matrix.compose(this.position, this.quaternion, this.scaleVec);

      this.shell.setMatrixAt(i, this.matrix);
      this.halo.setMatrixAt(i, this.matrix);
      this.flame.setMatrixAt(i, this.matrix);

      this.shellAttrs.glow.setX(i, lantern.glow * lantern.alpha);
      this.shellAttrs.grey.setX(i, lantern.grey);
      this.shellAttrs.alpha.setX(i, lantern.alpha);
      this.haloAttrs.glow.setX(i, lantern.glow);
      this.haloAttrs.grey.setX(i, lantern.grey);
      this.haloAttrs.alpha.setX(i, lantern.alpha);
      this.flameAttrs.glow.setX(i, lantern.glow);
      this.flameAttrs.grey.setX(i, lantern.grey);
      this.flameAttrs.alpha.setX(i, lantern.alpha);

      this.pushHistory(lantern.id, this.position);
    }

    this.shell.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
    this.flame.instanceMatrix.needsUpdate = true;
    this.updateAttributes();
    this.updateEmbers(dt, false);
    this.bloom.update(elapsed, camera);
  }

  private updateAttributes(): void {
    this.shellAttrs.glow.needsUpdate = true;
    this.shellAttrs.grey.needsUpdate = true;
    this.shellAttrs.alpha.needsUpdate = true;
    this.haloAttrs.glow.needsUpdate = true;
    this.haloAttrs.grey.needsUpdate = true;
    this.haloAttrs.alpha.needsUpdate = true;
    this.flameAttrs.glow.needsUpdate = true;
    this.flameAttrs.grey.needsUpdate = true;
    this.flameAttrs.alpha.needsUpdate = true;
  }

  private pushHistory(id: number, pos: THREE.Vector3): void {
    const idx = this.historyIndex[id];
    const base = (id * HISTORY + idx) * 3;
    this.history[base] = pos.x;
    this.history[base + 1] = pos.y;
    this.history[base + 2] = pos.z;
    this.historyIndex[id] = (idx + 1) % HISTORY;
  }

  private updateEmbers(dt: number, initial: boolean): void {
    void dt;
    for (const lantern of this.lanterns) {
      const i = lantern.id;
      const head = this.historyIndex[i];
      const glowFactor = lantern.glow * lantern.alpha * (lantern.ascended ? 0 : 1);
      for (let e = 0; e < EMBERS; e++) {
        const idx = i * EMBERS + e;
        const back = 1 + Math.floor(e * 1.5);
        const histIdx = (head - 1 - back + HISTORY * 2) % HISTORY;
        const base = (i * HISTORY + histIdx) * 3;
        const seed = this.emberSeeds[idx];
        const jitter = 0.12 + (1 - e / EMBERS) * 0.38;
        const px = this.history[base] + Math.sin(seed * 41.0 + back * 1.7) * jitter;
        const py = this.history[base + 1] + Math.cos(seed * 27.0 + back * 1.4) * jitter * 0.7 - (initial ? 0 : 0.15);
        const pz = this.history[base + 2] + Math.cos(seed * 33.0 + back * 1.9) * jitter;
        this.emberPositions[idx * 3] = px;
        this.emberPositions[idx * 3 + 1] = py;
        this.emberPositions[idx * 3 + 2] = pz;
        const fade = 1 - e / EMBERS;
        this.emberAlphas[idx] = glowFactor * fade * 0.75;
        this.emberSizes[idx] = (0.4 + seed * 0.7) * (0.4 + fade * 0.8);
      }
    }
    const geo = this.embers.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aSeed as THREE.BufferAttribute).needsUpdate = true;
  }

  killLantern(id: number, driftAngle?: number): { name: string; position: THREE.Vector3 } | null {
    const lantern = this.lanterns[id];
    if (!lantern || !lantern.alive || lantern.ascended) return null;
    lantern.alive = false;
    lantern.deathAge = 0;
    lantern.deathJourney = this.params.journey;
    lantern.driftAngle = driftAngle ?? Math.random() * Math.PI * 2;
    this.computePosition(lantern, this.params.elapsed, this.position);
    return { name: lantern.student.name, position: this.position.clone() };
  }

  killOthersExcept(protectedId: number): string[] {
    const names: string[] = [];
    const alive = this.lanterns.filter((l) => l.alive && !l.ascended);
    for (const lantern of alive) {
      if (lantern.id !== protectedId) {
        const result = this.killLantern(lantern.id, lantern.id % 2 === 0 ? 0.1 : Math.PI - 0.1);
        if (result) names.push(result.name);
      }
    }
    return names;
  }

  getAliveIds(): number[] {
    return this.lanterns.filter((l) => l.alive && !l.ascended).map((l) => l.id);
  }

  getAliveCount(): number {
    return this.getAliveIds().length;
  }

  getClusterCenter(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.center);
  }

  getLanternPosition(id: number, out: THREE.Vector3): THREE.Vector3 {
    const lantern = this.lanterns[id];
    if (!lantern) return out.set(0, 0, 0);
    this.computePosition(lantern, this.params.elapsed, out);
    return out;
  }

  setDestiny(id: number): void {
    this.destinyId = this.lanterns[id] ? id : -1;
  }

  getStudentName(id: number): string {
    return this.lanterns[id]?.student.name ?? '';
  }

  revealVictory(): void {
    const lantern = this.lanterns[this.destinyId];
    if (lantern) lantern.ascended = true;
    this.bloom.show(this.destinyTarget);
  }

  setBloomTarget(target: THREE.Vector3): void {
    this.destinyTarget.copy(target);
  }
}

class VictoryBloom {
  readonly group = new THREE.Group();

  private readonly petalMaterials: THREE.ShaderMaterial[] = [];
  private readonly rayMaterial: THREE.ShaderMaterial;
  private readonly rayMesh: THREE.Mesh;
  private visibleTarget = 0;
  private shown = false;

  constructor(glowTexture: THREE.Texture) {
    this.group.visible = false;
    this.group.renderOrder = 40;

    const petalGeo = createPetalGeometry();
    const rings = [
      { count: 26, tilt: 1.15, scale: 15.5, opacity: 1.0 },
      { count: 18, tilt: 0.78, scale: 11.0, opacity: 0.95 },
      { count: 12, tilt: 0.4, scale: 6.8, opacity: 0.9 },
    ];

    const seedAttr = new THREE.InstancedBufferAttribute(
      new Float32Array(rings.reduce((acc, r) => acc + r.count, 0)),
      1,
    );
    let seedIndex = 0;

    for (const ring of rings) {
      const material = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        vertexShader: PETAL_VERTEX,
        fragmentShader: PETAL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        toneMapped: false,
      });
      material.userData.targetOpacity = ring.opacity;
      this.petalMaterials.push(material);

      const mesh = new THREE.InstancedMesh(petalGeo, material, ring.count);
      mesh.frustumCulled = false;
      const matrix = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + ring.tilt * 3.0;
        euler.set(ring.tilt, angle, Math.sin(i * 2.7) * 0.12);
        quat.setFromEuler(euler);
        const lengthScale = ring.scale * (0.82 + ((i * 37) % 10) / 32);
        scl.set(lengthScale * 1.15, lengthScale, lengthScale);
        pos.set(0, 0, 0);
        matrix.compose(pos, quat, scl);
        mesh.setMatrixAt(i, matrix);
        seedAttr.setX(seedIndex++, (i * 0.137) % 1);
      }
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    }
    petalGeo.setAttribute('aSeed', seedAttr);

    this.rayMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: RAY_VERTEX,
      fragmentShader: RAY_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.rayMesh = new THREE.Mesh(new THREE.PlaneGeometry(56, 56), this.rayMaterial);
    this.rayMesh.frustumCulled = false;
    this.rayMesh.renderOrder = 41;
    this.group.add(this.rayMesh);

    const coreMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color('#ffcb84'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const core = new THREE.Sprite(coreMat);
    core.scale.setScalar(7.5);
    this.group.add(core);
    this.coreMaterial = coreMat;
  }

  private readonly coreMaterial: THREE.SpriteMaterial;

  show(position: THREE.Vector3): void {
    this.shown = true;
    this.group.position.copy(position);
    this.group.scale.setScalar(0.15);
    this.group.rotation.set(0, 0, 0);
    this.group.visible = true;
    this.visibleTarget = 1;
    this.group.userData.time = 0;
    gsap.killTweensOf(this.group.scale);
    gsap.to(this.group.scale, { x: 1.0, y: 1.0, z: 1.0, duration: 2.6, ease: 'elastic.out(0.7, 0.55)' });
    gsap.to(this.group.rotation, { y: Math.PI * 0.6, duration: 9, ease: 'power1.inOut' });
    for (const material of this.petalMaterials) {
      gsap.to(material.uniforms.uOpacity, {
        value: material.userData.targetOpacity as number,
        duration: 1.2,
        delay: 0.1,
        ease: 'power2.out',
      });
    }
    gsap.to(this.rayMaterial.uniforms.uOpacity, { value: 0.32, duration: 1.6, delay: 0.15 });
    gsap.to(this.coreMaterial, { opacity: 0.55, duration: 1.2, delay: 0.1 });
  }

  hide(): void {
    this.shown = false;
    this.visibleTarget = 0;
    this.group.visible = false;
    for (const material of this.petalMaterials) {
      material.uniforms.uOpacity.value = 0;
    }
    this.rayMaterial.uniforms.uOpacity.value = 0;
    this.coreMaterial.opacity = 0;
  }

  update(elapsed: number, camera: THREE.Camera): void {
    if (!this.shown) return;
    for (const material of this.petalMaterials) material.uniforms.uTime.value = elapsed;
    this.rayMaterial.uniforms.uTime.value = elapsed;
    this.rayMesh.quaternion.copy(camera.quaternion);
    this.coreMaterial.opacity = 0.5 + Math.sin(elapsed * 2.4) * 0.12;
  }
}
