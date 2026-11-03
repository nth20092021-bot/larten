// src/types/SkyLanternTypes.ts

export interface LanternData {
  id: string;
  name: string;
  wish: string;
  position: { x: number; y: number; z: number };
  color: string;
  glowColor: string;
  speed: number;
  swaySpeed: number;
  swayAmplitude: number;
  phase: number;
  rotationSpeed: number;
  mesh?: any;
  isCustom?: boolean;
}

export type WeatherMode = 'SHINKAI_TWILIGHT' | 'STARRY_MIDNIGHT' | 'REVERSE_METEOR_STORM' | 'MISTY_DAWN';

export interface WeatherConfig {
  name: string;
  description: string;
  skyTopColor: string;
  skyMidColor: string;
  skyBottomColor: string;
  ambientLightColor: string;
  ambientIntensity: number;
  moonColor: string;
  moonIntensity: number;
  bloomIntensity: number;
  reverseRainDensity: number;
  reverseRainSpeed: number;
  reverseRainColor: string;
  whaleVisibility: boolean;
}

export type CameraViewMode = 'ORBIT' | 'CINEMATIC' | 'LOOK_UP' | 'FOCUS_LANTERN';

export const DEFAULT_STUDENT_NAMES: string[] = [
  "Vương Trần Thiên Ái",
  "Nguyễn Hải Anh",
  "Nguyễn Phạm Minh Anh",
  "Nguyễn Ngọc Minh Châu",
  "Nguyễn Trần Diễm Chi",
  "Nguyễn Khải Hoàn",
  "A Se Kinl",
  "Trình Nhã Kỳ",
  "Nguyễn Ngọc Bảo Linh",
  "Phạm Hoàng Trúc Linh",
  "Bành Gia Mẫn",
  "Trần Thục Bảo Nghi",
  "Thiên Ngọc",
  "Bùi Hoàng Nhân",
  "Vũ Nguyễn Yến Nhi",
  "Ngô Tâm Như",
  "Nguyễn Ngọc Thảo Như",
  "Bùi Nguyễn Phúc Ni",
  "Hoàng Phúc",
  "Lê Ngọc Thuận",
  "Nguyễn Minh Thư",
  "Trần Ngọc Anh Thư",
  "Hồ Ngọc Bảo Thy",
  "Nguyễn Ngọc Phương Trang",
  "Nguyễn Minh Triết",
  "Huỳnh Ngọc Thanh Vy",
  "Lê Ngọc Tường Vy",
  "Đặng Thanh Xuân"
];

export const INSPIRATIONAL_WISHES: string[] = [
  "Chúc bạn luôn rực rỡ, bình yên và hạnh phúc trên mọi nẻo đường đời.",
  "Ước mơ bay cao bay xa như ngàn ngọn đèn trời giữa dải ngân hà.",
  "Mọi dự định đều hanh thông, tương lai xán lạn và ngập tràn niềm vui.",
  "Giữ mãi nụ cười trong trẻo và trái tim ấm áp như ánh lửa đèn đêm.",
  "Vạn dặm đường dài, chúc bạn luôn tìm thấy bầu trời rực rỡ của riêng mình.",
  "Cầu chúc bình an cho bạn và những người thân yêu suốt bốn mùa.",
  "Bước qua giông bão, phía trước luôn là bầu trời sao lấp lánh.",
  "Hy vọng mọi mong ước chân thành đều trở thành hiện thực tuyệt đẹp.",
  "Tuổi trẻ rực rỡ như sao băng ngược, bay vút lên đỉnh cao ước vọng."
];
