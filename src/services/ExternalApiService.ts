// src/services/ExternalApiService.ts

import { WeatherConfig, WeatherMode } from '../types/SkyLanternTypes';

export class ExternalApiService {
  private static weatherPresets: Record<WeatherMode, WeatherConfig> = {
    SHINKAI_TWILIGHT: {
      name: "Hoàng Hôn Shinkai (Twilight Horizon)",
      description: "Bầu trời chuyển sắc tím lam huyền ảo, ánh hoàng hôn vàng cam và vầng trăng đầu đêm.",
      skyTopColor: "#080e24",
      skyMidColor: "#32164c",
      skyBottomColor: "#c85d38",
      ambientLightColor: "#8b6cb0",
      ambientIntensity: 0.9,
      moonColor: "#ffe8aa",
      moonIntensity: 1.6,
      bloomIntensity: 1.4,
      reverseRainDensity: 1200,
      reverseRainSpeed: 1.2,
      reverseRainColor: "#ffd680",
      whaleVisibility: true,
    },
    STARRY_MIDNIGHT: {
      name: "Đêm Ngàn Sao (Starry Midnight)",
      description: "Đêm xanh thẳm ngập tràn tinh tú, ánh trăng tròn tỏa sáng vằng vặc rọi sáng vạn dặm mây.",
      skyTopColor: "#030611",
      skyMidColor: "#0b162f",
      skyBottomColor: "#17274f",
      ambientLightColor: "#4b6584",
      ambientIntensity: 0.7,
      moonColor: "#dff9fb",
      moonIntensity: 2.2,
      bloomIntensity: 1.2,
      reverseRainDensity: 1500,
      reverseRainSpeed: 1.0,
      reverseRainColor: "#70a1ff",
      whaleVisibility: true,
    },
    REVERSE_METEOR_STORM: {
      name: "Bão Sao Băng Ngược (Aurora Meteor Storm)",
      description: "Hàng ngàn tia sao băng bay ngược từ mặt đất vút thẳng lên dải ngân hà huyền diệu.",
      skyTopColor: "#050b1a",
      skyMidColor: "#1d0e3b",
      skyBottomColor: "#4a1c6d",
      ambientLightColor: "#a55eea",
      ambientIntensity: 1.1,
      moonColor: "#f368e0",
      moonIntensity: 1.8,
      bloomIntensity: 2.0,
      reverseRainDensity: 2800,
      reverseRainSpeed: 2.4,
      reverseRainColor: "#a29bfe",
      whaleVisibility: true,
    },
    MISTY_DAWN: {
      name: "Rạng Đông Sương Mờ (Misty Dawn)",
      description: "Biển mây bồng bềnh đón chào ánh bình minh đầu tiên, những cánh đèn trời tan dần vào nắng sớm.",
      skyTopColor: "#1e272e",
      skyMidColor: "#485460",
      skyBottomColor: "#e58e26",
      ambientLightColor: "#ffbe76",
      ambientIntensity: 1.2,
      moonColor: "#f6e58d",
      moonIntensity: 1.0,
      bloomIntensity: 1.3,
      reverseRainDensity: 800,
      reverseRainSpeed: 0.8,
      reverseRainColor: "#f9ca24",
      whaleVisibility: false,
    }
  };

  public static getWeatherPreset(mode: WeatherMode): WeatherConfig {
    return this.weatherPresets[mode] || this.weatherPresets.SHINKAI_TWILIGHT;
  }

  public static getAllPresets(): Record<WeatherMode, WeatherConfig> {
    return this.weatherPresets;
  }

  // Optional real weather fetch from Open-Meteo
  public static async fetchRealWeather(): Promise<{ temp: number; condition: string } | null> {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=10.8231&longitude=106.6297&current_weather=true');
      if (!res.ok) return null;
      const data = await res.json();
      return {
        temp: data.current_weather.temperature,
        condition: data.current_weather.weathercode < 3 ? 'Trời trong nhiều sao' : 'Nhiều mây bồng bềnh'
      };
    } catch {
      return null;
    }
  }
}
