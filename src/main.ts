// /src/main.ts

import * as THREE from 'three';
import { ExternalApiService } from './services/ExternalApiService';
import { ShinkaiEnvironment } from './graphics/ShinkaiEnvironment';
import { ReverseRainSystem } from './graphics/ReverseRainShader';
import { SkyLanternManager } from './graphics/SkyLanternManager';
import { SkyWhaleFlock } from './graphics/SkyWhaleShader';
import { WeatherLightningSystem } from './graphics/WeatherLightningSystem';
import { GodRaysPostProcessor } from './graphics/GodRaysPostProcessor';
import { AnimeSoundEngine } from './audio/AnimeSoundEngine';
import { MinimalSettingUI } from './ui/MinimalSettingUI';
import { WeatheringDirector } from './core/WeatheringDirector';
import { makeStudents } from './types/SkyLanternTypes';
import { MessengerRedirect } from './utils/MessengerRedirect';

function boot(): void {
  MessengerRedirect.initCheck();
  const container = document.getElementById('app');
  if (!container) throw new Error('Missing #app container');

  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance',
    stencil: false,
  });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x050b14, 1);
  renderer.domElement.style.display = 'block';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 9000);
  camera.position.set(8, 3.2, 26);
  camera.lookAt(0, 10, 0);
  camera.layers.enableAll();

  const service = new ExternalApiService();
  const textures = {
    waterNormal: service.createWaterNormalTexture(512),
    cloudPuff: service.createCloudPuffTexture(512),
    paintedWood: service.createPaintedWoodTexture(512),
    mossStone: service.createMossStoneTexture(512),
  };
  const paperTexture = service.createPaperTexture(1024);
  const glowTexture = service.createGlowTexture(256);

  const environment = new ShinkaiEnvironment(scene, renderer, camera, textures);
  const rain = new ReverseRainSystem(10000);
  scene.add(rain.mesh);
  const whales = new SkyWhaleFlock(glowTexture);
  scene.add(whales.group);
  const lightning = new WeatherLightningSystem(glowTexture);
  scene.add(lightning.group);
  const post = new GodRaysPostProcessor(renderer, scene, camera, environment.sunMesh);
  const audio = new AnimeSoundEngine();

  let director: WeatheringDirector | null = null;

  const ui = new MinimalSettingUI(container, {
    onStart: () => {
      director?.start();
    },
    onReplay: () => {
      director?.replay();
    },
    onCityChange: (cityId) => {
      void loadCity(cityId);
    },
    onRefreshWeather: () => {
      void loadCity(ui.getCityId(), true);
    },
    onSoundToggle: (muted) => {
      audio.setMuted(muted);
    },
    onStudentsChange: () => {
      /* names are applied when a new ritual begins */
    },
    onChosenChange: () => {
      /* applied on the next ritual */
    },
    onAvoidRepeatChange: () => {
      /* applied on the next ritual */
    },
  });

  const lanterns = new SkyLanternManager(makeStudents(ui.getStudents()), paperTexture, glowTexture);
  scene.add(lanterns.group);

  director = new WeatheringDirector({
    camera,
    environment,
    rain,
    lanterns,
    lightning,
    post,
    audio,
    ui,
    onFinished: () => {
      /* the winner card handles the replay action */
    },
  });

  async function loadCity(cityId: string, force = false): Promise<void> {
    const city = service.getCity(cityId);
    ui.setWeatherLoading();
    const weather = await service.getWeather(city, force);
    ui.setWeather(weather, city);
    if (director) {
      director.setWeather(service.weatherToScene(weather));
      if (!director.isRunning) director.applyIdleWeather();
    }
  }

  void loadCity(ui.getCityId());

  void service.tryLoadRemoteWaterNormals().then((texture) => {
    if (texture) environment.setWaterNormalTexture(texture);
  });

  (window as unknown as Record<string, unknown>).__sky = { environment, rain, whales, lanterns, post, audio, ui, director, camera, scene };

  let lastFrame = performance.now();
  let elapsed = 0;
  const whaleFocus = new THREE.Vector3(0, 8, 0);

  const onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height);
    post.setSize(width, height);
    environment.resize(width * ratio, height * ratio);
  };
  window.addEventListener('resize', onResize);
  post.setSize(window.innerWidth, window.innerHeight);

  const render = (): void => {
    requestAnimationFrame(render);
    const now = performance.now();
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    elapsed += dt;

    director?.update(dt, elapsed);
    camera.updateMatrixWorld();
    environment.update(elapsed, dt);
    rain.update(dt, camera, environment.params.windStrength);
    lanterns.update(dt, elapsed, camera);
    if (director) whaleFocus.copy(director.getFocus());
    whales.update(elapsed, whaleFocus, environment.params.storm, lanterns.params.journey);
    lightning.update(dt);
    environment.renderReflection();
    post.render(dt);
  };

  render();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastFrame = performance.now();
  });
}

boot();
