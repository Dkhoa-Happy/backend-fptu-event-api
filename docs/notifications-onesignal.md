# Thông báo sự kiện (OneSignal)

## 📋 Tổng quan các Notification Types

| Type | Mô tả | Gửi đến | Data Fields | Kèm Email |
|------|-------|---------|-------------|-----------|
| `staff_assigned` | Staff được assign vào event | Staff được assign | `eventId`, `startTime`, `endTime` | ❌ |
| `event_created` | Event được tạo thành công | Organizer owner | `eventId`, `status` | ❌ |
| `event_approved` | Event được admin approve | Organizer owner | `eventId`, `status` | ❌ |
| `event_rejected` | Event bị admin reject | Organizer owner | `eventId`, `status` | ❌ |
| `event_cancelled` | Event bị hủy (đã PUBLISHED) | Tất cả users đã đăng ký | `eventId`, `title` | ✅ |
| `event_time_changed` | Thời gian event thay đổi | Tất cả users đã đăng ký | `eventId`, `title` | ✅ |
| `one_day` | Event sắp diễn ra trong 1 ngày | Tất cả users (đã subscribe) | `eventId`, `startTime` | ❌ |
| `thirty_min` | Event sắp diễn ra trong 30 phút | Tất cả users (đã subscribe) | `eventId`, `startTime` | ❌ |
| `incident_reported` | Staff báo cáo sự cố | Admin + Organizer owner | `eventId`, `incidentId`, `severity`, `reporterName` | ❌ |

## Các loại thông báo

Hệ thống hỗ trợ các loại thông báo sau:

### 1. Thông báo tự động theo lịch (Scheduled Notifications)

- **Cron**: Chạy 5 phút một lần
- **Điều kiện**: `Event.status = PUBLISHED` và `startTime` trong tương lai
- **Hai mốc gửi**:
  - Trước ~1 ngày: 1440–1380 phút
  - Trước ~30 phút: 30–20 phút
- **Chống gửi trùng**: Bảng `event_notification_logs` (unique theo `eventId`, `type`)
- **Gửi đến**: Tất cả users đã đăng ký subscription

### 2. Thông báo khi Staff được assign vào event

- **Trigger**: Khi event organizer assign staff vào event
- **Gửi đến**: Chỉ staff được assign (đích danh)
- **Type**: `staff_assigned`

### 3. Thông báo khi Organizer tạo event

- **Trigger**: Khi organizer tạo event thành công
- **Gửi đến**: Organizer owner (người tạo event)
- **Type**: `event_created`
- **Nội dung**: "Sự kiện của bạn đã được tạo thành công - đang chờ admin phê duyệt"

### 4. Thông báo khi Admin approve event

- **Trigger**: Khi admin approve event (PENDING → PUBLISHED)
- **Gửi đến**: Organizer owner
- **Type**: `event_approved`
- **Nội dung**: "Sự kiện của bạn đã được phê duyệt - đã được công bố"

### 5. Thông báo khi Admin reject event

- **Trigger**: Khi admin reject event (PENDING → CANCELED)
- **Gửi đến**: Organizer owner
- **Type**: `event_rejected`
- **Nội dung**: "Sự kiện của bạn đã bị từ chối"

### 6. Thông báo khi sự kiện bị hủy

- **Trigger**: Khi admin hoặc organizer hủy sự kiện đã PUBLISHED
- **Gửi đến**: Tất cả users đã đăng ký sự kiện (có ticket VALID)
- **Type**: `event_cancelled`
- **Nội dung**: "Sự kiện [tên] đã bị hủy. Vé của bạn đã được tự động hủy."
- **Lưu ý**: Kèm theo email thông báo chi tiết

### 7. Thông báo khi thời gian sự kiện thay đổi

- **Trigger**: Khi organizer thay đổi startTime hoặc endTime của sự kiện đã PUBLISHED
- **Gửi đến**: Tất cả users đã đăng ký sự kiện (có ticket VALID)
- **Type**: `event_time_changed`
- **Nội dung**: "Sự kiện [tên] đã thay đổi thời gian (thời gian bắt đầu/kết thúc). Vui lòng kiểm tra email để biết chi tiết."
- **Lưu ý**: Kèm theo email thông báo chi tiết với thời gian cũ và mới

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

