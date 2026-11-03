// src/graphics/SkyWhaleShader.ts

import * as THREE from 'three';

export class SkyWhaleShader {
  public mesh: THREE.Group = new THREE.Group();
  private bodyMesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private angle: number = 0;
  private radius: number = 220;
  private height: number = 90;

  constructor(scene: THREE.Scene) {
    this.createWhaleGeometry();
    scene.add(this.mesh);
  }

  private createWhaleGeometry(): void {
    // 1. Aerodynamic Streamlined Body (Tapered Capsule / Lathe or modified cylinder)
    const segments = 32;
    const length = 45;
    const bodyGeo = new THREE.CylinderGeometry(1.2, 5.0, length, segments, 32);
    // Rotate to align along Z axis
    bodyGeo.rotateX(Math.PI / 2);

    // Deform geometry to shape head, belly and tail
    const pos = bodyGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i); // along body length (-22.5 to 22.5)
      const normZ = (z + length / 2) / length; // 0 to 1

      let radiusScale = 1.0;
      if (normZ > 0.65) {
        // Head tapering
        radiusScale = Math.sin((1.0 - normZ) / 0.35 * Math.PI * 0.5) * 1.2;
      } else {
        // Body to tail tapering
        radiusScale = Math.sin((normZ / 0.65) * Math.PI * 0.5) * 1.35;
      }

      pos.setX(i, pos.getX(i) * radiusScale);
      // Flatten bottom for whale belly
      const currentY = pos.getY(i) * radiusScale;
      pos.setY(i, currentY > 0 ? currentY * 1.1 : currentY * 0.85);
    }
    bodyGeo.computeVertexNormals();

    // 2. Custom Luminous Shinkai Shader with swimming wave vertex displacement
    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      uniform float uTime;

      void main() {
        vUv = uv;
        vec3 transformed = position;

        // Realistic whale undulating swimming wave (tail sways more than head)
        float tailFactor = smoothstep(10.0, -22.0, transformed.z);
        float wave = sin(uTime * 2.2 + transformed.z * 0.12) * tailFactor * 3.8;
        float verticalWave = cos(uTime * 2.2 + transformed.z * 0.12) * tailFactor * 1.4;

        transformed.x += wave;
        transformed.y += verticalWave;

        vec4 worldPos = modelMatrix * vec4(transformed, 1.0);
        vWorldPosition = worldPos.xyz;
        vNormal = normalize(normalMatrix * normal);

        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uColorHead;
      uniform vec3 uColorTail;

      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        // Fresnel rim light for ethereal glowing silhouette
        float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.2);

        // Body gradient from belly/fins to spine
        float pulse = sin(uTime * 1.8 + vUv.x * 10.0) * 0.2 + 0.8;
        vec3 baseColor = mix(uColorHead, uColorTail, vUv.y);

        // Bioluminescent star speckles on skin
        float speckle = sin(vUv.x * 60.0) * sin(vUv.y * 60.0);
        speckle = step(0.92, speckle) * pulse;

        vec3 glow = baseColor + vec3(0.5, 0.8, 1.0) * (fresnel * 1.4 + speckle);
        float alpha = clamp(0.45 + fresnel * 0.55, 0.0, 0.95);

        gl_FragColor = vec4(glow, alpha);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColorHead: { value: new THREE.Color("#4834d4") },
        uColorTail: { value: new THREE.Color("#22a6b3") }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    this.bodyMesh = new THREE.Mesh(bodyGeo, this.material);
    this.mesh.add(this.bodyMesh);

    // 3. Pectoral Fins (Left and Right)
    const finGeo = new THREE.ConeGeometry(3.5, 14, 16);
    finGeo.rotateZ(Math.PI / 2);
    finGeo.scale(0.2, 1.0, 0.8);

    const leftFin = new THREE.Mesh(finGeo, this.material);
    leftFin.position.set(-6, -1, 5);
    leftFin.rotation.set(0.2, 0.4, -0.3);
    this.mesh.add(leftFin);

    const rightFin = new THREE.Mesh(finGeo, this.material);
    rightFin.position.set(6, -1, 5);
    rightFin.rotation.set(0.2, -0.4, 0.3);
    this.mesh.add(rightFin);

    // Initial position
    this.mesh.position.set(0, this.height, -this.radius);
  }

  public update(delta: number, time: number): void {
    if (this.material) {
      this.material.uniforms.uTime.value = time;
    }

    // Majestic slow circular orbit across the night sky
    this.angle += delta * 0.08;
    const x = Math.cos(this.angle) * this.radius;
    const z = Math.sin(this.angle) * this.radius;
    const y = this.height + Math.sin(time * 0.4) * 15;

    this.mesh.position.set(x, y, z);

    // Face forward along trajectory tangent
    const targetAngle = this.angle + Math.PI / 2;
    this.mesh.rotation.y = -targetAngle;
    this.mesh.rotation.z = Math.sin(time * 0.6) * 0.1; // Gentle banking tilt
  }

  public setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
}
