// src/graphics/WeatherLightningSystem.ts

import * as THREE from 'three';
import { AnimeSoundEngine } from '../audio/AnimeSoundEngine';

export class WeatherLightningSystem {
  private scene: THREE.Scene;
  private flashLight: THREE.DirectionalLight;
  private soundEngine: AnimeSoundEngine | null = null;
  private nextFlashTime: number = 0;
  private isFlashing: boolean = false;
  private flashDuration: number = 0;
  private flashTimer: number = 0;

  constructor(scene: THREE.Scene, soundEngine?: AnimeSoundEngine) {
    this.scene = scene;
    this.soundEngine = soundEngine || null;

    // Atmospheric sheet lightning light
    this.flashLight = new THREE.DirectionalLight(0x9980fa, 0);
    this.flashLight.position.set(-150, 200, -250);
    this.scene.add(this.flashLight);

    this.scheduleNextFlash();
  }

  private scheduleNextFlash(): void {
    // Random interval between 12 and 28 seconds
    this.nextFlashTime = 12 + Math.random() * 16;
  }

  public triggerManualFlash(): void {
    this.isFlashing = true;
    this.flashDuration = 0.35;
    this.flashTimer = 0;
    this.flashLight.intensity = 3.2;

    if (this.soundEngine) {
      setTimeout(() => {
        this.soundEngine?.playDistantThunder();
      }, 700);
    }
  }

  public update(delta: number): void {
    if (this.isFlashing) {
      this.flashTimer += delta;
      if (this.flashTimer < this.flashDuration) {
        // Double-flicker lightning characteristic
        const flicker = Math.sin(this.flashTimer * 35.0) > 0 ? 2.8 : 0.8;
        this.flashLight.intensity = flicker * (1.0 - this.flashTimer / this.flashDuration);
      } else {
        this.isFlashing = false;
        this.flashLight.intensity = 0;
        this.scheduleNextFlash();
      }
    } else {
      this.nextFlashTime -= delta;
      if (this.nextFlashTime <= 0) {
        this.triggerManualFlash();
      }
    }
  }
}