## Hướng dẫn tích hợp OneSignal cho Frontend

### Bước 1: Lấy OneSignal App ID

- Lấy `ONESIGNAL_APP_ID` từ backend team hoặc OneSignal Dashboard
- App ID này cần được cấu hình ở cả frontend và backend

---

## 📱 Web Application (React/Vue/Angular/HTML)

### 1. Cài đặt OneSignal Web SDK

#### Cách 1: Sử dụng CDN (HTML/vanilla JS)

Thêm vào file `index.html` hoặc `<head>`:

```html
<script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" async></script>
```

#### Cách 2: Sử dụng npm (React/Vue/Angular)

```bash
npm install react-onesignal
# hoặc
npm install @onesignal/onesignal-sdk-web
```

### 2. Khởi tạo OneSignal trong ứng dụng

#### React Example:

```jsx
import { useEffect } from 'react';
import OneSignal from 'react-onesignal';

function App() {
  useEffect(() => {
    // Khởi tạo OneSignal
    OneSignal.init({
      appId: 'YOUR_ONESIGNAL_APP_ID', // Lấy từ backend team
      notifyButton: {
        enable: true, // Hiển thị nút subscribe
      },
      allowLocalhostAsSecureOrigin: true, // Cho phép localhost (dev only)
    });

    // Xin quyền thông báo
    OneSignal.showSlidedownPrompt();

    // Xử lý khi user click vào notification
    OneSignal.addClickListener((event) => {
      const data = event.notification.additionalData;
      if (data?.eventId) {
        // Điều hướng đến trang chi tiết event
        window.location.href = `/events/${data.eventId}`;
      }
    });

    // Lắng nghe khi subscription ID thay đổi (khi user cho phép notification)
    OneSignal.on('subscriptionChange', (isSubscribed) => {
      if (isSubscribed) {
        // User đã cho phép notification, lấy subscription ID
        OneSignal.getUserId().then((userId) => {
          if (userId) {
            registerSubscription(userId);
          }
        });
      }
    });

    // Kiểm tra xem user đã subscribe chưa (nếu đã subscribe từ trước)
    OneSignal.isPushNotificationsEnabled((isEnabled) => {
      if (isEnabled) {
        OneSignal.getUserId().then((userId) => {
          if (userId) {
            registerSubscription(userId);
          }
        });
      }
    });
  }, []);

  // Hàm đăng ký subscription với backend
  const registerSubscription = async (subscriptionId) => {
    try {
      const token = localStorage.getItem('accessToken'); // Lấy token từ storage

      // Lấy deviceId (optional) - có thể dùng user agent hoặc browser fingerprint
      const deviceId = navigator.userAgent; // Hoặc có thể tạo unique device ID

      const response = await fetch(
        'http://localhost:8080/notifications/subscriptions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subscriptionId: subscriptionId, // Bắt buộc: OneSignal Player ID
            deviceId: deviceId, // Optional: có thể bỏ qua hoặc dùng navigator.userAgent
          }),
        },
      );

      if (response.ok) {
        console.log('Subscription registered successfully');
      } else {
        const error = await response.json();
        console.error('Failed to register subscription:', error);
      }
    } catch (error) {
      console.error('Failed to register subscription:', error);
    }
  };

  return <div>Your App Content</div>;
}
```

#### Vue.js Example:

