// src/core/WeatheringDirector.ts

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import gsap from 'gsap';

import { ShinkaiEnvironment } from '../graphics/ShinkaiEnvironment';
import { ReverseRainShader } from '../graphics/ReverseRainShader';
import { SkyLanternManager } from '../graphics/SkyLanternManager';
import { SkyWhaleShader } from '../graphics/SkyWhaleShader';
import { WeatherLightningSystem } from '../graphics/WeatherLightningSystem';
import { GodRaysPostProcessor } from '../graphics/GodRaysPostProcessor';
import { AnimeSoundEngine } from '../audio/AnimeSoundEngine';
import { ExternalApiService } from '../services/ExternalApiService';
import { CameraViewMode, LanternData, WeatherMode } from '../types/SkyLanternTypes';

export class WeatheringDirector {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;

  // Systems
  public environment: ShinkaiEnvironment;
  public reverseRain: ReverseRainShader;
  public lanternManager: SkyLanternManager;
  public skyWhale: SkyWhaleShader;
  public lightning: WeatherLightningSystem;
  public postProcessor: GodRaysPostProcessor;
  public soundEngine: AnimeSoundEngine;

  // Lights
  private ambientLight: THREE.AmbientLight;
  private moonDirectionalLight: THREE.DirectionalLight;

  // State
  private viewMode: CameraViewMode = 'ORBIT';
  private clock: THREE.Clock = new THREE.Clock();
  private isRunning: boolean = true;
  private focusedLantern: LanternData | null = null;

  constructor(container: HTMLElement) {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0c1326, 0.0018);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      1500
    );
    this.camera.position.set(0, 16, 55);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.12; // Don't dip below water
    this.controls.minDistance = 5;
    this.controls.maxDistance = 250;
    this.controls.target.set(0, 20, 0);

    // 5. Lighting
    this.ambientLight = new THREE.AmbientLight(0x8b6cb0, 0.9);
    this.scene.add(this.ambientLight);

    this.moonDirectionalLight = new THREE.DirectionalLight(0xffe8aa, 1.4);
    this.moonDirectionalLight.position.set(160, 260, -320);
    this.scene.add(this.moonDirectionalLight);

    // 6. Sound Engine
    this.soundEngine = new AnimeSoundEngine();

    // 7. Graphics Systems
    this.environment = new ShinkaiEnvironment(this.scene);
    this.reverseRain = new ReverseRainShader(this.scene);
    this.lanternManager = new SkyLanternManager(this.scene);
    this.skyWhale = new SkyWhaleShader(this.scene);
    this.lightning = new WeatherLightningSystem(this.scene, this.soundEngine);
    this.postProcessor = new GodRaysPostProcessor(this.renderer, this.scene, this.camera);

    // Apply default weather
    this.setWeatherMode('SHINKAI_TWILIGHT');

    // Resize event
    window.addEventListener('resize', this.onResize.bind(this));

    // Start loop
    this.animate();
  }

  public setWeatherMode(mode: WeatherMode): void {
    const config = ExternalApiService.getWeatherPreset(mode);
    this.environment.applyWeatherConfig(config);

    gsap.to(this.ambientLight.color, {
      ...new THREE.Color(config.ambientLightColor),
      duration: 2.0
    });
    this.ambientLight.intensity = config.ambientIntensity;

    gsap.to(this.moonDirectionalLight.color, {
      ...new THREE.Color(config.moonColor),
      duration: 2.0
    });
    this.moonDirectionalLight.intensity = config.moonIntensity;

    this.reverseRain.setSpeedMultiplier(config.reverseRainSpeed);
    this.postProcessor.setBloomIntensity(config.bloomIntensity);
    this.skyWhale.setVisible(config.whaleVisibility);
  }

  public setViewMode(mode: CameraViewMode): void {
    this.viewMode = mode;
    this.focusedLantern = null;

    if (mode === 'CINEMATIC') {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.6;
      gsap.to(this.camera.position, { x: 30, y: 35, z: 65, duration: 2.5, ease: 'power2.inOut' });
      gsap.to(this.controls.target, { x: 0, y: 28, z: 0, duration: 2.5, ease: 'power2.inOut' });
    } else if (mode === 'LOOK_UP') {
      this.controls.autoRotate = false;
      gsap.to(this.camera.position, { x: 0, y: -2, z: 8, duration: 2.0, ease: 'power2.inOut' });
      gsap.to(this.controls.target, { x: 0, y: 80, z: -10, duration: 2.0, ease: 'power2.inOut' });
    } else {
      this.controls.autoRotate = false;
      gsap.to(this.camera.position, { x: 0, y: 16, z: 55, duration: 2.0, ease: 'power2.inOut' });
      gsap.to(this.controls.target, { x: 0, y: 20, z: 0, duration: 2.0, ease: 'power2.inOut' });
    }
  }

  public focusLantern(lantern: LanternData): void {
    if (!lantern.mesh) return;
    this.focusedLantern = lantern;
    this.viewMode = 'FOCUS_LANTERN';
    this.controls.autoRotate = false;

    const targetPos = lantern.mesh.position;
    const camOffset = new THREE.Vector3(0, 1.2, 7.5);

    gsap.to(this.controls.target, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: 1.8,
      ease: 'power2.out'
    });

    gsap.to(this.camera.position, {
      x: targetPos.x + camOffset.x,
      y: targetPos.y + camOffset.y,
      z: targetPos.z + camOffset.z,
      duration: 1.8,
      ease: 'power2.out'
    });

    this.soundEngine.playLanternRelease();
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.postProcessor.setSize(width, height);
  }

  private animate(): void {
    if (!this.isRunning) return;
    requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // Updates
    this.environment.update(delta, elapsedTime);
    this.reverseRain.update(elapsedTime);
    this.lanternManager.update(delta, elapsedTime);
    this.skyWhale.update(delta, elapsedTime);
    this.lightning.update(delta);

    // Follow focused lantern smoothly
    if (this.viewMode === 'FOCUS_LANTERN' && this.focusedLantern && this.focusedLantern.mesh) {
      const pos = this.focusedLantern.mesh.position;
      this.controls.target.lerp(new THREE.Vector3(pos.x, pos.y, pos.z), 0.08);
    }

    this.controls.update();
    this.postProcessor.render(delta);
  }

  public dispose(): void {
    this.isRunning = false;
    window.removeEventListener('resize', this.onResize.bind(this));
    this.soundEngine.dispose();
  }
}
