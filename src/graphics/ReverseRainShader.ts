// src/graphics/ReverseRainShader.ts

import * as THREE from 'three';

export class ReverseRainShader {
  public mesh: THREE.Points;
  private material: THREE.ShaderMaterial;
  private count: number = 2200;

  constructor(scene: THREE.Scene) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    const speeds = new Float32Array(this.count);
    const phases = new Float32Array(this.count);
    const sizes = new Float32Array(this.count);
    const colors = new Float32Array(this.count * 3);

    const palette = [
      new THREE.Color("#686de0"), // Soft periwinkle
      new THREE.Color("#e056fd"), // Anime magenta
      new THREE.Color("#f9ca24"), // Gold stardust
      new THREE.Color("#7ed6df"), // Ice cyan
      new THREE.Color("#ffffff")  // Bright white
    ];

    for (let i = 0; i < this.count; i++) {
      // Cylinder distribution around camera
      const radius = 15 + Math.random() * 280;
      const angle = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = -30 + Math.random() * 320; // Y height
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      speeds[i] = 18.0 + Math.random() * 35.0; // Upward speed
      phases[i] = Math.random() * Math.PI * 2;
      sizes[i] = 2.0 + Math.random() * 3.5;

      const col = palette[Math.floor(Math.random() * palette.length)];
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const vertexShader = `
      attribute float speed;
      attribute float phase;
      attribute float size;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uSpeedMultiplier;

      void main() {
        vColor = color;

        vec3 pos = position;
        // Ascending Y position loop
        float totalHeight = 350.0;
        float currentY = pos.y + uTime * speed * uSpeedMultiplier;
        pos.y = mod(currentY + 30.0, totalHeight) - 30.0;

        // Gentle horizontal harmonic drift
        pos.x += sin(uTime * 1.5 + phase) * 2.5;
        pos.z += cos(uTime * 1.2 + phase) * 2.5;

        // Fade in at bottom, bright in middle, fade out at high altitude
        float heightNorm = clamp((pos.y + 30.0) / totalHeight, 0.0, 1.0);
        vAlpha = sin(heightNorm * 3.1415926) * 0.9;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        // Vertical elongation for meteor streak feel
        gl_PointSize = size * (250.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        // Vertical streak shaped particle
        vec2 coord = gl_PointCoord - vec2(0.5);
        coord.x *= 1.8; // stretch vertically
        float dist = length(coord);
        if (dist > 0.5) discard;

        float intensity = smoothstep(0.5, 0.0, dist);
        // High core brightness
        vec3 finalColor = mix(vColor, vec3(1.0), intensity * 0.6);
        gl_FragColor = vec4(finalColor, vAlpha * intensity);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSpeedMultiplier: { value: 1.0 }
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });

    this.mesh = new THREE.Points(geometry, this.material);
    scene.add(this.mesh);
  }

  public update(time: number): void {
    if (this.material) {
      this.material.uniforms.uTime.value = time;
    }
  }

  public setSpeedMultiplier(val: number): void {
    if (this.material) {
      this.material.uniforms.uSpeedMultiplier.value = val;
    }
  }
}
