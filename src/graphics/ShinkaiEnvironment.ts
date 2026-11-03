// src/graphics/ShinkaiEnvironment.ts

import * as THREE from 'three';
import { WeatherConfig } from '../types/SkyLanternTypes';

export class ShinkaiEnvironment {
  public scene: THREE.Scene;
  private skyDome: THREE.Mesh | null = null;
  private skyMaterial: THREE.ShaderMaterial | null = null;
  private starsParticles: THREE.Points | null = null;
  private starsMaterial: THREE.ShaderMaterial | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private moonGlow: THREE.Sprite | null = null;
  private cloudsGroup: THREE.Group = new THREE.Group();
  private waterMirror: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initSkyDome();
    this.initStars();
    this.initMoon();
    this.initVolumetricClouds();
    this.initReflectiveWater();
  }

  private initSkyDome(): void {
    const geometry = new THREE.SphereGeometry(600, 32, 24);

    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;

      void main() {
        float h = normalize(vWorldPosition + offset).y;
        vec3 col;
        if (h > 0.3) {
          float t = (h - 0.3) / 0.7;
          col = mix(midColor, topColor, pow(t, exponent));
        } else {
          float t = max(0.0, (h + 0.1) / 0.4);
          col = mix(bottomColor, midColor, t);
        }
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        topColor: { value: new THREE.Color("#080e24") },
        midColor: { value: new THREE.Color("#32164c") },
        bottomColor: { value: new THREE.Color("#c85d38") },
        offset: { value: 33 },
        exponent: { value: 0.85 }
      },
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyDome = new THREE.Mesh(geometry, this.skyMaterial);
    this.scene.add(this.skyDome);
  }

  private initStars(): void {
    const count = 3500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);

    const colorChoices = [
      new THREE.Color("#ffffff"),
      new THREE.Color("#c7ecee"),
      new THREE.Color("#f9ca24"),
      new THREE.Color("#dff9fb"),
      new THREE.Color("#e056fd")
    ];

    for (let i = 0; i < count; i++) {
      // Distribute on sphere upper hemisphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.95 + 0.05); // upper dome
      const radius = 550 + Math.random() * 20;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      const color = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;

      sizes[i] = Math.random() * 2.8 + 1.2;
      twinkleSpeeds[i] = Math.random() * 3.0 + 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));

    const starVertex = `
      attribute float size;
      attribute float twinkleSpeed;
      varying vec3 vColor;
      varying float vTwinkle;
      uniform float uTime;

      void main() {
        vColor = color;
        float twinkle = sin(uTime * twinkleSpeed + position.x) * 0.5 + 0.5;
        vTwinkle = twinkle;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * (1.0 + twinkle * 0.6) * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const starFragment = `
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        float alpha = smoothstep(0.5, 0.0, dist) * (0.6 + vTwinkle * 0.4);
        gl_FragColor = vec4(vColor, alpha);
      }
    `;

    this.starsMaterial = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: {
        uTime: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending
    });

    this.starsParticles = new THREE.Points(geometry, this.starsMaterial);
    this.scene.add(this.starsParticles);
  }

  private initMoon(): void {
    const moonGroup = new THREE.Group();
    moonGroup.position.set(160, 260, -320);

    // Glowing disk
    const moonGeo = new THREE.SphereGeometry(24, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({
      color: 0xfff6d6
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonGroup.add(this.moonMesh);

    // Halo Glow Sprite
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(128, 128, 15, 128, 128, 120);
      grad.addColorStop(0, 'rgba(255, 246, 214, 0.9)');
      grad.addColorStop(0.3, 'rgba(255, 220, 160, 0.45)');
      grad.addColorStop(0.7, 'rgba(180, 140, 240, 0.15)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      color: 0xfff0c4,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    this.moonGlow = new THREE.Sprite(spriteMat);
    this.moonGlow.scale.set(160, 160, 1);
    moonGroup.add(this.moonGlow);

    this.scene.add(moonGroup);
  }

  private initVolumetricClouds(): void {
    // Generate soft clouds along horizon using instanced billows
    const cloudGeo = new THREE.SphereGeometry(30, 16, 12);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0x4834d4,
      roughness: 0.9,
      metalness: 0.1,
      transparent: true,
      opacity: 0.38,
      flatShading: true
    });

    const cloudCount = 18;
    for (let i = 0; i < cloudCount; i++) {
      const angle = (i / cloudCount) * Math.PI * 2;
      const dist = 320 + Math.random() * 80;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const y = -10 + Math.sin(i * 1.5) * 20;

      const cluster = new THREE.Group();
      cluster.position.set(x, y, z);

      for (let j = 0; j < 5; j++) {
        const puff = new THREE.Mesh(cloudGeo, cloudMat);
        puff.position.set(
          (Math.random() - 0.5) * 45,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 45
        );
        const scale = 0.8 + Math.random() * 0.9;
        puff.scale.set(scale * 1.6, scale * 0.9, scale * 1.3);
        cluster.add(puff);
      }
      this.cloudsGroup.add(cluster);
    }

    this.scene.add(this.cloudsGroup);
  }

  private initReflectiveWater(): void {
    const waterGeo = new THREE.PlaneGeometry(800, 800, 32, 32);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x070c18,
      roughness: 0.15,
      metalness: 0.85,
      transparent: true,
      opacity: 0.85
    });

    this.waterMirror = new THREE.Mesh(waterGeo, waterMat);
    this.waterMirror.rotation.x = -Math.PI / 2;
    this.waterMirror.position.y = -35;
    this.scene.add(this.waterMirror);
  }

  public update(delta: number, time: number): void {
    if (this.starsMaterial) {
      this.starsMaterial.uniforms.uTime.value = time;
    }
    // Slowly drift clouds
    if (this.cloudsGroup) {
      this.cloudsGroup.rotation.y += delta * 0.015;
    }
  }

  public applyWeatherConfig(config: WeatherConfig): void {
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.topColor.value.set(config.skyTopColor);
      this.skyMaterial.uniforms.midColor.value.set(config.skyMidColor);
      this.skyMaterial.uniforms.bottomColor.value.set(config.skyBottomColor);
    }
    if (this.moonMesh) {
      (this.moonMesh.material as THREE.MeshBasicMaterial).color.set(config.moonColor);
    }
    if (this.moonGlow) {
      this.moonGlow.material.color.set(config.moonColor);
    }
  }
}
