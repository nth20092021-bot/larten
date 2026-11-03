// src/utils/MessengerRedirect.ts

export class MessengerRedirect {
  public static isMessengerOrInAppBrowser(): boolean {
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
    const isFB = ua.indexOf('FBAN') > -1 || ua.indexOf('FBAV') > -1 || ua.indexOf('FB_IAB') > -1;
    const isMessenger = ua.indexOf('Messenger') > -1;
    const isInstagram = ua.indexOf('Instagram') > -1;
    const isZalo = ua.indexOf('Zalo') > -1;
    return isFB || isMessenger || isInstagram || isZalo;
  }

  public static isAndroid(): boolean {
    return /android/i.test(navigator.userAgent || '');
  }

  public static isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent || '') && !(window as any).MSStream;
  }

  public static openInExternalChrome(): void {
    const currentUrl = window.location.href;

    if (this.isAndroid()) {
      // Android Chrome Intent
      const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
      const chromeIntent = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      window.location.href = chromeIntent;
      
      // Fallback
      setTimeout(() => {
        window.location.href = `googlechrome://${cleanUrl}`;
      }, 1000);
    } else if (this.isIOS()) {
      // iOS Chrome or Safari guide
      const cleanUrl = currentUrl.replace(/^https?:\/\//, '');
      // Try opening Google Chrome on iOS if installed
      window.location.href = `googlechromes://${cleanUrl}`;

      // Show hint to open in Safari / Chrome
      setTimeout(() => {
        alert("Trên iPhone/iPad: Bạn hãy nhấn vào biểu tượng dấu 3 chấm (...) ở góc trên bên phải màn hình và chọn 'Mở trong trình duyệt mặc định' (Safari/Chrome).");
      }, 500);
    } else {
      window.open(currentUrl, '_blank');
    }
  }

  public static copyPageLink(): Promise<boolean> {
    const url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url).then(() => true).catch(() => false);
    } else {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      const success = document.execCommand('copy');
      document.body.removeChild(input);
      return Promise.resolve(success);
    }
  }

  public static initCheck(): void {
    const inApp = this.isMessengerOrInAppBrowser();
    
    // Auto prompt on Android or iOS
    if (inApp) {
      this.createMessengerBanner();
      
      // Auto-trigger intent on Android once after short delay
      if (this.isAndroid()) {
        const cleanUrl = window.location.href.replace(/^https?:\/\//, '');
        const intentUrl = `intent://${cleanUrl}#Intent;scheme=https;package=com.android.chrome;end`;
        // Only redirect if user has not already chosen to stay
        if (!sessionStorage.getItem('stay_in_messenger')) {
          setTimeout(() => {
            window.location.href = intentUrl;
          }, 400);
        }
      }
    }
  }

  public static createMessengerBanner(): void {
    if (document.getElementById('messenger-redirect-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'messenger-redirect-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(5, 11, 20, 0.88);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
      font-family: 'Plus Jakarta Sans', sans-serif;
      animation: fadeInModal 0.4s ease;
    `;

    const isIos = this.isIOS();

    modal.innerHTML = `
      <style>
        @keyframes fadeInModal {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .shinkai-btn {
          border: 1px solid rgba(255, 215, 120, 0.4);
          background: linear-gradient(135deg, rgba(255, 180, 80, 0.25), rgba(120, 70, 220, 0.35));
          color: #fff;
          font-weight: 600;
          padding: 12px 24px;
          border-radius: 30px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(255, 160, 50, 0.25);
          transition: all 0.3s ease;
          width: 100%;
          text-decoration: none;
        }
        .shinkai-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 25px rgba(255, 180, 80, 0.4);
          border-color: rgba(255, 230, 160, 0.8);
        }
        .secondary-btn {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
          padding: 10px 20px;
          border-radius: 30px;
          cursor: pointer;
          font-size: 13px;
          width: 100%;
          transition: all 0.2s ease;
        }
        .secondary-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      </style>
      <div style="
        background: linear-gradient(160deg, #131930 0%, #0d1222 100%);
        border: 1px solid rgba(255, 215, 120, 0.3);
        border-radius: 20px;
        max-width: 420px;
        width: 100%;
        padding: 28px 24px;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7), 0 0 40px rgba(138, 92, 246, 0.25);
        text-align: center;
        color: #f1f5f9;
        position: relative;
      ">
        <div style="font-size: 36px; margin-bottom: 12px;">🏮✨</div>
        <h2 style="font-family: 'Noto Serif Display', serif; font-size: 22px; margin: 0 0 10px 0; color: #ffd680; letter-spacing: 0.5px;">
          Chuyển Sang Google Chrome
        </h2>
        <p style="font-size: 13.5px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
          Bạn đang xem trong trình duyệt Messenger. Để trải nghiệm trọn vẹn <strong>đồ họa 3D Shinkai, ngắm 28 Đèn Trời và nghe nhạc piano</strong> mà không bị giật lag, hãy mở bằng <strong>Google Chrome</strong> nhé!
        </p>

        ${isIos ? `
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 12px; margin-bottom: 18px; font-size: 13px; color: #fde68a; text-align: left; line-height: 1.5;">
            👉 <strong>Cách mở trên iOS:</strong><br/>
            Nhấn vào dấu <strong>•••</strong> ở góc trên bên phải màn hình ➔ Chọn <strong>"Mở trong trình duyệt mặc định"</strong> (Safari / Chrome).
          </div>
        ` : ''}

        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-open-chrome" class="shinkai-btn">
            🚀 Mở Bằng Google Chrome
          </button>
          <button id="btn-copy-link" class="secondary-btn">
            📋 Sao Chép Liên Kết
          </button>
          <button id="btn-continue-inapp" class="secondary-btn" style="border: none; background: transparent; color: #94a3b8; font-size: 12px;">
            ✕ Bỏ qua, tiếp tục xem tại đây
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-open-chrome')?.addEventListener('click', () => {
      this.openInExternalChrome();
    });

    document.getElementById('btn-copy-link')?.addEventListener('click', async () => {
      const ok = await this.copyPageLink();
      const btn = document.getElementById('btn-copy-link');
      if (btn) {
        btn.textContent = ok ? '✓ Đã chép link! Dán vào Chrome nhé' : 'Không thể chép, hãy copy trên thanh địa chỉ';
        setTimeout(() => {
          btn.textContent = '📋 Sao Chép Liên Kết';
        }, 3000);
      }
    });

    document.getElementById('btn-continue-inapp')?.addEventListener('click', () => {
      sessionStorage.setItem('stay_in_messenger', 'true');
      modal.remove();
    });
  }
}