```vue
<template>
  <div id="app">
    <!-- Your app content -->
  </div>
</template>

<script>
import OneSignal from '@onesignal/onesignal-sdk-web';

export default {
  name: 'App',
  mounted() {
    // Khởi tạo OneSignal
    OneSignal.init({
      appId: 'YOUR_ONESIGNAL_APP_ID',
    });

    // Xin quyền
    OneSignal.showSlidedownPrompt();

    // Lấy subscription ID
    OneSignal.getUserId().then((userId) => {
      if (userId) {
        this.registerSubscription(userId);
      }
    });

    // Xử lý click notification
    OneSignal.addClickListener((event) => {
      const data = event.notification.additionalData;
      if (data?.eventId) {
        this.$router.push(`/events/${data.eventId}`);
      }
    });
  },
  methods: {
    async registerSubscription(subscriptionId) {
      try {
        const token = this.$store.state.auth.token; // Lấy token từ Vuex/store
        await this.$http.post(
          '/notifications/subscriptions',
          {
            subscriptionId: subscriptionId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );
        console.log('Subscription registered');
      } catch (error) {
        console.error('Failed to register subscription:', error);
      }
    },
  },
};
</script>
```

#### Vanilla JavaScript/HTML Example:

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" async></script>
  </head>
  <body>
    <script>
      window.OneSignal = window.OneSignal || [];
      OneSignal.push(function () {
        OneSignal.init({
          appId: 'YOUR_ONESIGNAL_APP_ID',
        });

        // Xin quyền thông báo
        OneSignal.showSlidedownPrompt();

        // Lắng nghe khi subscription thay đổi (khi user cho phép)
        OneSignal.on('subscriptionChange', function (isSubscribed) {
          if (isSubscribed) {
            OneSignal.getUserId().then(function (userId) {
              if (userId) {
                registerSubscription(userId);
              }
            });
          }
        });

        // Kiểm tra xem đã subscribe chưa (nếu đã subscribe từ trước)
        OneSignal.isPushNotificationsEnabled(function (isEnabled) {
          if (isEnabled) {
            OneSignal.getUserId().then(function (userId) {
              if (userId) {
                registerSubscription(userId);
              }
            });
          }
        });

        // Xử lý khi click notification
        OneSignal.addClickListener(function (event) {
          const data = event.notification.additionalData;
          if (data && data.eventId) {
            window.location.href = '/events/' + data.eventId;
          }
        });
      });

      // Đăng ký subscription với backend
      async function registerSubscription(subscriptionId) {
        try {
          const token = localStorage.getItem('accessToken');

          // deviceId là optional - có thể dùng user agent hoặc bỏ qua
          const deviceId = navigator.userAgent; // Hoặc có thể tạo unique ID

          const response = await fetch(
            'http://localhost:8080/notifications/subscriptions',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
              },
              body: JSON.stringify({
                subscriptionId: subscriptionId, // Bắt buộc: OneSignal Player ID
                deviceId: deviceId, // Optional: có thể bỏ qua
              }),
            },
          );

          if (response.ok) {
            console.log('Subscription registered successfully');
          } else {
            const error = await response.json();
            console.error('Failed to register:', error);
          }
        } catch (error) {
          console.error('Failed to register:', error);
        }
      }
    </script>
  </body>
</html>
```

---

## 📱 Mobile Application (React Native/Expo)

### 1. Cài đặt OneSignal SDK

#### React Native (Bare):

```bash
npm install react-native-onesignal
cd ios && pod install # iOS only
```

#### Expo:

```bash
npx expo install expo-notifications
npm install react-native-onesignal
```

### 2. Khởi tạo OneSignal trong App

#### React Native Example:

```jsx
import React, { useEffect } from 'react';
import OneSignal from 'react-native-onesignal';
import { Platform } from 'react-native';

