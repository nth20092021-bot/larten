// src/ui/MinimalSettingUI.ts

import { WeatheringDirector } from '../core/WeatheringDirector';
import { DEFAULT_STUDENT_NAMES, LanternData, WeatherMode } from '../types/SkyLanternTypes';
import { MessengerRedirect } from '../utils/MessengerRedirect';

export class MinimalSettingUI {
  private director: WeatheringDirector;
  private container: HTMLElement;
  private wishCard: HTMLElement | null = null;
  private listModal: HTMLElement | null = null;
  private releaseModal: HTMLElement | null = null;

  constructor(director: WeatheringDirector) {
    this.director = director;
    this.container = document.getElementById('app') || document.body;
    this.renderUI();
    this.setupPointerEvents();
  }

  private renderUI(): void {
    const hud = document.createElement('div');
    hud.id = 'shinkai-hud';
    hud.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 16px 20px;
      box-sizing: border-box;
      z-index: 100;
    `;

    hud.innerHTML = `
      <style>
        .hud-btn {
          pointer-events: auto;
          background: rgba(14, 22, 42, 0.65);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 215, 120, 0.28);
          color: #f1f5f9;
          font-size: 13px;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 24px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }
        .hud-btn:hover {
          background: rgba(30, 42, 74, 0.85);
          border-color: rgba(255, 215, 120, 0.7);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(255, 180, 80, 0.25);
        }
        .hud-btn.active {
          background: linear-gradient(135deg, rgba(255, 150, 50, 0.4), rgba(140, 60, 240, 0.5));
          border-color: #ffd680;
          color: #fff;
        }
        .hud-select {
          pointer-events: auto;
          background: rgba(14, 22, 42, 0.7);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 215, 120, 0.3);
          color: #ffd680;
          font-size: 12.5px;
          font-weight: 500;
          padding: 8px 12px;
          border-radius: 20px;
          outline: none;
          cursor: pointer;
        }
        .hud-select option {
          background: #0d1424;
          color: #f1f5f9;
        }
        .shinkai-modal {
          pointer-events: auto;
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(5, 11, 20, 0.75);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          box-sizing: border-box;
          z-index: 1000;
          animation: modalFade 0.3s ease;
        }
        @keyframes modalFade {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .name-chip {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 215, 120, 0.2);
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }
        .name-chip:hover {
          background: rgba(255, 180, 80, 0.15);
          border-color: rgba(255, 215, 120, 0.6);
          transform: translateY(-2px);
        }
      </style>

      <!-- TOP BAR -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap;">
        <div>
          <h1 style="
            font-family: 'Noto Serif Display', 'Cormorant Garamond', serif;
            font-size: clamp(20px, 3.5vw, 28px);
            margin: 0;
            color: #ffe6a0;
            text-shadow: 0 0 15px rgba(255, 180, 50, 0.5), 0 2px 10px rgba(0,0,0,0.8);
            letter-spacing: 0.5px;
          ">
            Người Gác Đèn Trời &amp; Cơn Mưa Sao Băng Ngược
          </h1>
          <p style="
            margin: 4px 0 0 0;
            font-size: clamp(11.5px, 2vw, 13px);
            color: #cbd5e1;
            text-shadow: 0 1px 4px rgba(0,0,0,0.8);
          ">
            The Reverse-Rain Sky Lanterns • Makoto Shinkai Cinematic Experience
          </p>
        </div>

        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button id="btn-toggle-sound" class="hud-btn">
            <span id="sound-icon">🎵</span>
            <span id="sound-text">Bật Nhạc</span>
          </button>
          <button id="btn-open-chrome-top" class="hud-btn" style="border-color: rgba(96, 165, 250, 0.5); color: #93c5fd;">
            🚀 Mở Bằng Chrome
          </button>
        </div>
      </div>

      <!-- BOTTOM CONTROL BAR -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap;">
        <!-- Left: Major Actions -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button id="btn-open-list" class="hud-btn" style="background: linear-gradient(135deg, rgba(255,180,50,0.3), rgba(120,70,220,0.4)); border-color: #ffd680;">
            🏮 <strong>Danh Sách 28 Đèn Trời</strong>
          </button>
          <button id="btn-release-new" class="hud-btn">
            ✨ Thả Đèn Nguyện Ước
          </button>
        </div>

        <!-- Right: Environment & Camera presets -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <select id="select-weather" class="hud-select" title="Thời tiết & Bầu trời">
            <option value="SHINKAI_TWILIGHT">🌅 Hoàng Hôn Shinkai</option>
            <option value="STARRY_MIDNIGHT">🌌 Đêm Ngàn Sao</option>
            <option value="REVERSE_METEOR_STORM">✨ Bão Sao Băng Ngược</option>
            <option value="MISTY_DAWN">🌄 Rạng Đông Sương Mờ</option>
          </select>

          <select id="select-camera" class="hud-select" title="Góc nhìn camera">
            <option value="ORBIT">🎥 Camera Tự Do</option>
            <option value="CINEMATIC">🎬 Quay Điện Ảnh</option>
            <option value="LOOK_UP">👀 Ngước Nhìn Trời</option>
          </select>
        </div>
      </div>
    `;

    this.container.appendChild(hud);
    this.bindEvents();
  }

  private bindEvents(): void {
    // Sound Toggle
    const soundBtn = document.getElementById('btn-toggle-sound');
    soundBtn?.addEventListener('click', () => {
      this.director.soundEngine.init();
      const isMuted = this.director.soundEngine.toggleMute();
      const soundIcon = document.getElementById('sound-icon');
      const soundText = document.getElementById('sound-text');
      if (soundIcon && soundText) {
        soundIcon.textContent = isMuted ? '🔇' : '🎵';
        soundText.textContent = isMuted ? 'Tắt Tiếng' : 'Bật Nhạc';
      }
    });

    // Open in Chrome Top Button
    document.getElementById('btn-open-chrome-top')?.addEventListener('click', () => {
      MessengerRedirect.createMessengerBanner();
    });

    // Open 28 Student List Modal
    document.getElementById('btn-open-list')?.addEventListener('click', () => {
      this.show28ListModal();
    });

    // Release New Custom Lantern Modal
    document.getElementById('btn-release-new')?.addEventListener('click', () => {
      this.showReleaseLanternModal();
    });

    // Weather Change
    const weatherSelect = document.getElementById('select-weather') as HTMLSelectElement;
    weatherSelect?.addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value as WeatherMode;
      this.director.setWeatherMode(mode);
    });

    // Camera Mode Change
    const cameraSelect = document.getElementById('select-camera') as HTMLSelectElement;
    cameraSelect?.addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value as any;
      this.director.setViewMode(mode);
    });

    // First user click on body initializes audio softly
    window.addEventListener('click', () => {
      this.director.soundEngine.init();
    }, { once: true });
  }

  private setupPointerEvents(): void {
    let downX = 0;
    let downY = 0;

    window.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });

    window.addEventListener('pointerup', (e) => {
      // Only treat as click if pointer hasn't dragged far (not an orbit drag)
      const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dist < 6) {
        const mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
        const clickedLantern = this.director.lanternManager.checkIntersection(
          mouseX,
          mouseY,
          this.director.camera
        );
        if (clickedLantern) {
          this.director.focusLantern(clickedLantern);
          this.showWishCard(clickedLantern);
        }
      }
    });
  }

  public showWishCard(lantern: LanternData): void {
    if (this.wishCard) this.wishCard.remove();

    this.wishCard = document.createElement('div');
    this.wishCard.style.cssText = `
      position: fixed;
      bottom: 85px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(145deg, rgba(19, 27, 49, 0.92) 0%, rgba(10, 15, 30, 0.95) 100%);
      border: 1px solid rgba(255, 215, 120, 0.45);
      border-radius: 18px;
      padding: 20px 24px;
      max-width: 440px;
      width: 90%;
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(255, 180, 50, 0.25);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      z-index: 500;
      animation: modalFade 0.3s ease;
      color: #f1f5f9;
      text-align: center;
    `;

    this.wishCard.innerHTML = `
      <div style="font-size: 26px; margin-bottom: 6px;">🏮</div>
      <h3 style="
        font-family: 'Noto Serif Display', 'Cormorant Garamond', serif;
        font-size: 22px;
        color: #ffd680;
        margin: 0 0 6px 0;
      ">
        ${lantern.name}
      </h3>
      <p style="
        font-size: 14px;
        line-height: 1.6;
        color: #e2e8f0;
        font-style: italic;
        margin: 0 0 16px 0;
      ">
        "${lantern.wish}"
      </p>
      <div style="display: flex; justify-content: center; gap: 10px;">
        <button id="btn-close-wish" class="hud-btn" style="font-size: 12px; padding: 6px 20px;">
          ✓ Đóng
        </button>
      </div>
    `;

    document.body.appendChild(this.wishCard);

    document.getElementById('btn-close-wish')?.addEventListener('click', () => {
      this.wishCard?.remove();
      this.wishCard = null;
    });
  }

  public show28ListModal(): void {
    if (this.listModal) this.listModal.remove();

    this.listModal = document.createElement('div');
    this.listModal.className = 'shinkai-modal';

    const chipsHtml = DEFAULT_STUDENT_NAMES.map((name, i) => `
      <div class="name-chip" data-name="${name}">
        <div style="font-size: 11px; color: #f59e0b; margin-bottom: 2px;">Đèn Trời #${i + 1}</div>
        <div style="font-weight: 600; font-size: 13.5px; color: #fff;">${name}</div>
      </div>
    `).join('');

    this.listModal.innerHTML = `
      <div style="
        background: linear-gradient(160deg, #131a33 0%, #0d1222 100%);
        border: 1px solid rgba(255, 215, 120, 0.3);
        border-radius: 20px;
        max-width: 580px;
        width: 100%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        padding: 24px;
        box-sizing: border-box;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(138, 92, 246, 0.2);
        color: #f1f5f9;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div>
            <h2 style="font-family: 'Noto Serif Display', serif; font-size: 20px; margin: 0; color: #ffd680;">
              🏮 28 Ngọn Đèn Trời Kỷ Niệm
            </h2>
            <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0 0;">
              Chạm vào bất kỳ tên ai để đưa ống kính camera bay tới ngọn đèn của bạn ấy.
            </p>
          </div>
          <button id="btn-close-list-modal" style="background: none; border: none; color: #cbd5e1; font-size: 24px; cursor: pointer;">✕</button>
        </div>

        <input
          id="input-search-name"
          type="text"
          placeholder="🔍 Tìm kiếm họ tên..."
          style="
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            padding: 10px 14px;
            color: #fff;
            font-size: 13px;
            margin-bottom: 14px;
            outline: none;
          "
        />

        <div id="chips-grid" style="
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
          overflow-y: auto;
          padding-right: 6px;
          margin-bottom: 14px;
          max-height: 50vh;
        ">
          ${chipsHtml}
        </div>

        <button id="btn-close-list-bottom" class="hud-btn" style="align-self: center; padding: 8px 30px;">
          Đóng
        </button>
      </div>
    `;

    document.body.appendChild(this.listModal);

    // Search filter
    const searchInput = document.getElementById('input-search-name') as HTMLInputElement;
    searchInput?.addEventListener('input', (e) => {
      const q = (e.target as HTMLInputElement).value.toLowerCase();
      const chips = document.querySelectorAll('.name-chip') as NodeListOf<HTMLElement>;
      chips.forEach(chip => {
        const name = chip.getAttribute('data-name')?.toLowerCase() || '';
        chip.style.display = name.includes(q) ? 'block' : 'none';
      });
    });

    // Chip click
    const chips = this.listModal.querySelectorAll('.name-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.getAttribute('data-name');
        if (name) {
          const lantern = this.director.lanternManager.getLanternByName(name);
          if (lantern) {
            this.director.focusLantern(lantern);
            this.showWishCard(lantern);
          }
        }
        this.listModal?.remove();
        this.listModal = null;
      });
    });

    // Close buttons
    const closeModal = () => {
      this.listModal?.remove();
      this.listModal = null;
    };
    document.getElementById('btn-close-list-modal')?.addEventListener('click', closeModal);
    document.getElementById('btn-close-list-bottom')?.addEventListener('click', closeModal);
  }

  public showReleaseLanternModal(): void {
    if (this.releaseModal) this.releaseModal.remove();

    this.releaseModal = document.createElement('div');
    this.releaseModal.className = 'shinkai-modal';

    this.releaseModal.innerHTML = `
      <div style="
        background: linear-gradient(160deg, #131a33 0%, #0d1222 100%);
        border: 1px solid rgba(255, 215, 120, 0.3);
        border-radius: 20px;
        max-width: 440px;
        width: 100%;
        padding: 24px;
        box-sizing: border-box;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
        color: #f1f5f9;
        text-align: center;
      ">
        <div style="font-size: 32px; margin-bottom: 8px;">✨🏮</div>
        <h2 style="font-family: 'Noto Serif Display', serif; font-size: 21px; margin: 0 0 8px 0; color: #ffd680;">
          Thả Ngọn Đèn Trời Của Bạn
        </h2>
        <p style="font-size: 13px; color: #cbd5e1; margin: 0 0 18px 0;">
          Gửi gắm ước nguyện chân thành vào ánh sáng đèn lồng và để nó bay vút lên bầu trời sao băng ngược.
        </p>

        <div style="display: flex; flex-direction: column; gap: 12px; text-align: left; margin-bottom: 18px;">
          <div>
            <label style="font-size: 12px; color: #ffd680; margin-bottom: 4px; display: block;">Họ &amp; Tên:</label>
            <input
              id="custom-lantern-name"
              type="text"
              placeholder="VD: Nguyễn An Nhiên"
              maxlength="30"
              style="
                width: 100%;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 10px;
                padding: 10px 14px;
                color: #fff;
                font-size: 13.5px;
                box-sizing: border-box;
                outline: none;
              "
            />
          </div>

          <div>
            <label style="font-size: 12px; color: #ffd680; margin-bottom: 4px; display: block;">Điều Ước Của Bạn:</label>
            <textarea
              id="custom-lantern-wish"
              rows="3"
              placeholder="VD: Cầu chúc gia đình bình an, bản thân luôn kiên cường và đạt được ước mơ."
              maxlength="120"
              style="
                width: 100%;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 10px;
                padding: 10px 14px;
                color: #fff;
                font-size: 13.5px;
                box-sizing: border-box;
                outline: none;
                resize: none;
                font-family: inherit;
              "
            ></textarea>
          </div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
          <button id="btn-submit-lantern" class="hud-btn" style="background: linear-gradient(135deg, #f59e0b, #ec4899); border: none; font-weight: 600; padding: 10px 24px;">
            🚀 Thả Lên Trời Sao
          </button>
          <button id="btn-cancel-lantern" class="hud-btn" style="background: rgba(255, 255, 255, 0.1); border: none;">
            Hủy Bỏ
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.releaseModal);

    document.getElementById('btn-cancel-lantern')?.addEventListener('click', () => {
      this.releaseModal?.remove();
      this.releaseModal = null;
    });

    document.getElementById('btn-submit-lantern')?.addEventListener('click', () => {
      const nameInput = document.getElementById('custom-lantern-name') as HTMLInputElement;
      const wishInput = document.getElementById('custom-lantern-wish') as HTMLTextAreaElement;

      const name = nameInput.value.trim() || 'Người Bạn Phương Xa';
      const wish = wishInput.value.trim() || 'Ước nguyện bình an và rực rỡ như những vì sao.';

      const newLantern = this.director.lanternManager.releaseCustomLantern(name, wish);
      this.director.focusLantern(newLantern);
      this.showWishCard(newLantern);

      this.releaseModal?.remove();
      this.releaseModal = null;
    });
  }
}
