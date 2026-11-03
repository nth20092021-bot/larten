// /src/core/WeatheringDirector.ts

import * as THREE from 'three';
import gsap from 'gsap';
import { ShinkaiEnvironment } from '../graphics/ShinkaiEnvironment';
import { ReverseRainSystem } from '../graphics/ReverseRainShader';
import { SkyLanternManager } from '../graphics/SkyLanternManager';
import { WeatherLightningSystem } from '../graphics/WeatherLightningSystem';
import { GodRaysPostProcessor } from '../graphics/GodRaysPostProcessor';
import { AnimeSoundEngine } from '../audio/AnimeSoundEngine';
import { MinimalSettingUI } from '../ui/MinimalSettingUI';
import { SceneWeather } from '../services/ExternalApiService';
import {
  DEATH_WAVES,
  LANTERN_COUNT,
  RunPhase,
  TIMELINE,
  makeStudents,
} from '../types/SkyLanternTypes';

interface DirectorDeps {
  camera: THREE.PerspectiveCamera;
  environment: ShinkaiEnvironment;
  rain: ReverseRainSystem;
  lanterns: SkyLanternManager;
  lightning: WeatherLightningSystem;
  post: GodRaysPostProcessor;
  audio: AnimeSoundEngine;
  ui: MinimalSettingUI;
  onPhaseChange?: (phase: RunPhase) => void;
  onFinished?: () => void;
}

interface CameraOffsetKey {
  t: number;
  pos: [number, number, number];
  target: [number, number, number];
  fov: number;
  roll: number;
}

const CAMERA_TRACK: CameraOffsetKey[] = [
  { t: 0.0, pos: [10.0, -4.6, 32.0], target: [0.0, 4.2, 0.0], fov: 54, roll: 0 },
  { t: 1.2, pos: [19.0, -4.0, 27.0], target: [0.0, 8.0, -1.0], fov: 55, roll: -1.5 },
  { t: 2.6, pos: [15.0, 4.5, 29.0], target: [0.0, 12.0, -3.0], fov: 55, roll: 2.5 },
  { t: 4.0, pos: [5.0, 7.0, 29.0], target: [0.0, 12.0, -8.0], fov: 52, roll: 4 },
  { t: 6.0, pos: [14.0, 3.0, 27.0], target: [0.0, 12.0, -14.0], fov: 54, roll: -5 },
  { t: 8.0, pos: [21.0, 2.0, 30.0], target: [2.0, 11.0, -18.0], fov: 52, roll: 6 },
  { t: 10.0, pos: [9.0, 2.0, 26.0], target: [-4.0, 10.0, -20.0], fov: 54, roll: -4 },
  { t: 12.0, pos: [-8.0, 3.0, 23.0], target: [2.0, 10.0, -20.0], fov: 54, roll: 3 },
  { t: 12.5, pos: [-5.0, 3.0, 21.0], target: [0.0, 11.0, -20.0], fov: 52, roll: -2 },
  { t: 14.0, pos: [1.0, 2.0, 17.0], target: [0.0, 7.0, -17.0], fov: 48, roll: 1.5 },
  { t: 14.5, pos: [2.0, 2.0, 15.0], target: [0.0, 7.0, -18.0], fov: 46, roll: -3.5 },
  { t: 15.1, pos: [0.0, 1.0, 24.0], target: [0.0, 6.0, -12.0], fov: 50, roll: 1 },
  { t: 15.5, pos: [0.0, -10.0, 64.0], target: [0.0, 2.0, 0.0], fov: 56, roll: 0 },
  { t: 17.2, pos: [0.0, -7.0, 34.0], target: [0.0, -1.0, 0.0], fov: 54, roll: -1 },
  { t: 19.4, pos: [4.5, -5.0, 30.0], target: [0.0, -1.0, 0.0], fov: 52, roll: 0.5 },
];

