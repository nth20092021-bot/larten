// /src/types/SkyLanternTypes.ts

export const LANTERN_COUNT = 28;

export const STORAGE_KEYS = {
  students: 'sky_lantern_students_v2',
  usedWinners: 'sky_lantern_used_winners_v2',
  avoidRepeat: 'sky_lantern_avoid_repeat_v2',
  sound: 'sky_lantern_sound_v2',
  chosen: 'sky_lantern_chosen_v2',
  city: 'sky_lantern_city_v2',
} as const;

export const DEFAULT_STUDENTS: readonly string[] = [
  'Vương Trần Thiên Ái',
  'Nguyễn Hải Anh',
  'Nguyễn Phạm Minh Anh',
  'Nguyễn Ngọc Minh Châu',
  'Nguyễn Trần Diễm Chi',
  'Nguyễn Khải Hoàn',
  'A Se Kinl',
  'Trình Nhã Kỳ',
  'Nguyễn Ngọc Bảo Linh',
  'Phạm Hoàng Trúc Linh',
  'Bành Gia Mẫn',
  'Trần Thục Bảo Nghi',
  'Thiên Ngọc',
  'Bùi Hoàng Nhân',
  'Vũ Nguyễn Yến Nhi',
  'Ngô Tâm Như',
  'Nguyễn Ngọc Thảo Như',
  'Bùi Nguyễn Phúc Ni',
  'Hoàng Phúc',
  'Lê Ngọc Thuận',
  'Nguyễn Minh Thư',
  'Trần Ngọc Anh Thư',
  'Hồ Ngọc Bảo Thy',
  'Nguyễn Ngọc Phương Trang',
  'Nguyễn Minh Triết',
  'Huỳnh Ngọc Thanh Vy',
  'Lê Ngọc Tường Vy',
  'Đặng Thanh Xuân',
];

export interface CityPreset {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  poetLine: string;
  fallback: {
    temperature: number;
    precipitation: number;
    cloudCover: number;
    windSpeed: number;
    windDirection: number;
    isDay: number;
  };
}

export const CITIES: readonly CityPreset[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    region: 'Nhật Bản',
    latitude: 35.6762,
    longitude: 139.6503,
    poetLine: 'Thành phố của những cơn mưa không tên',
    fallback: { temperature: 19, precipitation: 1.4, cloudCover: 82, windSpeed: 14, windDirection: 165, isDay: 0 },
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    region: 'Nhật Bản',
    latitude: 35.0116,
    longitude: 135.7681,
    poetLine: 'Cổ tự ngủ quên dưới tán mưa',
    fallback: { temperature: 21, precipitation: 0.6, cloudCover: 68, windSpeed: 9, windDirection: 210, isDay: 0 },
  },
  {
    id: 'hoian',
    name: 'Hội An',
    region: 'Việt Nam',
    latitude: 15.8801,
    longitude: 108.338,
    poetLine: 'Đèn lồng thả xuống dòng Hoài',
    fallback: { temperature: 27, precipitation: 0.2, cloudCover: 45, windSpeed: 6, windDirection: 90, isDay: 1 },
  },
  {
    id: 'taipei',
    name: 'Đài Bắc',
    region: 'Đài Loan',
    latitude: 25.033,
    longitude: 121.5654,
    poetLine: 'Mưa phố cũ và tiếng chuông gió',
    fallback: { temperature: 25, precipitation: 3.1, cloudCover: 91, windSpeed: 18, windDirection: 75, isDay: 0 },
  },
  {
    id: 'reykjavik',
    name: 'Reykjavík',
    region: 'Iceland',
    latitude: 64.1466,
    longitude: -21.9426,
    poetLine: 'Cực quang nằm lại trong mắt người',
    fallback: { temperature: 4, precipitation: 0.9, cloudCover: 76, windSpeed: 32, windDirection: 300, isDay: 0 },
  },
  {
    id: 'tazawa',
    name: 'Hồ Tazawa',
    region: 'Akita, Nhật Bản',
    latitude: 39.7167,
    longitude: 140.6667,
    poetLine: 'Mặt hồ phẳng như một tấm gương trời',
    fallback: { temperature: 12, precipitation: 0.4, cloudCover: 55, windSpeed: 7, windDirection: 140, isDay: 0 },
  },
];

export interface WeatherSnapshot {
  cityId: string;
  temperature: number;
  precipitation: number;
  cloudCover: number;
  windSpeed: number;
  windDirection: number;
  isDay: boolean;
  source: 'live' | 'fallback';
  fetchedAt: number;
  condition: string;
}

export interface WindState {
  x: number;
  z: number;
  strength: number;
  gust: number;
}

export type RunPhase = 'idle' | 'awakening' | 'storm' | 'climax' | 'sunburst' | 'dawn';

export interface StudentProfile {
  id: number;
  name: string;
  slot: number;
}

export const TIMELINE = {
  awakening: 0,
  storm: 4.0,
  climax: 12.5,
  split: 14.5,
  sunburst: 15.5,
  finale: 17.4,
  end: 19.4,
} as const;

export const DEATH_WAVES: readonly { at: number; count: number }[] = [
  { at: 5.0, count: 5 },
  { at: 6.2, count: 4 },
  { at: 7.4, count: 4 },
  { at: 8.6, count: 4 },
  { at: 9.8, count: 3 },
  { at: 11.0, count: 3 },
  { at: 12.2, count: 2 },
];

export interface CameraTrackPoint {
  t: number;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  roll: number;
}

export interface QualitySettings {
  pixelRatio: number;
  reflectionScale: number;
  bloom: boolean;
  godRays: boolean;
}

export interface EnvironmentParams {
  storm: number;
  cloudCover: number;
  rainGlow: number;
  flash: number;
  gap: number;
  rainbow: number;
  sunStrength: number;
  wake: number;
  wakeRadius: number;
  cloudSea: number;
  windX: number;
  windZ: number;
  windStrength: number;
  timeScale: number;
}

export interface RainParams {
  intensity: number;
  reverse: number;
  timeScale: number;
  windX: number;
  windZ: number;
  storm: number;
  sparkle: number;
}

export interface LanternFlightParams {
  journey: number;
  storm: number;
  windX: number;
  windZ: number;
  windStrength: number;
  elapsed: number;
}

export interface LanternRuntimeState {
  id: number;
  student: StudentProfile;
  alive: boolean;
  deathAt: number;
  deathProgress: number;
  deathJourney: number;
  driftAngle: number;
  destiny: boolean;
}

export interface DirectorCallbacks {
  onPhaseChange: (phase: RunPhase) => void;
  onLanternFall: (name: string, remaining: number) => void;
  onWinner: (name: string) => void;
  onFinished: () => void;
  onCaption: (text: string) => void;
}

export function cloneDefaultStudents(): string[] {
  return [...DEFAULT_STUDENTS];
}

export function makeStudents(names: readonly string[]): StudentProfile[] {
  return Array.from({ length: LANTERN_COUNT }, (_, i) => ({
    id: i,
    name: (names[i] ?? DEFAULT_STUDENTS[i] ?? `Học sinh ${i + 1}`).trim() || `Học sinh ${i + 1}`,
    slot: i,
  }));
}
