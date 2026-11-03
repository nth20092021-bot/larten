// src/graphics/SkyLanternManager.ts

import * as THREE from 'three';
import { LanternData, DEFAULT_STUDENT_NAMES, INSPIRATIONAL_WISHES } from '../types/SkyLanternTypes';

export class SkyLanternManager {
  public scene: THREE.Scene;
  public lanterns: LanternData[] = [];
  public lanternMeshes: THREE.Group[] = [];
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouseVec: THREE.Vector2 = new THREE.Vector2();

  // Shared geometry
  private bodyGeometry: THREE.CylinderGeometry;
  private rimGeometry: THREE.TorusGeometry;
  private glowTexture: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Cylinder with slight taper: radiusTop 1.1, radiusBottom 0.85, height 3.0, 16 segments
    this.bodyGeometry = new THREE.CylinderGeometry(1.2, 0.95, 3.2, 16, 1, true);
    this.rimGeometry = new THREE.TorusGeometry(1.22, 0.05, 8, 24);
    this.glowTexture = this.createGlowTexture();

    this.spawnDefault28Lanterns();
    this.spawnBackgroundAtmosphereLanterns(40);
  }

  private createGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 5, 64, 64, 60);
      grad.addColorStop(0, 'rgba(255, 230, 150, 1.0)');
      grad.addColorStop(0.35, 'rgba(255, 140, 50, 0.6)');
      grad.addColorStop(0.7, 'rgba(255, 80, 20, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    return new THREE.CanvasTexture(canvas);
  }

  private createLanternTextTexture(name: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Warm parchment background with lantern paper glow
      const grad = ctx.createLinearGradient(0, 0, 0, 512);
      grad.addColorStop(0, '#fff4d6');
      grad.addColorStop(0.4, '#fed18c');
      grad.addColorStop(0.85, '#f39c12');
      grad.addColorStop(1, '#d35400');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      // Subtle traditional border
      ctx.strokeStyle = 'rgba(180, 60, 10, 0.4)';
      ctx.lineWidth = 6;
      ctx.strokeRect(20, 20, 472, 472);

      // Draw decorative diamond motif
      ctx.fillStyle = 'rgba(211, 84, 0, 0.25)';
      ctx.beginPath();
      ctx.arc(256, 120, 40, 0, Math.PI * 2);
      ctx.fill();

      // Vietnamese calligraphy style name text (front)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#4a1505';
      ctx.font = 'bold 38px "Cormorant Garamond", "Noto Serif Display", serif';
      ctx.shadowColor = 'rgba(255, 240, 180, 0.8)';
      ctx.shadowBlur = 8;
      ctx.fillText(name, 256, 260);

      // Subtitle
      ctx.font = 'italic 20px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = '#7a2e12';
      ctx.shadowBlur = 4;
      ctx.fillText("✦ Bình An & Ước Mơ ✦", 256, 320);

      // Draw subtle warm lantern ribs
      ctx.strokeStyle = 'rgba(211, 84, 0, 0.15)';
      ctx.lineWidth = 3;
      for (let x = 60; x < 512; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, 492);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }

  private createLanternMesh(name: string, isSpecial: boolean = true): THREE.Group {
    const group = new THREE.Group();

    // 1. Lantern Body with Custom Name Texture
    const textTexture = this.createLanternTextTexture(name);
    const bodyMat = new THREE.MeshStandardMaterial({
      map: textTexture,
      roughness: 0.35,
      metalness: 0.1,
      emissive: new THREE.Color(0xff8c3b),
      emissiveIntensity: 0.85,
      side: THREE.DoubleSide
    });

    const body = new THREE.Mesh(this.bodyGeometry, bodyMat);
    group.add(body);

    // 2. Wooden Frame Rims (Top & Bottom)
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x3d1c06,
      roughness: 0.8
    });
    const topRim = new THREE.Mesh(this.rimGeometry, rimMat);
    topRim.rotation.x = Math.PI / 2;
    topRim.position.y = 1.6;
    group.add(topRim);

    const bottomRim = new THREE.Mesh(this.rimGeometry, rimMat);
    bottomRim.rotation.x = Math.PI / 2;
    bottomRim.scale.set(0.8, 0.8, 0.8);
    bottomRim.position.y = -1.6;
    group.add(bottomRim);

    // 3. Inner Candle Flame Core
    const flameGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xfff3a1
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = -0.5;
    group.add(flame);

    // 4. Soft Outer Glow Sprite
    const spriteMat = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffaa44,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.85
    });
    const glowSprite = new THREE.Sprite(spriteMat);
    glowSprite.scale.set(8.5, 8.5, 1);
    group.add(glowSprite);

    // Subtle point light for special lanterns to illuminate nearby atmosphere
    if (isSpecial) {
      const pointLight = new THREE.PointLight(0xff9f43, 1.2, 14);
      pointLight.position.y = 0;
      group.add(pointLight);
    }

    group.userData = { name, isSpecial };
    return group;
  }

  private spawnDefault28Lanterns(): void {
    const total = DEFAULT_STUDENT_NAMES.length;

    DEFAULT_STUDENT_NAMES.forEach((name, index) => {
      // Spiral cylinder distribution in front of camera
      const angle = (index / total) * Math.PI * 4;
      const radius = 22 + (index % 4) * 8 + Math.random() * 6;
      const x = Math.cos(angle) * radius;
      const y = -10 + (index * 4.2) + Math.random() * 5;
      const z = Math.sin(angle) * radius;

      const mesh = this.createLanternMesh(name, true);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.lanternMeshes.push(mesh);

      const wish = INSPIRATIONAL_WISHES[index % INSPIRATIONAL_WISHES.length];

      const data: LanternData = {
        id: `lantern_student_${index}`,
        name,
        wish,
        position: { x, y, z },
        color: "#ff9f43",
        glowColor: "#ff5252",
        speed: 2.5 + Math.random() * 1.5,
        swaySpeed: 0.8 + Math.random() * 0.6,
        swayAmplitude: 0.7 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        rotationSpeed: 0.15 + Math.random() * 0.25,
        mesh,
        isCustom: false
      };

      this.lanterns.push(data);
    });
  }

  private spawnBackgroundAtmosphereLanterns(count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 60 + Math.random() * 180;
      const x = Math.cos(angle) * radius;
      const y = -15 + Math.random() * 160;
      const z = Math.sin(angle) * radius;

      const dummyMesh = new THREE.Group();
      const bodyMat = new THREE.MeshBasicMaterial({
        color: 0xffa502
      });
      const body = new THREE.Mesh(this.bodyGeometry, bodyMat);
      dummyMesh.add(body);

      const spriteMat = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xff7f50,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.7
      });
      const glow = new THREE.Sprite(spriteMat);
      glow.scale.set(6.0, 6.0, 1);
      dummyMesh.add(glow);

      const scale = 0.5 + Math.random() * 0.5;
      dummyMesh.scale.set(scale, scale, scale);
      dummyMesh.position.set(x, y, z);
      this.scene.add(dummyMesh);

      const data: LanternData = {
        id: `lantern_bg_${i}`,
        name: "Đèn Trời Nguyện Cầu",
        wish: "Nguyện cầu bình an, hạnh phúc và vạn sự như ý giữa biển trời đêm.",
        position: { x, y, z },
        color: "#ffa502",
        glowColor: "#ff6348",
        speed: 1.8 + Math.random() * 2.0,
        swaySpeed: 0.6 + Math.random() * 0.5,
        swayAmplitude: 0.5,
        phase: Math.random() * Math.PI * 2,
        rotationSpeed: 0.1 + Math.random() * 0.2,
        mesh: dummyMesh,
        isCustom: false
      };

      this.lanterns.push(data);
    }
  }

  public releaseCustomLantern(name: string, wish: string): LanternData {
    const cleanName = name.trim() || "Người Bạn Phương Xa";
    const cleanWish = wish.trim() || "Ước nguyện bay cao vào bầu trời sao lấp lánh.";

    // Spawn directly in front of camera at lower altitude
    const x = (Math.random() - 0.5) * 8;
    const y = -5;
    const z = 14 + Math.random() * 6;

    const mesh = this.createLanternMesh(cleanName, true);
    mesh.position.set(x, y, z);
    mesh.scale.set(1.2, 1.2, 1.2);
    this.scene.add(mesh);
    this.lanternMeshes.push(mesh);

    const data: LanternData = {
      id: `lantern_custom_${Date.now()}`,
      name: cleanName,
      wish: cleanWish,
      position: { x, y, z },
      color: "#ff6b81",
      glowColor: "#ff4757",
      speed: 4.5, // Faster dramatic ascent for user's own lantern
      swaySpeed: 1.0,
      swayAmplitude: 0.8,
      phase: 0,
      rotationSpeed: 0.35,
      mesh,
      isCustom: true
    };

    this.lanterns.unshift(data);
    return data;
  }

  public update(delta: number, time: number): void {
    const maxY = 220;
    const resetY = -15;

    for (let i = 0; i < this.lanterns.length; i++) {
      const item = this.lanterns[i];
      if (!item.mesh) continue;

      // Vertical ascending movement
      item.mesh.position.y += item.speed * delta;
      if (item.mesh.position.y > maxY) {
        item.mesh.position.y = resetY;
      }

      // Sway motion
      const swayOffset = Math.sin(time * item.swaySpeed + item.phase) * item.swayAmplitude;
      item.mesh.position.x = item.position.x + swayOffset;
      item.mesh.position.z = item.position.z + Math.cos(time * item.swaySpeed * 0.8 + item.phase) * (item.swayAmplitude * 0.5);

      // Slow gentle rotation
      item.mesh.rotation.y += item.rotationSpeed * delta;

      // Slight tilt while swaying
      item.mesh.rotation.z = Math.sin(time * item.swaySpeed + item.phase) * 0.08;
    }
  }

  public checkIntersection(
    normalizedMouseX: number,
    normalizedMouseY: number,
    camera: THREE.Camera
  ): LanternData | null {
    this.mouseVec.set(normalizedMouseX, normalizedMouseY);
    this.raycaster.setFromCamera(this.mouseVec, camera);

    const intersects = this.raycaster.intersectObjects(this.lanternMeshes, true);
    if (intersects.length > 0) {
      let topObj: THREE.Object3D | null = intersects[0].object;
      while (topObj && topObj.parent && topObj.parent !== this.scene) {
        topObj = topObj.parent;
      }
      if (topObj) {
        const found = this.lanterns.find(l => l.mesh === topObj);
        if (found) return found;
      }
    }
    return null;
  }

  public getLanternByName(name: string): LanternData | undefined {
    return this.lanterns.find(l => l.name.toLowerCase() === name.toLowerCase());
  }
}