function App() {
  useEffect(() => {
    // Khởi tạo OneSignal
    OneSignal.setAppId('YOUR_ONESIGNAL_APP_ID');

    // Xin quyền thông báo
    OneSignal.promptForPushNotificationsWithUserResponse((response) => {
      console.log('Push notification permission:', response);
    });

    // Lấy subscription ID
    OneSignal.getDeviceState().then((deviceState) => {
      if (deviceState?.userId) {
        registerSubscription(deviceState.userId);
      }
    });

    // Xử lý khi notification được mở
    OneSignal.setNotificationOpenedHandler((event) => {
      const data = event.notification.additionalData;
      if (data?.eventId) {
        // Điều hướng đến màn hình event
        navigation.navigate('EventDetail', { eventId: data.eventId });
      }
    });

    // Xử lý khi nhận notification (app đang mở)
    OneSignal.setNotificationWillShowInForegroundHandler((event) => {
      const notification = event.getNotification();
      // Có thể custom notification ở đây
      event.complete(notification);
    });
  }, []);

  // Đăng ký subscription với backend
  const registerSubscription = async (subscriptionId) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      const deviceId =
        Platform.OS === 'ios'
          ? await getDeviceId() // Cần cài thêm package
          : Platform.OS;

      const response = await fetch(
        'http://localhost:8080/notifications/subscriptions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            subscriptionId: subscriptionId,
            deviceId: deviceId,
          }),
        },
      );

      if (response.ok) {
        console.log('Subscription registered');
      }
    } catch (error) {
      console.error('Failed to register subscription:', error);
    }
  };

  return <YourAppContent />;
}
```

#### Expo Example:

```jsx
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import OneSignal from 'react-native-onesignal';

