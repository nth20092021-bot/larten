// /src/graphics/SkyWhaleShader.ts

import * as THREE from 'three';

const WHALE_VERTEX = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uPhase;

varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec2 vUv;

void main() {
  vLocal = position;
  vUv = uv;
  vec3 transformed = position;

  float tailT = smoothstep(6.0, -26.0, position.x);
  float swim = sin(position.x * 0.155 + uTime * 1.15 + uPhase) * tailT * tailT;
  transformed.z += swim * 2.8;
  transformed.y += sin(position.x * 0.11 + uTime * 0.9 + uPhase) * tailT * 0.55;

  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const WHALE_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uPhase;
uniform float uStorm;
uniform float uOpacity;

varying vec3 vLocal;
varying vec3 vNormalW;
varying vec3 vWorld;
varying vec2 vUv;

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
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v / 0.9375;
}

void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);

  float clouds = fbm(vLocal.xy * 0.09 + vec2(uTime * 0.04, uTime * 0.025) + uPhase);
  clouds = smoothstep(0.25, 0.85, clouds);

  float veins = fbm(vec2(vUv.x * 26.0 + uTime * 0.08, vUv.y * 9.0));
  float stripes = smoothstep(0.58, 0.66, sin(vUv.y * 3.14159 * 6.0 + veins * 2.0)) * 0.12;

  vec2 dotCell = floor(vec2(vUv.x * 52.0, vUv.y * 30.0));
  float dotHash = hash21(dotCell);
  vec2 dotF = fract(vec2(vUv.x * 52.0, vUv.y * 30.0)) - 0.5;
  float bio = smoothstep(0.075, 0.012, length(dotF)) * step(0.78, dotHash);
  bio *= 0.5 + 0.5 * sin(uTime * 2.0 + dotHash * 30.0 + vUv.x * 10.0);

  vec3 deep = vec3(0.008, 0.045, 0.06);
  vec3 pale = vec3(0.06, 0.24, 0.3);
  vec3 teal = vec3(0.32, 0.98, 0.84);

  vec3 base = mix(deep, pale, clouds * 0.55);
  base += pale * stripes * 0.6;
  base += teal * bio * 1.0;
  base += vec3(0.2, 0.86, 0.78) * pow(fres, 2.2) * 1.0;

  float alpha = clamp(0.22 + fres * 0.35 + clouds * 0.08 + bio * 0.15, 0.0, 0.8);
  alpha *= uOpacity;
  alpha *= 1.0 - uStorm * 0.18;

  vec3 color = base * (1.0 + fres * 0.4);
  color += vec3(0.2, 0.5, 0.6) * uStorm * 0.1;
  gl_FragColor = vec4(color, alpha);
}
`;

function whaleProfile(t: number): number {
  const keys: [number, number][] = [
    [0, 0.32],
    [0.08, 1.1],
    [0.2, 3.4],
    [0.36, 5.9],
    [0.52, 7.0],
    [0.68, 6.6],
    [0.84, 4.9],
    [0.94, 3.1],
    [1, 0.45],
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, r0] = keys[i];
    const [t1, r1] = keys[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0);
      const s = k * k * (3 - 2 * k);
      return r0 + (r1 - r0) * s;
    }
  }
  return 0.4;
}

function createWhaleBodyGeometry(): THREE.BufferGeometry {
  const segX = 78;
  const segZ = 30;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const length = 52;

  for (let i = 0; i <= segX; i++) {
    const t = i / segX;
    const x = -length * 0.5 + t * length;
    const r = whaleProfile(t);
    for (let j = 0; j <= segZ; j++) {
      const a = (j / segZ) * Math.PI * 2;
      const belly = 1 - 0.12 * Math.max(0, -Math.cos(a));
      positions.push(x, Math.sin(a) * r * 0.82 * belly, Math.cos(a) * r);
      uvs.push(t, j / segZ);
    }
  }
  for (let i = 0; i < segX; i++) {
    for (let j = 0; j < segZ; j++) {
      const a = i * (segZ + 1) + j;
      const b = a + segZ + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

interface WhaleRuntime {
  group: THREE.Group;
  materials: THREE.ShaderMaterial[];
  sparkles: THREE.Points;
  sparkleMaterial: THREE.PointsMaterial;
  phase: number;
  scale: number;
  bankSeed: number;
  orbitSpeed: number;
  orbitRadius: number;
  heightOffset: number;
  initialAngle: number;
}

export class SkyWhaleFlock {
  private static readonly WORLD_UP = new THREE.Vector3(0, 1, 0);

  readonly group = new THREE.Group();
  private readonly whales: WhaleRuntime[] = [];
  private readonly bodyGeometry = createWhaleBodyGeometry();
  private readonly tmpNext = new THREE.Vector3();
  private readonly forwardAxis = new THREE.Vector3(1, 0, 0);
  private readonly glowTexture?: THREE.Texture;

  constructor(glowTexture?: THREE.Texture) {
    this.glowTexture = glowTexture;
    this.createWhale(0, 0.82, 0);
    this.createWhale(1, 0.46, 2.7);
    this.group.renderOrder = 8;
  }

  private createWhale(index: number, scale: number, phase: number): void {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: phase },
        uStorm: { value: 0.9 },
        uOpacity: { value: 0.85 },
      },
      vertexShader: WHALE_VERTEX,
      fragmentShader: WHALE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      toneMapped: false,
    });

    const body = new THREE.Mesh(this.bodyGeometry, bodyMaterial);
    body.frustumCulled = false;
    group.add(body);

    const finMaterial = bodyMaterial.clone();
    finMaterial.uniforms = THREE.UniformsUtils.clone(bodyMaterial.uniforms);
    finMaterial.uniforms.uPhase.value = phase + 0.4;
    finMaterial.transparent = true;
    finMaterial.depthWrite = false;
    finMaterial.side = THREE.FrontSide;
    finMaterial.toneMapped = false;

    const finGeo = new THREE.SphereGeometry(1, 22, 14);
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, finMaterial);
      fin.position.set(12.5, -3.4, side * 4.0);
      fin.scale.set(5.9, 0.4, 1.7);
      fin.rotation.z = -0.62;
      fin.rotation.y = side * 0.82;
      fin.rotation.x = side * 0.3;
      fin.frustumCulled = false;
      group.add(fin);
    }

    const flukeMaterial = bodyMaterial.clone();
    flukeMaterial.uniforms = THREE.UniformsUtils.clone(bodyMaterial.uniforms);
    flukeMaterial.uniforms.uPhase.value = phase + 0.7;
    flukeMaterial.transparent = true;
    flukeMaterial.depthWrite = false;
    flukeMaterial.side = THREE.FrontSide;
    flukeMaterial.toneMapped = false;

    for (const side of [-1, 1]) {
      const fluke = new THREE.Mesh(finGeo, flukeMaterial);
      fluke.position.set(-27.2, 0, side * 3.4);
      fluke.scale.set(3.4, 0.3, 3.4);
      fluke.rotation.y = side * 0.5;
      fluke.rotation.z = -0.16;
      fluke.frustumCulled = false;
      group.add(fluke);
    }

    const dorsal = new THREE.Mesh(finGeo, flukeMaterial);
    dorsal.position.set(-6, 4.9, 0);
    dorsal.scale.set(2.6, 1.5, 0.36);
    dorsal.rotation.z = 0.3;
    dorsal.frustumCulled = false;
    group.add(dorsal);

    const sparkleCount = 170;
    const sparklePositions = new Float32Array(sparkleCount * 3);
    for (let i = 0; i < sparkleCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      sparklePositions[i * 3] = (Math.random() - 0.5) * 58;
      sparklePositions[i * 3 + 1] = Math.sin(a) * r * 13;
      sparklePositions[i * 3 + 2] = Math.cos(a) * r * 20;
    }
    const sparkleGeo = new THREE.BufferGeometry();
    sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3));
    const sparkleMaterial = new THREE.PointsMaterial({
      color: new THREE.Color('#8ffbe4'),
      size: 0.34,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      map: this.glowTexture,
      toneMapped: false,
    });
    const sparkles = new THREE.Points(sparkleGeo, sparkleMaterial);
    sparkles.frustumCulled = false;
    group.add(sparkles);

    group.scale.setScalar(scale);
    this.group.add(group);
    this.whales.push({
      group,
      materials: [bodyMaterial, finMaterial, flukeMaterial],
      sparkles,
      sparkleMaterial,
      phase,
      scale,
      bankSeed: index * 3.1 + 1.2,
      orbitSpeed: index === 0 ? 0.085 : 0.06,
      orbitRadius: index === 0 ? 96 : 138,
      heightOffset: index === 0 ? 24 : 6,
      initialAngle: index === 0 ? 0.6 : 3.6,
    });
  }

  private computeTarget(out: THREE.Vector3, whale: WhaleRuntime, elapsed: number, center: THREE.Vector3): void {
    const angle = elapsed * whale.orbitSpeed + whale.initialAngle;
    const wobble = 1 + Math.sin(elapsed * 0.23 + whale.phase) * 0.12;
    out.set(
      center.x + Math.cos(angle) * whale.orbitRadius * wobble,
      center.y + whale.heightOffset + Math.sin(elapsed * 0.34 + whale.phase) * 3.5,
      center.z + Math.sin(angle) * whale.orbitRadius * 0.82 * wobble,
    );
  }

  update(elapsed: number, center: THREE.Vector3, storm: number, journey: number): void {
    for (const whale of this.whales) {
      this.computeTarget(whale.group.position, whale, elapsed, center);
      this.computeTarget(this.tmpNext, whale, elapsed + 0.08, center);
      const dir = this.tmpNext.clone().sub(whale.group.position).normalize();
      if (dir.lengthSq() < 0.0001) dir.set(1, 0, 0);
      const right = new THREE.Vector3().crossVectors(dir, SkyWhaleFlock.WORLD_UP);
      if (right.lengthSq() < 1e-6) right.set(0, 0, 1);
      right.normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      const basis = new THREE.Matrix4().makeBasis(dir, up, right);
      const quat = new THREE.Quaternion().setFromRotationMatrix(basis);
      const bank = Math.sin(elapsed * 0.5 + whale.bankSeed) * 0.22 + storm * 0.05;
      const roll = new THREE.Quaternion().setFromAxisAngle(this.forwardAxis, bank);
      quat.multiply(roll);
      whale.group.quaternion.slerp(quat, 0.06);

      whale.group.position.y += Math.sin(elapsed * 0.7 + whale.phase) * 0.8;
      whale.group.scale.setScalar(whale.scale * (1 + journey * 0.08));

      for (const mat of whale.materials) {
        mat.uniforms.uTime.value = elapsed;
        mat.uniforms.uStorm.value = storm;
      }
      whale.sparkles.rotation.x = elapsed * 0.03;
      whale.sparkles.rotation.y = -elapsed * 0.045;
      whale.sparkleMaterial.opacity = 0.2 + 0.2 * (1 - storm) + 0.06 * Math.sin(elapsed * 1.3);
    }
  }
}
