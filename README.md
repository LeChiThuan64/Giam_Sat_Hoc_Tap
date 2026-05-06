# 🚀 FocusAI v1.1 — Ứng dụng Giám Sát Học Tập bằng AI

## ✨ Tính năng

✅ **Phát hiện mắt nhắm / Buồn ngủ** (Eye Aspect Ratio - EAR)  
✅ **Phát hiện quay đầu / Cúi đầu** (Head Pose - Yaw/Pitch)  
✅ **Phát hiện cầm điện thoại** (Hand Landmarker)  
✅ **Cảnh báo âm thanh** (Web Audio API)  
✅ **Tracking thời gian học** (Tập trung vs Xao nhãng)  
✅ **Focus Score Ring** (Điểm tập trung theo %)  
✅ **Cài đặt ngưỡng động** (Slider real-time)  
✅ **Nhật ký cảnh báo** (Event logging)  

---

## 🔧 Yêu cầu

- **Browser:** Chrome, Edge, or Firefox (hỗ trợ WebRTC)
- **Webcam:** Độ phân giải 720p trở lên
- **Internet:** Để tải MediaPipe models từ CDN

---

## 🎯 Cách chạy

### Option 1: VS Code Live Server (Recommended)

1. Cài đặt extension **"Live Server"** trong VS Code
2. Chuột phải vào `index.html` → **"Open with Live Server"**
3. Browser tự động mở `http://localhost:5500`
4. Nhấn **"Bắt đầu học"** để bắt đầu

### Option 2: Python HTTP Server

```bash
cd c:\Users\ACER\Downloads\Giam_Sat_TT
python -m http.server 8000
```

Sau đó mở: `http://localhost:8000`

### Option 3: Node.js HTTP Server

```bash
cd c:\Users\ACER\Downloads\Giam_Sat_TT
npx http-server
```

---

## 📊 Cách sử dụng

1. **Bắt đầu học**: Nhấn nút "Bắt đầu học" → Cấp quyền camera
2. **Giám sát**:
   - 🔴 **EAR (Eye Aspect Ratio)**: Nếu quá thấp → đang buồn ngủ
   - 🔴 **Yaw (Quay đầu)**: Nếu > 20° → cảnh báo
   - 🔴 **Pitch (Cúi đầu)**: Nếu > 15° → cảnh báo
   - 🔴 **Hand (Tay)**: Nếu phát hiện tay → cảnh báo cầm điện thoại
3. **Cảnh báo**: Âm thanh beep + Viền màn hình đỏ + Log
4. **Dừng học**: Nhấn "Dừng lại" để kết thúc phiên

---

## ⚙️ Cài đặt ngưỡng

| Thiết lập | Mặc định | Giới hạn |
|-----------|---------|---------|
| Góc quay ngang (Yaw) | 20° | 10° - 45° |
| Góc cúi đầu (Pitch) | 15° | 5° - 35° |
| Ngưỡng EAR buồn ngủ | 0.22 | 0.10 - 0.35 |
| Thời gian trước cảnh báo | 3s | 1s - 8s |

**Điều chỉnh trên UI real-time** → Settings sẽ áp dụng ngay!

---

## 🔊 Tắt/Bật âm thanh

Nhấn nút 🔊 trong control bar để:
- Tắt/bật tiếng beep alert
- Log vẫn ghi nhận sự kiện

---

## 📋 Nhật ký cảnh báo

- Tất cả sự kiện được ghi vào log (tối đa 60 items)
- Nhấn **"Xoá"** để clear log
- Log tự động clear khi dừng phiên học

---

## 📈 Focus Score

**Công thức**: `Score = (Tập trung / Tổng thời gian) × 100%`

- 🟢 **70-100%**: Tập trung tốt
- 🟡 **45-69%**: Tập trung bình
- 🔴 **< 45%**: Cần cải thiện

---

## 🐛 Troubleshooting

### ❌ "Permission denied" (Camera)
→ Đảm bảo chạy qua **http://** hoặc **https://**, không phải `file://`

### ❌ AI model không tải
→ Kiểm tra internet connection
→ Refresh page và thử lại

### ❌ Không phát hiện khuôn mặt
→ Hãy bật đèn / cải thiện ánh sáng
→ Đưa khuôn mặt vào giữa camera

### ❌ Hand detection false positive
→ Điều chỉnh khoảng cách với camera
→ Tránh đặt vật khác gần camera

---

## 🌐 Công nghệ sử dụng

- **MediaPipe Face Landmarker**: 478 điểm trên khuôn mặt
- **MediaPipe Hand Landmarker**: Phát hiện bàn tay & ngón tay
- **Web Audio API**: Tiếng beep alert
- **Canvas API**: Vẽ landmarks lên video
- **RequestAnimationFrame**: Smooth 60FPS rendering

---

## 📝 Ghi chú

- Ứng dụng chạy **hoàn toàn trên browser**, không cần backend
- Dữ liệu camera **chỉ xử lý locally**, không gửi lên server
- Model AI được tải lần đầu (~30MB), cache lại cho những lần tiếp theo

---

## 🎓 Phiên bản

**FocusAI v1.1** - Học tập tập trung & theo dõi bằng AI

---

Made with ❤️ for better focus & learning
