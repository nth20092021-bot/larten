// /src/services/ExternalApiService.ts

import * as THREE from 'three';
import { CITIES, CityPreset, WeatherSnapshot } from '../types/SkyLanternTypes';

const WEATHER_TTL = 5 * 60 * 1000;
const REMOTE_WATER_NORMALS =
  'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/waternormals.jpg';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function describeSky(cloudCover: number, precipitation: number): string {
  if (precipitation > 2.4) return 'Mưa giông';
  if (precipitation > 0.25) return 'Mưa nhẹ';
  if (cloudCover > 78) return 'Mây dày';
  if (cloudCover > 45) return 'Mây rải';
  if (cloudCover > 18) return 'Ít mây';
  return 'Trời quang';
}

export interface SceneWeather {
  storm: number;
  cloudCover: number;
  windX: number;
  windZ: number;
  windStrength: number;
  rainRate: number;
}

export class ExternalApiService {
  private cache = new Map<string, { at: number; data: WeatherSnapshot }>();
  private memoryCache = new Map<string, THREE.Texture>();

  getCity(id: string): CityPreset {
    return CITIES.find((c) => c.id === id) ?? CITIES[0];
  }

  async getWeather(city: CityPreset, force = false): Promise<WeatherSnapshot> {
    const cached = this.cache.get(city.id);
    if (!force && cached && Date.now() - cached.at < WEATHER_TTL) return cached.data;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${city.latitude.toFixed(4)}&longitude=${city.longitude.toFixed(4)}` +
      '&current=temperature_2m,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m,is_day' +
      '&wind_speed_unit=kmh&timezone=auto';

    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);
      const data = await response.json() as {
        current?: {
          temperature_2m?: number;
          precipitation?: number;
          cloud_cover?: number;
          wind_speed_10m?: number;
          wind_direction_10m?: number;
          is_day?: number;
        };
      };
      const c = data.current;
      if (!c || typeof c.temperature_2m !== 'number' || typeof c.cloud_cover !== 'number') {
        throw new Error('Open-Meteo payload incomplete');
      }
      const snapshot: WeatherSnapshot = {
        cityId: city.id,
        temperature: c.temperature_2m,
        precipitation: Math.max(0, c.precipitation ?? 0),
        cloudCover: clamp(c.cloud_cover ?? 50, 0, 100),
        windSpeed: Math.max(0, c.wind_speed_10m ?? 8),
        windDirection: ((c.wind_direction_10m ?? 180) % 360 + 360) % 360,
        isDay: (c.is_day ?? 0) === 1,
        source: 'live',
        fetchedAt: Date.now(),
        condition: describeSky(c.cloud_cover ?? 50, c.precipitation ?? 0),
      };
      this.cache.set(city.id, { at: Date.now(), data: snapshot });
      return snapshot;
    } catch {
      const snapshot: WeatherSnapshot = {
        cityId: city.id,
        temperature: city.fallback.temperature,
        precipitation: city.fallback.precipitation,
        cloudCover: city.fallback.cloudCover,
        windSpeed: city.fallback.windSpeed,
        windDirection: city.fallback.windDirection,
        isDay: city.fallback.isDay === 1,
        source: 'fallback',
        fetchedAt: Date.now(),
        condition: describeSky(city.fallback.cloudCover, city.fallback.precipitation),
      };
      this.cache.set(city.id, { at: Date.now(), data: snapshot });
      return snapshot;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  weatherToScene(weather: WeatherSnapshot): SceneWeather {
    const storm = clamp(0.3 + (weather.cloudCover / 100) * 0.55 + Math.min(weather.precipitation, 12) * 0.025, 0.32, 1);
    const rad = (weather.windDirection * Math.PI) / 180;
    const windStrength = clamp(weather.windSpeed / 30, 0.12, 1.75);
    return {
      storm,
      cloudCover: clamp(weather.cloudCover / 100, 0.08, 1),
      windX: -Math.sin(rad) * windStrength,
      windZ: Math.cos(rad) * windStrength,
      windStrength,
      rainRate: 0.8 + Math.min(weather.precipitation, 8) * 0.12,
    };
  }

  async tryLoadRemoteWaterNormals(): Promise<THREE.Texture | null> {
    const cached = this.memoryCache.get('water-normals-remote');
    if (cached) return cached;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    const timeoutPromise = new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 4200));
    const loadPromise = new Promise<THREE.Texture | null>((resolve) => {
      loader.load(
        REMOTE_WATER_NORMALS,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(9, 9);
          texture.colorSpace = THREE.NoColorSpace;
          resolve(texture);
        },
        undefined,
        () => resolve(null),
      );
    });
    const result = await Promise.race([loadPromise, timeoutPromise]);
    if (result) this.memoryCache.set('water-normals-remote', result);
    return result;
  }

  createWaterNormalTexture(size = 512): THREE.DataTexture {
    const data = new Uint8Array(size * size * 4);
    const waves = [
      { ax: 2, ay: 1, amp: 0.55, phase: 0.3 },
      { ax: 1, ay: 3, amp: 0.42, phase: 1.7 },
      { ax: 5, ay: -2, amp: 0.26, phase: 0.9 },
      { ax: -3, ay: 4, amp: 0.2, phase: 2.4 },
      { ax: 7, ay: 5, amp: 0.13, phase: 4.1 },
      { ax: -6, ay: 9, amp: 0.08, phase: 5.2 },
      { ax: 13, ay: -7, amp: 0.05, phase: 3.3 },
    ];
    const height = (x: number, y: number): number => {
      let h = 0;
      for (const w of waves) h += Math.sin(x * w.ax + y * w.ay + w.phase) * w.amp;
      return h;
    };
    const step = (Math.PI * 2) / size;
    const strength = 2.6;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const px = x * step;
        const py = y * step;
        const dx = height(px + 0.02, py) - height(px - 0.02, py);
        const dy = height(px, py + 0.02) - height(px, py - 0.02);
        const nx = -dx * strength;
        const ny = -dy * strength;
        const nz = 1;
        const len = Math.hypot(nx, ny, nz);
        const i = (y * size + x) * 4;
        data[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
        data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
        data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
        data[i + 3] = 255;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(9, 9);
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  createPaperTexture(size = 1024): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const rand = mulberry32(918273);
    ctx.fillStyle = '#f4e4c5';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2600; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 8 + rand() * 90;
      const alpha = 0.02 + rand() * 0.05;
      ctx.strokeStyle = rand() > 0.55 ? `rgba(120, 92, 54, ${alpha})` : `rgba(255, 252, 244, ${alpha * 1.6})`;
      ctx.lineWidth = 0.5 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 6, y + len * 0.5, x + (rand() - 0.5) * 5, y + len);
      ctx.stroke();
    }
    for (let i = 0; i < 2400; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 0.4 + rand() * 1.3;
      ctx.fillStyle = rand() > 0.6 ? 'rgba(106, 78, 42, 0.07)' : 'rgba(255, 255, 250, 0.12)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, 'rgba(255, 244, 220, 0.12)');
    gradient.addColorStop(0.5, 'rgba(180, 148, 102, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  createCloudPuffTexture(size = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const rand = mulberry32(551122);
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2;
      const rad = Math.pow(rand(), 0.7) * size * 0.3;
      const x = size * 0.5 + Math.cos(a) * rad * 1.5;
      const y = size * 0.54 + Math.sin(a) * rad * 0.62;
      const r = size * (0.07 + rand() * 0.16);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const alpha = 0.1 + rand() * 0.16;
      grad.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grad.addColorStop(0.55, `rgba(248,250,255,${alpha * 0.45})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const image = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i + 3] = Math.max(0, image.data[i + 3] - (rand() * 6) | 0);
    }
    ctx.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  createPaintedWoodTexture(size = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const rand = mulberry32(72091);
    ctx.fillStyle = '#ad2f1e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const x = rand() * size;
      const w = 1 + rand() * 5;
      ctx.fillStyle = rand() > 0.5 ? `rgba(70, 18, 12, ${0.03 + rand() * 0.09})` : `rgba(226, 94, 52, ${0.02 + rand() * 0.07})`;
      ctx.fillRect(x, 0, w, size);
    }
    for (let i = 0; i < 34; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 8 + rand() * 70;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(48, 16, 12, ${0.05 + rand() * 0.16})`);
      grad.addColorStop(1, 'rgba(48, 16, 12, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(255, 226, 194, ${rand() * 0.05})`;
      ctx.fillRect(rand() * size, rand() * size, 1 + rand() * 2, 1 + rand() * 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  createMossStoneTexture(size = 512): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const rand = mulberry32(998877);
    ctx.fillStyle = '#5b5f57';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 5600; i++) {
      const shade = 60 + rand() * 55;
      ctx.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade - 6}, ${0.12 + rand() * 0.25})`;
      const r = 0.6 + rand() * 3.4;
      ctx.beginPath();
      ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 300; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 5 + rand() * 30;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      const green = rand() > 0.5 ? 'rgba(74, 96, 48, 0.34)' : 'rgba(46, 72, 42, 0.3)';
      grad.addColorStop(0, green);
      grad.addColorStop(1, 'rgba(40, 60, 36, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(24, 27, 23, ${0.05 + rand() * 0.12})`;
      ctx.lineWidth = 0.5 + rand();
      ctx.beginPath();
      let x = rand() * size;
      let y = rand() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (rand() - 0.5) * 40;
        y += (rand() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  createGlowTexture(size = 256): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.22, 'rgba(255,250,235,0.82)');
    grad.addColorStop(0.5, 'rgba(255,230,190,0.22)');
    grad.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