// Cấu hình notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function App() {
  useEffect(() => {
    // Khởi tạo OneSignal
    OneSignal.setAppId('YOUR_ONESIGNAL_APP_ID');

    // Xin quyền
    OneSignal.promptForPushNotificationsWithUserResponse();

    // Lấy subscription ID
    OneSignal.getDeviceState().then((deviceState) => {
      if (deviceState?.userId) {
        registerSubscription(deviceState.userId);
      }
    });

    // Xử lý notification opened
    OneSignal.setNotificationOpenedHandler((event) => {
      const data = event.notification.additionalData;
      if (data?.eventId) {
        // Navigate to event
        router.push(`/events/${data.eventId}`);
      }
    });
  }, []);

  const registerSubscription = async (subscriptionId) => {
    // Similar to React Native example above
  };

  return <YourAppContent />;
}
```

---

## 🔔 Xử lý Notification Payload

### Cấu trúc Notification Data:

```json
{
  "eventId": "uuid-of-event",
  "type": "staff_assigned" | "event_created" | "event_approved" | "event_rejected" | "event_cancelled" | "event_time_changed" | "one_day" | "thirty_min" | "incident_reported",
  "startTime": "2025-12-15T09:00:00Z",  // Có trong staff_assigned, one_day, thirty_min
  "endTime": "2025-12-15T17:00:00Z",    // Có trong staff_assigned
  "status": "PENDING" | "PUBLISHED" | "CANCELED",  // Có trong event_created, event_approved, event_rejected
  "title": "Event Title",  // Có trong event_cancelled, event_time_changed
  "incidentId": 123,  // Có trong incident_reported
  "severity": "LOW" | "MEDIUM" | "HIGH",  // Có trong incident_reported
  "reporterName": "Staff Name"  // Có trong incident_reported (optional)
}
```

### Các loại Notification Type:

| Type             | Mô tả                           | Gửi đến           | Data fields                       |
| ---------------- | ------------------------------- | ----------------- | --------------------------------- |
| `staff_assigned` | Staff được assign vào event     | Staff được assign | `eventId`, `startTime`, `endTime` |
| `event_created`  | Event được tạo thành công       | Organizer owner   | `eventId`, `status`               |
| `event_approved` | Event được admin approve        | Organizer owner   | `eventId`, `status`               |
| `event_rejected` | Event bị admin reject           | Organizer owner   | `eventId`, `status`               |
| `event_cancelled` | Event bị hủy (đã PUBLISHED)     | Tất cả users đã đăng ký | `eventId`, `title` |
| `event_time_changed` | Thời gian event thay đổi        | Tất cả users đã đăng ký | `eventId`, `title` |
| `one_day`        | Event sắp diễn ra trong 1 ngày  | Tất cả users      | `eventId`, `startTime`            |
| `thirty_min`     | Event sắp diễn ra trong 30 phút | Tất cả users      | `eventId`, `startTime`            |
| `incident_reported` | Staff báo cáo sự cố trước sự kiện | Admin + Organizer owner | `eventId`, `incidentId`, `severity`, `reporterName` |

### Ví dụ xử lý trong Frontend:

#### Web:

```javascript
OneSignal.addClickListener((event) => {
  const data = event.notification.additionalData;

  switch (data.type) {
    case 'staff_assigned':
      // Thông báo staff được assign
      showToast('Bạn đã được phân công làm staff cho sự kiện');
      navigateToEvent(data.eventId);
      break;

    case 'event_created':
      // Thông báo event được tạo thành công
      showToast('Sự kiện của bạn đã được tạo thành công - đang chờ phê duyệt');
      navigateToEvent(data.eventId);
      break;

    case 'event_approved':
      // Thông báo event được approve
      showToast('Sự kiện của bạn đã được phê duyệt!');
      navigateToEvent(data.eventId);
      break;

    case 'event_rejected':
      // Thông báo event bị reject
      showToast(
        'Sự kiện của bạn đã bị từ chối. Vui lòng kiểm tra lại thông tin.',
      );
      navigateToEvent(data.eventId);
      break;

    case 'incident_reported':
      // Thông báo sự cố mới
      showToast(
        `Báo cáo sự cố mới - Mức độ: ${data.severity || 'MEDIUM'} - ${data.reporterName || ''}`,
      );
      // Điều hướng đến trang quản lý/chi tiết event hoặc incident (tùy FE)
      navigateToEvent(data.eventId);
      break;

    case 'one_day':
      // Thông báo sự kiện sắp diễn ra trong 1 ngày
      showToast('Sự kiện sắp diễn ra trong 1 ngày');
      navigateToEvent(data.eventId);
      break;

    case 'thirty_min':
      // Thông báo sự kiện sắp diễn ra trong 30 phút
      showToast('Sự kiện sắp diễn ra trong 30 phút');
      navigateToEvent(data.eventId);
      break;

    case 'event_cancelled':
      // Thông báo sự kiện bị hủy
      showToast(
        `Sự kiện "${data.title || 'này'}" đã bị hủy. Vé của bạn đã được tự động hủy.`,
        'error',
      );
      // Có thể điều hướng đến trang my-tickets để xem vé đã hủy
      navigateToMyTickets();
      break;

    case 'event_time_changed':
      // Thông báo thời gian sự kiện thay đổi
      showToast(
        `Sự kiện "${data.title || 'này'}" đã thay đổi thời gian. Vui lòng kiểm tra email để biết chi tiết.`,
        'info',
      );
      navigateToEvent(data.eventId);
      break;

    default:
      // Xử lý các type khác hoặc fallback
      if (data?.eventId) {
        navigateToEvent(data.eventId);
      }
  }
});
```

#### Mobile:

```javascript
OneSignal.setNotificationOpenedHandler((event) => {
  const data = event.notification.additionalData;

  if (data?.eventId) {
    // Navigate based on notification type
    switch (data.type) {
      case 'staff_assigned':
        navigation.navigate('StaffEventDetail', { eventId: data.eventId });
        break;

      case 'event_created':
      case 'event_approved':
      case 'event_rejected':
        // Organizer notifications - có thể điều hướng đến màn hình quản lý event
        navigation.navigate('MyEvents', {
          eventId: data.eventId,
          status: data.status,
        });
        break;

      case 'incident_reported':
        // Admin/Organizer: điều hướng đến incident list/detail hoặc event detail
        navigation.navigate('Incidents', {
          eventId: data.eventId,
          incidentId: data.incidentId,
          severity: data.severity,
        });
        break;

      case 'one_day':
      case 'thirty_min':
        // Event reminder - điều hướng đến chi tiết event
        navigation.navigate('EventDetail', { eventId: data.eventId });
        break;

      case 'event_cancelled':
        // Event bị hủy - điều hướng đến trang my tickets
        navigation.navigate('MyTickets', {
          eventId: data.eventId,
          showCancelled: true,
        });
        // Hoặc hiển thị modal thông báo
        showAlert(
          'Sự kiện đã bị hủy',
          `Sự kiện "${data.title || 'này'}" đã bị hủy. Vé của bạn đã được tự động hủy.`,
        );
        break;

      case 'event_time_changed':
        // Thời gian event thay đổi - điều hướng đến chi tiết event
        navigation.navigate('EventDetail', { eventId: data.eventId });
        // Hoặc hiển thị modal thông báo
        showAlert(
          'Thời gian sự kiện đã thay đổi',
          `Sự kiện "${data.title || 'này'}" đã thay đổi thời gian. Vui lòng kiểm tra email để biết chi tiết.`,
        );
        break;

      default:
        navigation.navigate('EventDetail', { eventId: data.eventId });
    }
  }
});
```

---

## 📡 API Endpoint

### Đăng ký Subscription

**Endpoint:** `POST /notifications/subscriptions`

**Headers:**

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body:**

```json
{
  "subscriptionId": "c1a2b3c4-d5e6-7890-1234-abcdefabcdef", // Bắt buộc
  "deviceId": "optional-device-id" // Tùy chọn
}
```

**Response:**

```json
{
  "registered": true
}
```

### 🔑 Cách lấy subscriptionId và deviceId trên Web:

#### 1. Lấy subscriptionId (Bắt buộc):

**subscriptionId** chính là **OneSignal Player ID**, lấy bằng cách:

```javascript
// Cách 1: Sử dụng getUserId() (khuyến nghị)
OneSignal.getUserId().then((userId) => {
  // userId chính là subscriptionId
  console.log('Subscription ID:', userId);
});

