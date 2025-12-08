# Thông báo sự kiện (OneSignal)

## Lịch gửi tự động
- Cron 5 phút một lần.
- Điều kiện: `Event.status = PUBLISHED` và `startTime` trong tương lai.
- Hai mốc gửi:
  - Trước ~1 ngày: 1440–1380 phút.
  - Trước ~30 phút: 30–20 phút.
- Chống gửi trùng: bảng `event_notification_logs` (unique theo `eventId`, `type`).
- Payload OneSignal hiện gửi tới `included_segments: ['All']`.

## Cấu hình môi trường
Thêm vào `.env` (backend):
```
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key
```
Nếu thiếu, service sẽ bỏ qua gửi và ghi log cảnh báo.

## Cách test trên Swagger
Đã có endpoint manual:
- `POST /notifications/test-send` (role admin)
  - Body: `{ "eventId": "<uuid>", "type": "one_day" | "thirty_min" }`
  - Gửi ngay OneSignal cho sự kiện chỉ định, ghi log tránh trùng theo bảng `event_notification_logs`.
Để test tự động qua cron:
1. Đặt event `PUBLISHED` startTime ~25 phút tới (mốc 30 phút) hoặc ~23h55 (mốc 1 ngày).
2. Đợi tối đa 5 phút, xem log server hoặc dashboard OneSignal.

## Hướng dẫn cho Frontend (Web & Mobile)
### Web (OneSignal Web SDK)
1. Cấu hình OneSignal Web Push (site URL, icons) trong dashboard.
2. Nhúng SDK:
   ```html
   <script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" async></script>
   <script>
     window.OneSignal = window.OneSignal || [];
     OneSignal.push(function () {
       OneSignal.init({ appId: 'ONESIGNAL_APP_ID' });
     });
   </script>
   ```
3. Xin permission và đăng ký:
   ```js
   OneSignal.push(async () => {
     await OneSignal.Slidedown.promptPush();
     const userId = await OneSignal.getUserId(); // subscriptionId
     // gửi userId lên backend để map với user (nếu cần gửi đúng đối tượng)
   });
   ```

### Mobile (Expo React Native)
1. Cài SDK OneSignal React Native (đúng platform Expo/bare).
2. Khởi tạo trong app:
   ```js
   import OneSignal from 'react-native-onesignal';
   OneSignal.setAppId('ONESIGNAL_APP_ID');
   OneSignal.promptForPushNotificationsWithUserResponse();
   OneSignal.setNotificationOpenedHandler((event) => {
     // điều hướng đến màn hình sự kiện bằng eventId trong data
   });
   ```
3. Lấy `userId`/`subscriptionId` và gọi API:
   - `POST /notifications/subscriptions` (role: student/staff/admin/event_organizer)
     Body: `{ "subscriptionId": "<onesignal id>", "deviceId": "<optional>" }`
   Backend sẽ lưu hoặc log để gửi đích danh (hiện đang log; có thể mở rộng lưu DB).

### Payload hiện tại (mặc định)
- headings: “Sự kiện sắp diễn ra trong 1 ngày” hoặc “Sự kiện sắp diễn ra trong 30 phút”.
- contents: `title - organizer`.
- data: `{ eventId, type, startTime }`

### Gửi đúng đối tượng (nếu cần)
- Thay `included_segments: ['All']` bằng `include_subscription_ids: [...]` hoặc `filters` sau khi backend lưu mapping `userId -> subscriptionId`.
- Cần API từ frontend đăng ký subscription (gửi subscriptionId và userId).

## Lưu ý
- Bảo đảm server đang chạy với cron (production/staging).
- Kiểm tra log: `Sent OneSignal notification (...)` hoặc lỗi gửi.
- Cửa sổ thời gian hiện tại là ±5–10 phút; muốn thay đổi chỉnh trong `notification.service.ts`.


