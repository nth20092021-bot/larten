// src/graphics/GodRaysPostProcessor.ts

import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect } from 'postprocessing';

export class GodRaysPostProcessor {
  private composer: EffectComposer | null = null;
  private bloomEffect: BloomEffect | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private isEnabled: boolean = true;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    try {
      this.initComposer();
    } catch (err) {
      console.warn('Postprocessing fallback to standard WebGL:', err);
      this.isEnabled = false;
    }
  }

  private initComposer(): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomEffect = new BloomEffect({
      luminanceThreshold: 0.2,
      luminanceSmoothing: 0.35,
      intensity: 1.4,
      mipmapBlur: true
    });

    const vignetteEffect = new VignetteEffect({
      offset: 0.3,
      darkness: 0.45
    });

    const effectPass = new EffectPass(this.camera, this.bloomEffect, vignetteEffect);
    this.composer.addPass(effectPass);
  }

  public setBloomIntensity(val: number): void {
    if (this.bloomEffect) {
      this.bloomEffect.intensity = val;
    }
  }

  public render(delta: number): void {
    if (this.isEnabled && this.composer) {
      this.composer.render(delta);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setSize(width: number, height: number): void {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }
}
