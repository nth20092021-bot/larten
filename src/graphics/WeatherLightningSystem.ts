// /src/graphics/WeatherLightningSystem.ts

import * as THREE from 'three';

class PolylineCurve extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly points: THREE.Vector3[]) {
    super();
  }

  getPoint(t: number, optionalTarget = new THREE.Vector3()): THREE.Vector3 {
    const total = this.points.length - 1;
    const pos = THREE.MathUtils.clamp(t, 0, 0.99999) * total;
    const index = Math.floor(pos);
    const f = pos - index;
    return optionalTarget.copy(this.points[index]).lerp(this.points[index + 1], f);
  }
}

interface ActiveBolt {
  group: THREE.Group;
  materials: THREE.MeshBasicMaterial[];
  flashSprite: THREE.Sprite;
  flashMaterial: THREE.SpriteMaterial;
  life: number;
  duration: number;
  seed: number;
}

interface ActiveGust {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  duration: number;
  grow: number;
  spin: THREE.Vector3;
}

function makeBoltPoints(start: THREE.Vector3, end: THREE.Vector3, steps: number, spread: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = start.clone().lerp(end, t);
    const envelope = Math.sin(t * Math.PI);
    const jitter = spread * envelope;
    p.x += (Math.random() - 0.5) * jitter * 2;
    p.z += (Math.random() - 0.5) * jitter * 2;
    p.y += (Math.random() - 0.5) * jitter * 0.55;
    points.push(p);
  }
  return points;
}

export class WeatherLightningSystem {
  readonly group = new THREE.Group();
  private readonly bolts: ActiveBolt[] = [];
  private readonly gusts: ActiveGust[] = [];
  private readonly glowTexture?: THREE.Texture;

  constructor(glowTexture?: THREE.Texture) {
    this.glowTexture = glowTexture;
  }

  strike(target: THREE.Vector3, intensity = 1): THREE.Vector3 {
    const group = new THREE.Group();
    const materials: THREE.MeshBasicMaterial[] = [];
    const start = target.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 46, 56 + Math.random() * 52, (Math.random() - 0.5) * 40),
    );

    const mainPoints = makeBoltPoints(start, target, 26, 4.6);
    const mainCurve = new PolylineCurve(mainPoints);
    const branches: { curve: PolylineCurve; radius: number }[] = [];

    const branchCount = 3 + Math.floor(Math.random() * 3);
    for (let b = 0; b < branchCount; b++) {
      const anchorIndex = 3 + Math.floor(Math.random() * (mainPoints.length - 6));
      const anchor = mainPoints[anchorIndex].clone();
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        -0.35 - Math.random() * 0.8,
        (Math.random() - 0.5) * 2,
      ).normalize();
      const len = 12 + Math.random() * 26;
      const branchEnd = anchor.clone().addScaledVector(dir, len);
      const points = makeBoltPoints(anchor, branchEnd, 10, 2.2);
      branches.push({ curve: new PolylineCurve(points), radius: 0.022 + Math.random() * 0.03 });
    }

    const makeTube = (curve: THREE.Curve<THREE.Vector3>, radius: number, outer: boolean): THREE.Mesh => {
      const geo = new THREE.TubeGeometry(curve, outer ? 40 : 96, radius * (outer ? 2.2 : 1), outer ? 5 : 6, false);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(outer ? '#5f8dff' : '#e8f3ff').multiplyScalar(outer ? 1.3 : 3.4),
        transparent: true,
        opacity: outer ? 0.055 : 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      mat.userData.baseOpacity = outer ? 0.07 : 1;
      materials.push(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 60;
      return mesh;
    };

    group.add(makeTube(mainCurve, 0.045 + Math.random() * 0.03, false));
    group.add(makeTube(mainCurve, 0.075, true));
    for (const branch of branches) {
      group.add(makeTube(branch.curve, branch.radius, false));
    }

    const flashMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: new THREE.Color('#cfe2ff'),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const flashSprite = new THREE.Sprite(flashMaterial);
    flashSprite.position.copy(start).lerp(target, 0.32);
    flashSprite.scale.setScalar(20 + Math.random() * 14);
    group.add(flashSprite);

    this.group.add(group);
    this.bolts.push({
      group,
      materials,
      flashSprite,
      flashMaterial,
      life: 0,
      duration: 0.36 + Math.random() * 0.3 + intensity * 0.08,
      seed: Math.random() * 100,
    });
    return start;
  }

  gust(target: THREE.Vector3, intensity = 1): void {
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const radius = 8 + Math.random() * 10 + intensity * 4;
      const geo = new THREE.TorusGeometry(radius, 0.2 + Math.random() * 0.16, 3, 96, Math.PI * (1.1 + Math.random() * 0.6));
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color('#bfe4ff').multiplyScalar(2.1),
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.copy(target).add(
        new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 8),
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      mesh.renderOrder = 55;
      this.group.add(mesh);
      this.gusts.push({
        mesh,
        material,
        life: 0,
        duration: 0.65 + Math.random() * 0.25,
        grow: 1.8 + Math.random() * 1.1,
        spin: new THREE.Vector3(
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5,
          (Math.random() - 0.5) * 2.5,
        ),
      });
    }
  }

  update(dt: number): void {
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const bolt = this.bolts[i];
      bolt.life += dt;
      const k = bolt.life / bolt.duration;
      if (k >= 1) {
        this.group.remove(bolt.group);
        bolt.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) obj.geometry.dispose();
        });
        for (const mat of bolt.materials) mat.dispose();
        bolt.flashMaterial.dispose();
        this.bolts.splice(i, 1);
        continue;
      }
      const flicker = 0.55 + 0.45 * Math.abs(Math.sin(bolt.life * 70 + bolt.seed));
      const fade = 1 - k * k;
      for (const mat of bolt.materials) {
        const base = (mat.userData.baseOpacity as number) ?? 1;
        mat.opacity = base * flicker * fade;
      }
      bolt.flashMaterial.opacity = 0.85 * Math.pow(1 - k, 2.5) * flicker;
    }

    for (let i = this.gusts.length - 1; i >= 0; i--) {
      const gust = this.gusts[i];
      gust.life += dt;
      const k = gust.life / gust.duration;
      if (k >= 1) {
        this.group.remove(gust.mesh);
        gust.mesh.geometry.dispose();
        gust.material.dispose();
        this.gusts.splice(i, 1);
        continue;
      }
      const ease = 1 - Math.pow(1 - k, 3);
      gust.mesh.scale.setScalar(0.7 + ease * gust.grow);
      gust.mesh.rotation.x += gust.spin.x * dt;
      gust.mesh.rotation.y += gust.spin.y * dt;
      gust.mesh.rotation.z += gust.spin.z * dt;
      gust.material.opacity = 0.5 * (1 - k) * (1 - k);
    }
  }

  clear(): void {
    for (const bolt of this.bolts) {
      this.group.remove(bolt.group);
      bolt.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose();
      });
      for (const mat of bolt.materials) mat.dispose();
      bolt.flashMaterial.dispose();
    }
    this.bolts.length = 0;
    for (const gust of this.gusts) {
      this.group.remove(gust.mesh);
      gust.mesh.geometry.dispose();
      gust.material.dispose();
    }
    this.gusts.length = 0;
  }
}