function smootherstep(v: number): number {
  return v * v * v * (v * (v * 6 - 15) + 10);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class WeatheringDirector {
  private readonly deps: DirectorDeps;
  private running = false;
  private phase: RunPhase = 'idle';
  private runTime = 0;
  private elapsed = 0;
  private timeline: gsap.core.Timeline | null = null;
  private winnerId = -1;
  private winnerName = '';
  private finished = false;
  private shake = 0;
  private readonly focus = new THREE.Vector3(0, 8, 0);
  private readonly pointer = new THREE.Vector2();
  private readonly pointerSmoothed = new THREE.Vector2();
  private readonly samplePos = new THREE.Vector3();
  private readonly sampleTarget = new THREE.Vector3();
  private readonly focusTemp = new THREE.Vector3();
  private sampleFov = 54;
  private sampleRoll = 0;
  private godRaysState = { value: 0 };
  private bloomState = { value: 0.5 };
  private baseWeather: SceneWeather = {
    storm: 0.9,
    cloudCover: 0.8,
    windX: 0.3,
    windZ: 0.1,
    windStrength: 0.7,
    rainRate: 1,
  };
  private lastFov = 0;
  debugTime: number | null = null;

  constructor(deps: DirectorDeps) {
    this.deps = deps;
    window.addEventListener('pointermove', (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      this.pointer.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
    });
  }

  get isRunning(): boolean {
    return this.running;
  }

  getPhase(): RunPhase {
    return this.phase;
  }

  getFocus(): THREE.Vector3 {
    return this.focus;
  }

  setWeather(weather: SceneWeather): void {
    this.baseWeather = weather;
    if (!this.running) this.applyIdleWeather();
  }

  applyIdleWeather(): void {
    const w = this.baseWeather;
    const env = this.deps.environment;
    env.params.storm = THREE.MathUtils.clamp(0.84 + w.storm * 0.13, 0.78, 1.0);
    env.params.cloudCover = THREE.MathUtils.clamp(0.52 + w.cloudCover * 0.36, 0.38, 0.92);
    env.params.sunStrength = 0.03;
    env.params.gap = 0;
    env.params.rainbow = 0;
    env.setWind(w.windX, w.windZ, w.windStrength);
    this.deps.rain.params.reverse = 0;
    this.deps.rain.params.intensity = 1;
    this.deps.rain.params.timeScale = 1;
    this.deps.rain.params.windX = w.windX;
    this.deps.rain.params.windZ = w.windZ;
    this.deps.lanterns.params.journey = 0;
    this.deps.lanterns.params.glowBoost = 1;
    env.params.cloudSea = 0;
    this.deps.post.setGodRays(0);
    this.deps.post.setBloom(0.5);
  }

  start(): boolean {
    if (this.running) return false;
    const { ui, lanterns, environment, rain, post, audio } = this.deps;
    ui.closePanel();
    ui.hideWinner();
    ui.setRunning(true);

    const names = ui.getStudents();
    const students = makeStudents(names);
    this.winnerId = this.pickWinner(names);
    this.winnerName = names[this.winnerId] ?? students[this.winnerId].name;

    lanterns.reset(students, this.winnerId);
    lanterns.setDestiny(this.winnerId);
    lanterns.destinyT = 0;
    lanterns.params.journey = 0;
    lanterns.params.glowBoost = 1;
    lanterns.setBloomTarget(lanterns.destinyTarget);

    this.running = true;
    this.runTime = 0;
    this.finished = false;
    this.shake = 0;
    this.phase = 'awakening';
    this.setPhase('awakening');

    const w = this.baseWeather;
    gsap.killTweensOf(environment.params);
    gsap.killTweensOf(rain.params);
    gsap.killTweensOf(lanterns.params);
    gsap.killTweensOf(this.godRaysState);
    gsap.killTweensOf(this.bloomState);

    environment.params.storm = THREE.MathUtils.clamp(0.86 + w.storm * 0.12, 0.8, 1.0);
    environment.params.cloudCover = THREE.MathUtils.clamp(0.58 + w.cloudCover * 0.34, 0.45, 0.94);
    environment.params.sunStrength = 0.03;
    environment.params.gap = 0;
    environment.params.rainbow = 0;
    environment.params.wake = 0;
    environment.params.wakeRadius = 0;
    environment.params.cloudSea = 0;
    environment.params.flash = 0;
    environment.setWind(w.windX, w.windZ, w.windStrength);

    rain.params.reverse = 0;
    rain.params.timeScale = 1;
    rain.params.intensity = 1;
    rain.params.sparkle = 0.4;
    rain.params.windX = w.windX;
    rain.params.windZ = w.windZ;
    rain.params.storm = environment.params.storm;

    post.setGodRays(0);
    this.godRaysState.value = 0;
    post.setBloom(0.5);
    this.bloomState.value = 0.5;
    this.deps.lightning.clear();

    void audio.init().then(() => {
      audio.setMuted(ui.isMuted());
      audio.setStorm(environment.params.storm);
      audio.setWind(w.windStrength);
      audio.setRainMix(1);
    });

    this.focus.set(0, 7, 0);
    this.buildTimeline();
    return true;
  }

  private pickWinner(names: string[]): number {
    const { ui } = this.deps;
    const chosen = ui.getChosenIndex();
    if (chosen >= 0 && chosen < LANTERN_COUNT) return chosen;
    let candidates = Array.from({ length: LANTERN_COUNT }, (_, i) => i);
    if (ui.getAvoidRepeat()) {
      const used = new Set(ui.getUsedWinners().map((n) => n.trim().toLowerCase()));
      const unused = candidates.filter((i) => !used.has((names[i] ?? '').trim().toLowerCase()));
      if (unused.length > 0) candidates = unused;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private buildTimeline(): void {
    const { environment: env, rain, lanterns, ui } = this.deps;
    this.timeline?.kill();
    const tl = gsap.timeline();
    this.timeline = tl;
    const w = this.baseWeather;

    tl.to(env.params, { storm: THREE.MathUtils.clamp(0.84 + w.storm * 0.14, 0.7, 0.99), duration: 2.4, ease: 'sine.inOut' }, 0);
    tl.to(env.params, { storm: 1.0, duration: 8.0, ease: 'sine.inOut' }, 4.0);
    tl.to(env.params, { storm: 0.0, duration: 0.8, ease: 'power3.in' }, 15.5);

    tl.to(env.params, { cloudCover: THREE.MathUtils.clamp(0.72 + w.cloudCover * 0.28, 0.6, 1), duration: 2.4, ease: 'sine.inOut' }, 0);
    tl.to(env.params, { cloudCover: 1.0, duration: 7.7, ease: 'sine.inOut' }, 4.0);
    tl.to(env.params, { cloudCover: 0.3, duration: 3.4, ease: 'power2.out' }, 15.55);

    tl.to(env.params, { sunStrength: 0.03, duration: 3.0 }, 0);
    tl.to(env.params, { sunStrength: 1.15, duration: 0.45, ease: 'power2.in' }, 15.5);

    tl.to(env.params, { gap: 0.22, duration: 8.0, ease: 'sine.inOut' }, 4.0);
    tl.to(env.params, { gap: 1.0, duration: 0.35, ease: 'power2.in' }, 15.28);
    tl.to(env.params, { gap: 0.0, duration: 2.4, ease: 'power2.out' }, 16.6);

    tl.to(env.params, { rainbow: 1.0, duration: 3.0, ease: 'power2.out' }, 16.0);

    tl.to(env.params, { wake: 1.0, duration: 0.3, ease: 'power2.out' }, 0.05);
    tl.to(env.params, { wakeRadius: 170, duration: 4.4, ease: 'power2.out' }, 0.15);
    tl.to(env.params, { wake: 0.0, duration: 1.7 }, 3.0);
    tl.to(env.params, { cloudSea: 1.0, duration: 1.6, ease: 'sine.out' }, 4.0);
    tl.to(env.params, { cloudSea: 0.82, duration: 2.2, ease: 'sine.inOut' }, 15.45);

    tl.to(rain.params, { reverse: 1.0, duration: 1.8, ease: 'power2.inOut' }, 0.4);
    tl.to(rain.params, { timeScale: 0.035, duration: 0.28, ease: 'power2.out' }, 0.06);
    tl.to(rain.params, { timeScale: 1.1, duration: 1.5, ease: 'power2.in' }, 1.9);
    tl.to(rain.params, { sparkle: 1.0, duration: 1.2 }, 0.5);
    tl.to(rain.params, { intensity: 0.0, duration: 2.0, ease: 'power2.inOut' }, 15.6);

    tl.to(lanterns.params, { journey: 0.32, duration: 4.0, ease: 'power2.out' }, 0);
    tl.to(lanterns.params, { journey: 0.86, duration: 8.5, ease: 'none' }, 4.0);
    tl.to(lanterns.params, { journey: 1.0, duration: 3.0, ease: 'sine.inOut' }, 12.5);
    tl.to(lanterns.params, { glowBoost: 1.9, duration: 0.4, ease: 'power2.out' }, 0.55);
    tl.to(lanterns.params, { glowBoost: 1.18, duration: 2.2, ease: 'sine.inOut' }, 4.0);
    tl.to(lanterns.params, { glowBoost: 1.5, duration: 3.0, ease: 'sine.inOut' }, 12.5);
    tl.to(lanterns.params, { glowBoost: 2.8, duration: 0.25 }, 15.45);

    tl.to(this.godRaysState, { value: 0.55, duration: 2.2, ease: 'power2.out' }, 15.65);
    tl.to(this.bloomState, { value: 0.9, duration: 1.2, ease: 'power2.out' }, 15.5);
    tl.to(this.bloomState, { value: 0.76, duration: 3.0, ease: 'sine.inOut' }, 17.4);

    tl.call(() => this.onAwaken(), [], 0.12);
    tl.call(() => ui.showCaption('I · Trọng lực đảo ngược', 2.6), [], 0.7);
    tl.call(() => ui.showCaption('II · Vượt qua bão giông', 2.8), [], 4.5);
    for (const wave of DEATH_WAVES) {
      tl.call(() => this.deathWave(wave.count), [], wave.at);
    }
    [4.65, 7.05, 9.15, 10.45, 11.65, 13.45, 14.2].forEach((time) => {
      tl.call(() => this.ambientStrike(), [], time);
    });
    tl.call(() => ui.showCaption('III · Khe sáng cuối trời', 2.0), [], 12.65);
    tl.call(() => this.finalSplit(), [], 14.5);
    tl.call(() => this.sunburst(), [], 15.5);
    tl.call(() => this.revealWinnerName(), [], 17.15);
    tl.call(() => ui.showCaption('IV · Bầu trời trở lại', 3.2), [], 17.6);
    tl.call(() => this.finish(), [], TIMELINE.end);
  }

  private onAwaken(): void {
    const { audio, environment } = this.deps;
    audio.startSparkles(7.5);
    audio.setWind(this.baseWeather.windStrength + 0.2);
    environment.params.wake = 1;
    this.shake = 0.18;
  }

  private deathWave(count: number): void {
    if (!this.running || this.phase === 'dawn') return;
    const { lanterns, ui, audio } = this.deps;
    const alive = lanterns.getAliveIds().filter((id) => id !== this.winnerId);
    if (alive.length === 0) return;
    shuffle(alive);
    const victims = alive.slice(0, Math.min(count, alive.length));
    const primaryPos = lanterns.getLanternPosition(victims[0], new THREE.Vector3());
    const names: string[] = [];
    for (const id of victims) {
      const result = lanterns.killLantern(id);
      if (result) names.push(result.name);
    }
    this.strikeNear(primaryPos, 0.95);
    audio.lanternFall();
    if (names.length > 0) ui.showDeath(names[0], lanterns.getAliveCount());
  }

  private ambientStrike(): void {
    if (!this.running || this.phase === 'dawn') return;
    const { lanterns } = this.deps;
    const center = lanterns.getClusterCenter(new THREE.Vector3());
    const target = center.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 46, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 30),
    );
    this.strikeNear(target, 0.75);
  }

  private strikeNear(position: THREE.Vector3, intensity: number): void {
    const { lightning, environment, audio, ui } = this.deps;
    const target = position.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 12),
    );
    lightning.strike(target, intensity);
    const dir = target.clone().sub(this.deps.camera.position).normalize();
    environment.triggerFlash(dir, 1.15 * intensity);
    ui.flashLightning(0.9 * intensity);
    audio.thunder(0.9 * intensity, 0.18 + Math.random() * 0.5);
    this.shake = Math.min(1.5, this.shake + 0.95 * intensity);
  }

  private finalSplit(): void {
    if (!this.running || this.finished) return;
    const { lanterns, ui, audio, lightning, environment } = this.deps;
    const winnerPos = lanterns.getLanternPosition(this.winnerId, new THREE.Vector3());
    const names = lanterns.killOthersExcept(this.winnerId);
    lightning.gust(winnerPos, 1.3);
    audio.thunder(1.0, 0.1);
    audio.lanternFall();
    ui.flashLightning(0.55);
    environment.triggerFlash(
      winnerPos.clone().sub(this.deps.camera.position).normalize(),
      0.7,
    );
    this.shake = 1.05;
    if (names.length > 0) ui.showDeath(names[0], 1);
    gsap.killTweensOf(lanterns);
    gsap.to(lanterns, { destinyT: 1, duration: 1.0, ease: 'power2.inOut' });
    ui.showCaption('Chiếc đèn cuối cùng', 1.9);
  }

  private sunburst(): void {
    if (!this.running) return;
    const { ui, audio, lanterns, post } = this.deps;
    this.setPhase('sunburst');
    lanterns.revealVictory();
    ui.flashGolden();
    audio.climax();
    audio.setRainMix(0.15);
    this.shake = 1.2;
    post.setGodRays(0);
  }

  private revealWinnerName(): void {
    const { ui } = this.deps;
    ui.showWinner(this.winnerName, this.winnerId);
    ui.recordWinner(this.winnerName);
    this.setPhase('dawn');
    this.deps.audio.victoryChime();
    this.focus.copy(this.deps.lanterns.destinyTarget);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.setPhase('dawn');
    this.deps.onFinished?.();
  }

  private setPhase(phase: RunPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.deps.onPhaseChange?.(phase);
  }

  replay(): void {
    const { ui } = this.deps;
    ui.fadeBlack(() => {
      this.resetToIdle();
    });
  }

  private resetToIdle(): void {
    const { lanterns, environment, rain, post, ui, lightning } = this.deps;
    this.timeline?.kill();
    this.timeline = null;
    gsap.killTweensOf(environment.params);
    gsap.killTweensOf(rain.params);
    gsap.killTweensOf(lanterns.params);
    gsap.killTweensOf(lanterns);
    gsap.killTweensOf(this.godRaysState);
    gsap.killTweensOf(this.bloomState);
    lightning.clear();

    this.running = false;
    this.phase = 'idle';
    this.runTime = 0;
    this.finished = false;
    this.shake = 0;
    this.winnerId = -1;
    this.winnerName = '';

    const students = makeStudents(ui.getStudents());
    lanterns.reset(students, -1);
    lanterns.destinyT = 0;
    lanterns.params.journey = 0;
    lanterns.params.glowBoost = 1;
    this.godRaysState.value = 0;
    this.bloomState.value = 0.5;
    post.setGodRays(0);
    post.setBloom(0.5);
    this.applyIdleWeather();
    rain.params.intensity = 1;
    rain.params.reverse = 0;
    rain.params.timeScale = 1;
    rain.params.sparkle = 0.4;
    this.focus.set(0, 7, 0);
    this.pointerSmoothed.set(0, 0);
    ui.hideWinner();
    ui.setRunning(false);
  }

  private updatePhase(): void {
    const t = this.runTime;
    if (t < TIMELINE.storm) this.setPhase('awakening');
    else if (t < TIMELINE.climax) this.setPhase('storm');
    else if (t < TIMELINE.sunburst) this.setPhase('climax');
    else if (t < TIMELINE.finale) this.setPhase('sunburst');
    else this.setPhase('dawn');
  }

  update(dt: number, elapsed: number): void {
    this.elapsed = elapsed;
    const { environment: env, rain, lanterns, post, camera } = this.deps;

    if (this.debugTime !== null) {
      this.runTime = this.debugTime;
    } else if (this.running) {
      this.runTime += dt;
    }
    if (this.running) this.updatePhase();

    const focusTarget = this.focusTemp;
    focusTarget.set(0, 8, 0);
    if (this.running && this.runTime >= TIMELINE.sunburst) {
      focusTarget.copy(lanterns.destinyTarget);
    } else {
      lanterns.getClusterCenter(focusTarget);
    }
    const damp = 1 - Math.exp(-dt * (this.running ? 3.2 : 2.2));
    if (this.debugTime !== null) this.focus.copy(focusTarget);
    else this.focus.lerp(focusTarget, damp);

    let posOffX: number;
    let posOffY: number;
    let posOffZ: number;
    let tgtOffX: number;
    let tgtOffY: number;
    let tgtOffZ: number;

    if (this.running) {
      this.sampleTrack(this.runTime);
      posOffX = this.samplePos.x;
      posOffY = this.samplePos.y;
      posOffZ = this.samplePos.z;
      tgtOffX = this.sampleTarget.x;
      tgtOffY = this.sampleTarget.y;
      tgtOffZ = this.sampleTarget.z;
      if (this.runTime > 19.4) {
        const after = this.runTime - 19.4;
        posOffX += Math.sin(after * 0.12) * 1.8;
        posOffY += Math.cos(after * 0.09) * 0.75;
        this.sampleRoll += Math.sin(after * 0.08) * 0.5;
      }
    } else {
      const idleElapsed = elapsed;
      const angle = 0.33 + Math.sin(idleElapsed * 0.06) * 0.1;
      const radius = 33.0;
      posOffX = Math.sin(angle) * radius;
      posOffY = -4.6 + Math.sin(idleElapsed * 0.22) * 0.25;
      posOffZ = Math.cos(angle) * radius;
      tgtOffX = 0;
      tgtOffY = 4.2;
      tgtOffZ = 0;
      this.sampleFov = 54;
      this.sampleRoll = 0;
    }

    this.pointerSmoothed.lerp(this.pointer, 1 - Math.exp(-dt * 2.8));

    const posX = this.focus.x + posOffX + this.pointerSmoothed.x * 1.5;
    const posY = Math.max(0.85, this.focus.y + posOffY - this.pointerSmoothed.y * 0.9);
    const posZ = this.focus.z + posOffZ;
    let tgtX = this.focus.x + tgtOffX + this.pointerSmoothed.x * 3.0;
    let tgtY = this.focus.y + tgtOffY - this.pointerSmoothed.y * 2.1;
    let tgtZ = this.focus.z + tgtOffZ;

    const storm = env.params.storm;
    const handheld = 0.09 + storm * 0.11 + (this.running ? 0.03 : 0);
    const hx = Math.sin(elapsed * 0.73) * 0.55 + Math.sin(elapsed * 1.91 + 1.4) * 0.3;
    const hy = Math.cos(elapsed * 0.61 + 0.4) * 0.5 + Math.sin(elapsed * 2.27) * 0.22;
    let camX = posX + hx * handheld;
    let camY = posY + hy * handheld * 0.6;
    let camZ = posZ;
    tgtX += hx * handheld * 0.4;
    tgtY += hy * handheld * 0.4;

    this.shake *= Math.exp(-dt * 2.3);
    let shakeRoll = 0;
    if (this.shake > 0.002) {
      const sh = this.shake;
      camX += Math.sin(elapsed * 47.3) * sh * 1.25;
      camY += Math.cos(elapsed * 39.1) * sh * 0.85;
      camZ += Math.sin(elapsed * 35.7 + 2.1) * sh * 0.7;
      tgtX += Math.sin(elapsed * 41.9 + 1.2) * sh * 0.8;
      tgtY += Math.cos(elapsed * 44.6) * sh * 0.6;
      shakeRoll += Math.sin(elapsed * 52.1) * sh * 0.6;
    }

    camera.position.set(camX, camY, camZ);
    camera.lookAt(tgtX, tgtY, tgtZ);
    const rollDeg = this.sampleRoll + Math.sin(elapsed * 0.5) * 0.12 + shakeRoll;
    camera.rotateZ(THREE.MathUtils.degToRad(rollDeg));

    if (Math.abs(camera.fov - this.sampleFov) > 0.01) {
      camera.fov = this.sampleFov;
      camera.updateProjectionMatrix();
      this.lastFov = camera.fov;
    }
    void this.lastFov;

    lanterns.params.storm = env.params.storm;
    lanterns.params.windX = env.params.windX;
    lanterns.params.windZ = env.params.windZ;
    lanterns.params.windStrength = env.params.windStrength;
    rain.params.storm = env.params.storm;
    rain.params.windX = env.params.windX;
    rain.params.windZ = env.params.windZ;

    post.setGodRays(this.godRaysState.value);
    post.setBloom(this.bloomState.value);

    if (this.running && this.phase === 'storm' && Math.random() < dt * 0.18) {
      this.deps.environment.triggerFlash(
        new THREE.Vector3((Math.random() - 0.5), 0.8, -0.6).normalize(),
        0.25,
      );
    }
  }

  private sampleTrack(t: number): void {
    const track = CAMERA_TRACK;
    if (t <= track[0].t) {
      this.samplePos.set(track[0].pos[0], track[0].pos[1], track[0].pos[2]);
      this.sampleTarget.set(track[0].target[0], track[0].target[1], track[0].target[2]);
      this.sampleFov = track[0].fov;
      this.sampleRoll = track[0].roll;
      return;
    }
    const last = track[track.length - 1];
    if (t >= last.t) {
      this.samplePos.set(last.pos[0], last.pos[1], last.pos[2]);
      this.sampleTarget.set(last.target[0], last.target[1], last.target[2]);
      this.sampleFov = last.fov;
      this.sampleRoll = last.roll;
      return;
    }
    let index = 0;
    while (index < track.length - 2 && t > track[index + 1].t) index++;
    const a = track[index];
    const b = track[index + 1];
    const raw = (t - a.t) / (b.t - a.t);
    const k = smootherstep(THREE.MathUtils.clamp(raw, 0, 1));
    this.samplePos.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], k),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], k),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], k),
    );
    this.sampleTarget.set(
      THREE.MathUtils.lerp(a.target[0], b.target[0], k),
      THREE.MathUtils.lerp(a.target[1], b.target[1], k),
      THREE.MathUtils.lerp(a.target[2], b.target[2], k),
    );
    this.sampleFov = THREE.MathUtils.lerp(a.fov, b.fov, k);
    this.sampleRoll = THREE.MathUtils.lerp(a.roll, b.roll, k);
  }

  getWinnerName(): string {
    return this.winnerName;
  }

  getWinnerId(): number {
    return this.winnerId;
  }
}
