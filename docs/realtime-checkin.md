## Realtime Check-in (Socket.IO)

Hướng dẫn FE nhận dữ liệu check-in thời gian thực khi staff quét QR.

### Endpoint WebSocket

- Namespace: `/checkin`
- Phương thức: Socket.IO
- Room theo event: `event:{eventId}:checkin`

### Sự kiện từ server

- `checkin`: đẩy khi staff quét vé thành công
  - Payload:
    ```json
    {
      "ticketId": "string",
      "eventId": "string",
      "user": {
        "id": number,
        "userName": "string",
        "email": "string",
        "firstName": "string",
        "lastName": "string"
      },
      "status": "USED",
      "checkinTime": "ISO string",
      "handledBy": number
    }
    ```
  - Lưu ý: server **không gửi kèm** `checkinCount`; FE tự cập nhật state (ví dụ tăng `checkinCount` tại chỗ) hoặc refetch nếu muốn số liệu từ server.

### Client usage (React example)

```js
import { io } from 'socket.io-client';

const socket = io(`${API_BASE}/checkin`, { transports: ['websocket'] });

// 1) Join room theo eventId
socket.emit('joinEvent', { eventId });

// 2) Lắng nghe check-in realtime
socket.on('checkin', (payload) => {
  if (payload.eventId !== eventId) return;
  // TODO: cập nhật UI:
  // - tăng checkinCount trong state
  // - thêm log check-in vào danh sách
});

// 3) Rời room khi không cần
socket.emit('leaveEvent', { eventId });

// 4) Cleanup
socket.off('checkin');
socket.disconnect();
```

### Gợi ý cập nhật UI

- Giữ `checkinCount` trong state; khi nhận `checkin`, `setCheckinCount(c => c + 1)`.
- Thêm dòng check-in mới vào bảng/log hiển thị.
- Nếu cần số liệu chính xác từ server (tránh lệch do reload chậm), refetch event detail sau vài sự kiện hoặc khi mở màn hình.

### Phân quyền

- Server chỉ emit khi staff quét vé thành công (staff phải được assign vào event).
- Client join room không bị hạn chế, nhưng dữ liệu emit chỉ chứa thông tin check-in, không có dữ liệu nhạy cảm khác.

### Khắc phục sự cố

- Không nhận được sự kiện: kiểm tra đúng namespace `/checkin`, đã `joinEvent` với `eventId` hợp lệ.
- Kết nối thất bại: đảm bảo backend bật CORS cho socket, dùng `transports: ['websocket']`.
- Nhận sự kiện trễ: kiểm tra mạng, và đảm bảo không chặn WebSocket (proxy/corporate).