// Cách 2: Lắng nghe event khi user cho phép notification
OneSignal.on('subscriptionChange', (isSubscribed) => {
  if (isSubscribed) {
    OneSignal.getUserId().then((userId) => {
      if (userId) {
        console.log('Subscription ID:', userId);
        // Gọi API đăng ký ở đây
      }
    });
  }
});

// Cách 3: Kiểm tra xem đã subscribe chưa
OneSignal.isPushNotificationsEnabled((isEnabled) => {
  if (isEnabled) {
    OneSignal.getUserId().then((userId) => {
      console.log('Subscription ID:', userId);
    });
  }
});
```

**Lưu ý:**

- `subscriptionId` chỉ có sau khi user **cho phép notification**
- Nếu user chưa cho phép, `getUserId()` sẽ trả về `null`
- Cần gọi `OneSignal.showSlidedownPrompt()` trước để xin quyền

#### 2. Lấy deviceId (Tùy chọn):

**deviceId** là optional, có thể:

```javascript
// Option 1: Dùng User Agent (đơn giản nhất)
const deviceId = navigator.userAgent;
// Ví dụ: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."

// Option 2: Tạo unique device ID (lưu trong localStorage)
let deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
  deviceId =
    'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('deviceId', deviceId);
}

// Option 3: Bỏ qua deviceId hoàn toàn (không truyền trong body)
// Vì field này là optional
```

#### 3. Ví dụ đầy đủ - Đăng ký subscription:

```javascript
async function registerOneSignalSubscription() {
  try {
    // Bước 1: Kiểm tra user đã đăng nhập chưa
    const token = localStorage.getItem('accessToken');
    if (!token) {
      console.warn('⚠️ User chưa đăng nhập');
      return;
    }

    // Bước 2: Lấy subscriptionId từ OneSignal
    const subscriptionId = await OneSignal.getUserId();

    if (!subscriptionId) {
      console.warn(
        '⚠️ User chưa cho phép notification hoặc chưa có subscription ID',
      );
      console.log('💡 Hãy gọi OneSignal.showSlidedownPrompt() để xin quyền');
      return;
    }

    console.log('✅ Subscription ID:', subscriptionId);

    // Bước 3: Lấy deviceId (optional)
    const deviceId = navigator.userAgent; // Hoặc tạo unique ID

    // Bước 4: Gọi API đăng ký với backend
    const response = await fetch(
      'http://localhost:8080/notifications/subscriptions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: subscriptionId, // Bắt buộc
          deviceId: deviceId, // Optional - có thể bỏ qua
        }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Subscription registered successfully:', result);
    } else {
      const error = await response.json();
      console.error('❌ Failed to register:', error);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Gọi khi user cho phép notification
OneSignal.on('subscriptionChange', (isSubscribed) => {
  if (isSubscribed) {
    registerOneSignalSubscription();
  }
});

// Hoặc gọi sau khi user đăng nhập (nếu đã cho phép notification trước đó)
// registerOneSignalSubscription();
```

#### 4. Flow đầy đủ từ đầu:

```javascript
// 1. Khởi tạo OneSignal
OneSignal.init({
  appId: 'YOUR_ONESIGNAL_APP_ID',
});

// 2. Xin quyền notification
OneSignal.showSlidedownPrompt();

// 3. Lắng nghe khi user cho phép
OneSignal.on('subscriptionChange', async (isSubscribed) => {
  if (isSubscribed) {
    // 4. Lấy subscriptionId
    const subscriptionId = await OneSignal.getUserId();

    // 5. Đăng ký với backend (sau khi user đăng nhập)
    if (subscriptionId && localStorage.getItem('accessToken')) {
      await registerOneSignalSubscription();
    }
  }
});

// 6. Sau khi user đăng nhập, kiểm tra lại subscription
function onUserLogin() {
  OneSignal.isPushNotificationsEnabled((isEnabled) => {
    if (isEnabled) {
      registerOneSignalSubscription();
    }
  });
}
```

**Lưu ý quan trọng:**

- **subscriptionId**: Bắt buộc - Lấy từ `OneSignal.getUserId()` sau khi user cho phép notification
- **deviceId**: Tùy chọn - Có thể dùng `navigator.userAgent`, tạo unique ID, hoặc bỏ qua
- Cần gọi API này sau khi:
  1. ✅ User đăng nhập thành công (có access token)
  2. ✅ User cho phép notification (có subscriptionId)
- Gọi lại nếu subscription ID thay đổi (user đăng nhập trên thiết bị mới)
- Backend sẽ lưu mapping `userId -> subscriptionId` để gửi notification đích danh

---

## ✅ Checklist tích hợp

### Web:

- [ ] Cài đặt OneSignal SDK
- [ ] Khởi tạo OneSignal với App ID
- [ ] Xin quyền thông báo từ user
- [ ] Lấy subscription ID sau khi user cho phép
- [ ] Gọi API `/notifications/subscriptions` để đăng ký
- [ ] Xử lý click notification để điều hướng đến event
- [ ] Test trên HTTPS (OneSignal yêu cầu HTTPS cho production)

### Mobile:

- [ ] Cài đặt OneSignal SDK
- [ ] Cấu hình permissions trong `AndroidManifest.xml` (Android) và `Info.plist` (iOS)
- [ ] Khởi tạo OneSignal với App ID
- [ ] Xin quyền thông báo
- [ ] Lấy subscription ID
- [ ] Gọi API `/notifications/subscriptions` để đăng ký
- [ ] Xử lý notification opened handler
- [ ] Test trên thiết bị thật (push notification không hoạt động trên simulator)

---

## 🐛 Troubleshooting

### Web:

1. **Không nhận được notification:**
   - Kiểm tra browser có hỗ trợ push notification (Chrome, Firefox, Edge)
   - Đảm bảo site chạy trên HTTPS (hoặc localhost cho dev)
   - Kiểm tra user đã cho phép notification chưa

2. **Subscription ID không lấy được:**
   - Đảm bảo đã gọi `OneSignal.showSlidedownPrompt()` và user đã cho phép
   - Đợi một chút sau khi user cho phép rồi mới lấy ID

### Mobile:

1. **iOS không nhận được notification:**
   - Kiểm tra đã cấu hình APNs certificate trong OneSignal Dashboard
   - Kiểm tra app đã được build với production certificate
   - Test trên thiết bị thật (không phải simulator)

2. **Android không nhận được notification:**
   - Kiểm tra đã cấu hình Firebase Cloud Messaging (FCM) trong OneSignal
   - Kiểm tra `google-services.json` đã được thêm vào project
   - Kiểm tra permissions trong `AndroidManifest.xml`

---

## 📝 Lưu ý quan trọng

1. **App ID:** Lấy từ backend team, không hardcode trong code production
2. **HTTPS Required:** Web app phải chạy trên HTTPS (trừ localhost)
3. **User Permission:** Luôn xin quyền trước khi đăng ký subscription
4. **Re-register:** Nên đăng ký lại subscription mỗi khi user đăng nhập
5. **Error Handling:** Luôn xử lý lỗi khi gọi API đăng ký subscription
6. **Testing:** Test trên thiết bị thật, không chỉ simulator/emulator

## 📧 Email Notifications

Một số thông báo được gửi kèm theo email để cung cấp thông tin chi tiết hơn:

### 1. Email thông báo hủy sự kiện

- **Trigger**: Khi sự kiện bị hủy (kèm theo push notification `event_cancelled`)
- **Gửi đến**: Tất cả users đã đăng ký sự kiện
- **Subject**: `Sự kiện "[Tên sự kiện]" đã bị hủy`
- **Nội dung**: 
  - Thông báo sự kiện đã bị hủy
  - Thời gian dự kiến (nếu có)
  - Thông báo vé đã được tự động hủy
  - Hướng dẫn liên hệ hỗ trợ

### 2. Email thông báo thay đổi thời gian sự kiện

- **Trigger**: Khi organizer thay đổi startTime hoặc endTime (kèm theo push notification `event_time_changed`)
- **Gửi đến**: Tất cả users đã đăng ký sự kiện
- **Subject**: `Thông báo thay đổi thời gian: [Tên sự kiện]`
- **Nội dung**:
  - Hiển thị thời gian cũ (gạch ngang) và thời gian mới (màu xanh, đậm)
  - Hỗ trợ thay đổi startTime, endTime, hoặc cả hai
  - Hướng dẫn sắp xếp lại thời gian

### Lưu ý:

- Email được gửi tự động khi có push notification tương ứng
- Frontend không cần xử lý email, chỉ cần xử lý push notification
- Email cung cấp thông tin chi tiết hơn, push notification chỉ là thông báo nhanh

## 📋 Tóm tắt các Notification Types

### Cho Staff:

- **`staff_assigned`**: Nhận khi được organizer assign vào event làm check-in

### Cho Organizer:

- **`event_created`**: Nhận khi tạo event thành công (status PENDING)
- **`event_approved`**: Nhận khi admin approve event (status PUBLISHED)
- **`event_rejected`**: Nhận khi admin reject event (status CANCELED)

### Cho Tất cả Users đã đăng ký sự kiện:

- **`event_cancelled`**: Nhận khi sự kiện đã đăng ký bị hủy (kèm email)
- **`event_time_changed`**: Nhận khi thời gian sự kiện đã đăng ký thay đổi (kèm email)

### Cho Tất cả Users (đã subscribe OneSignal):

- **`one_day`**: Nhận trước 1 ngày khi event sắp diễn ra
- **`thirty_min`**: Nhận trước 30 phút khi event sắp diễn ra

## Lưu ý

- Bảo đảm server đang chạy với cron (production/staging) để gửi thông báo tự động
- Kiểm tra log: `Sent OneSignal notification (...)` hoặc lỗi gửi
- Cửa sổ thời gian hiện tại là ±5–10 phút; muốn thay đổi chỉnh trong `notification.service.ts`
- **Quan trọng**: User phải đăng ký subscription (`POST /notifications/subscriptions`) trước khi nhận được thông báo đích danh
- Thông báo đích danh (staff_assigned, event_created, etc.) chỉ gửi cho user có subscription trong database
- Thông báo tự động (one_day, thirty_min) gửi cho tất cả users đã subscribe OneSignal
