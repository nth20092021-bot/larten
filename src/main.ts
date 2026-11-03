// src/main.ts

import { WeatheringDirector } from './core/WeatheringDirector';
import { MinimalSettingUI } from './ui/MinimalSettingUI';
import { MessengerRedirect } from './utils/MessengerRedirect';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Messenger in-app browser redirect detection & prompt
  MessengerRedirect.initCheck();

  const appElement = document.getElementById('app');
  if (!appElement) return;

  // 2. Initialise 3D Scene and Director
  try {
    const director = new WeatheringDirector(appElement);
    new MinimalSettingUI(director);
  } catch (err) {
    console.error('Lỗi khởi tạo hệ thống 3D:', err);
    const errDiv = document.createElement('div');
    errDiv.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #ffd680;
      text-align: center;
      font-family: sans-serif;
      padding: 20px;
    `;
    errDiv.innerHTML = `
      <h2>Không thể tải đồ họa 3D</h2>
      <p>Trình duyệt của bạn có thể đang hạn chế WebGL hoặc bộ nhớ GPU. Vui lòng mở bằng Google Chrome trên thiết bị.</p>
    `;
    appElement.appendChild(errDiv);
  }
});
