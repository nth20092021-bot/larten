# Người Gác Đèn Trời & Cơn Mưa Sao Băng Ngược
### *The Reverse-Rain Sky Lanterns — Makoto Shinkai Cinematic Experience*

Dự án Web Game 3D nghệ thuật lấy cảm hứng từ phong cách điện ảnh anime **Makoto Shinkai** (*Your Name, Weathering with You, Suzume*), kết hợp hiệu ứng đèn trời bay lơ lửng và những vệt sao băng ngược bay vút từ mặt đất lên dải ngân hà.

---

## ✨ Điểm Nổi Bật & Tính Năng

### 1. 🏮 28 Ngọn Đèn Trời Kỷ Niệm
Hệ thống hiển thị và tôn vinh 28 ngọn đèn trời mang tên 28 người bạn:
1. Vương Trần Thiên Ái
2. Nguyễn Hải Anh
3. Nguyễn Phạm Minh Anh
4. Nguyễn Ngọc Minh Châu
5. Nguyễn Trần Diễm Chi
6. Nguyễn Khải Hoàn
7. A Se Kinl
8. Trình Nhã Kỳ
9. Nguyễn Ngọc Bảo Linh
10. Phạm Hoàng Trúc Linh
11. Bành Gia Mẫn
12. Trần Thục Bảo Nghi
13. Thiên Ngọc
14. Bùi Hoàng Nhân
15. Vũ Nguyễn Yến Nhi
16. Ngô Tâm Như
17. Nguyễn Ngọc Thảo Như
18. Bùi Nguyễn Phúc Ni
19. Hoàng Phúc
20. Lê Ngọc Thuận
21. Nguyễn Minh Thư
22. Trần Ngọc Anh Thư
23. Hồ Ngọc Bảo Thy
24. Nguyễn Ngọc Phương Trang
25. Nguyễn Minh Triết
26. Huỳnh Ngọc Thanh Vy
27. Lê Ngọc Tường Vy
28. Đặng Thanh Xuân

- **Tương tác 3D:** Nhấp chuột hoặc chạm vào bất kỳ ngọn đèn nào trên màn hình để camera lướt tới ngắm nhìn cận cảnh ngọn đèn và đọc lời nguyện ước.
- **Danh sách tra cứu nhanh:** Nút **"Danh Sách 28 Đèn Trời"** cho phép tìm kiếm nhanh tên và tự động di chuyển camera đến ngọn đèn đó.
- **Thả đèn tự do:** Người dùng có thể tự nhập tên và lời chúc của riêng mình để thắp sáng và thả thêm một ngọn đèn trời bay vút vào không gian.

---

### 2. 🚀 Tính Năng Chuyển Đổi Từ Messenger Sang Google Chrome
Khi người dùng mở liên kết trong ứng dụng **Facebook Messenger**, **Facebook** hoặc **Instagram**:
- Hệ thống tự động nhận diện WebView In-App Browser.
- Tự động kích hoạt cơ chế chuyển hướng sang **Google Chrome** qua Android Intent URL scheme (`intent://...#Intent;scheme=https;package=com.android.chrome;end`).
- Cung cấp giao diện thông báo trực quan, nút **"Mở Bằng Google Chrome"**, **"Sao Chép Liên Kết"** và hướng dẫn chi tiết cho người dùng iOS mở trên Safari/Chrome để tránh bị giật lag và thưởng thức trọn vẹn âm thanh, đồ họa 3D.

---

### 3. 🌌 Đồ Họa Điện Ảnh Makoto Shinkai (Three.js & Shaders)
- **Bầu trời Shinkai Gradient:** Bầu trời chuyển sắc từ lam sẫm qua tím hoàng hôn và vàng mơ.
- **Cơn Mưa Sao Băng Ngược (Reverse Rain):** Hàng ngàn hạt bụi sao và vệt sáng bay ngược từ mặt đất lên dải ngân hà với hiệu ứng kéo dài đuôi sao băng.
- **Cá Voi Lưng Gù Trời Sao (Celestial Sky Whale):** Thân cá voi dạ quang bán trong suốt lượn sóng bơi qua các tầng mây và ngàn sao.
- **Mặt nước phản chiếu:** Hồ nước phẳng lặng dưới chân phản chiếu ánh sáng ấm áp của hàng trăm ngọn đèn lồng.
- **Hậu kỳ Postprocessing:** Tích hợp Bloom phát quang, tia sáng huyền ảo và hiệu ứng Vignette điện ảnh.

---

### 4. 🎵 Hệ Thống Âm Thanh Thủ Tục (Web Audio API)
- Tự động tạo nhạc nền piano nhẹ nhàng đầy cảm xúc (phong cách Radwimps / Joe Hisaishi).
- Tiếng gió đêm thì thầm và chuông gió ngân nga ngẫu nhiên.
- Hiệu ứng âm thanh khi thắp và thả đèn bay lên bầu trời.

---

## 🛠️ Công Nghệ Sử Dụng

- **Engine 3D:** [Three.js](https://threejs.org/) (`^0.187.0`)
- **Animation & Timeline:** [GSAP](https://gsap.com/) (`^3.15.0`)
- **Hậu kỳ đồ họa:** [postprocessing](https://github.com/pmndrs/postprocessing) (`^6.39.6`)
- **Ngôn ngữ:** TypeScript + GLSL Shaders
- **Bundler:** Vite

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

```bash
# 1. Cài đặt các thư viện
npm install

# 2. Khởi chạy môi trường phát triển (Dev Server)
npm run dev

# 3. Đóng gói bản Production
npm run build

# 4. Xem trước bản đóng gói
npm run preview
```
