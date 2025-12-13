# SendGrid Email Setup

Hệ thống sử dụng SendGrid để gửi email thay vì SMTP để tương thích với Railway và các platform cloud khác.

## Tại sao dùng SendGrid?

- Railway và nhiều cloud platforms chặn SMTP ports (465, 587) trên các gói miễn phí/hobby
- SendGrid sử dụng HTTP API, không cần SMTP ports
- Dễ dàng tích hợp và cấu hình
- Có gói miễn phí với 100 emails/ngày (forever free)

## Cài đặt

### 1. Tạo tài khoản SendGrid

1. Truy cập [https://sendgrid.com](https://sendgrid.com)
2. Đăng ký tài khoản miễn phí (Free plan)
3. Xác thực email của bạn

### 2. Lấy API Key

1. Đăng nhập vào SendGrid Dashboard
2. Vào **Settings** → API Keys**
3. Click **Create API Key**
4. Đặt tên cho API Key (ví dụ: "FPT Event System")
5. Chọn quyền **Full Access** hoặc **Restricted Access** với quyền **Mail Send**
6. Click **Create & View**
7. **Copy API Key ngay** (chỉ hiển thị 1 lần, lưu lại ngay!)

### 3. Xác thực Sender Email (Single Sender Verification)

Để gửi email từ email của bạn:

1. Vào **Settings → Sender Authentication → Single Sender Verification**
2. Click **Create a Sender**
3. Điền thông tin:
   - **From Email**: Email bạn muốn dùng (ví dụ: `noreply@yourdomain.com`)
   - **From Name**: Tên hiển thị (ví dụ: "FPT Event Team")
   - **Reply To**: Email nhận reply (có thể giống From Email)
   - **Company Address**: Địa chỉ công ty
4. Click **Create**
5. Kiểm tra email và click link xác thực trong email SendGrid gửi đến

**Lưu ý**: 
- Email phải được xác thực trước khi có thể gửi
- Nếu dùng domain riêng, nên dùng Domain Authentication (xem bước 4)

### 4. Domain Authentication (Optional nhưng khuyến nghị cho production)

Để gửi email từ domain của bạn (ví dụ: `noreply@yourdomain.com`):

1. Vào **Settings → Sender Authentication → Domain Authentication**
2. Click **Authenticate Your Domain**
3. Chọn DNS provider của bạn hoặc chọn "Other"
4. Thêm DNS records theo hướng dẫn của SendGrid
5. Chờ xác thực (thường mất vài phút đến vài giờ)

**Lợi ích Domain Authentication:**
- Gửi email từ bất kỳ email nào trong domain (không cần verify từng email)
- Tăng reputation và deliverability
- Phù hợp cho production

### 5. Cấu hình Environment Variables

Thêm các biến môi trường sau vào `.env` hoặc Railway environment variables:

```env
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=FPT Event Team
```

**Giải thích:**
- `SENDGRID_API_KEY`: API Key từ SendGrid Dashboard (bắt buộc)
- `SENDGRID_FROM_EMAIL`: Email người gửi (phải là email đã xác thực trong SendGrid)
- `SENDGRID_FROM_NAME`: Tên hiển thị của người gửi (optional, mặc định: "FPT Event Team")

### 6. Railway Environment Variables

Nếu deploy trên Railway:

1. Vào project trên Railway Dashboard
2. Chọn service của bạn
3. Vào tab **Variables**
4. Thêm các biến:
   - `SENDGRID_API_KEY`: API key từ SendGrid
   - `SENDGRID_FROM_EMAIL`: Email người gửi (đã xác thực)
   - `SENDGRID_FROM_NAME`: Tên người gửi (optional)

## Các loại email được gửi

Hệ thống tự động gửi các email sau:

### 1. User Approval Email
- **Khi**: Admin approve/reject user account
- **Gửi đến**: User đã đăng ký
- **Subject**: "Your account has been approved/rejected"

### 2. User Pending Email
- **Khi**: User đăng ký thành công
- **Gửi đến**: User mới đăng ký
- **Subject**: "Your account is pending approval"

### 3. Event Cancellation Email
- **Khi**: Sự kiện bị hủy (admin hoặc organizer)
- **Gửi đến**: Tất cả users đã đăng ký sự kiện
- **Subject**: "Sự kiện [Tên] đã bị hủy"
- **Kèm theo**: Push notification

### 4. Event Time Change Email
- **Khi**: Organizer thay đổi thời gian sự kiện (startTime/endTime)
- **Gửi đến**: Tất cả users đã đăng ký sự kiện
- **Subject**: "Thông báo thay đổi thời gian: [Tên sự kiện]"
- **Kèm theo**: Push notification

## Testing

### Test trong development

1. Thêm các biến môi trường vào `.env`
2. Khởi động server: `npm run start:dev`
3. Kiểm tra log: Nếu thấy "SendGrid email service initialized successfully" là OK
4. Test gửi email bằng cách:
   - Approve/reject một user
   - Hủy một sự kiện
   - Thay đổi thời gian sự kiện

### Test trên Railway

1. Đảm bảo đã thêm environment variables trên Railway
2. Deploy lại service
3. Kiểm tra logs trên Railway để xem email có được gửi không
4. Kiểm tra SendGrid Dashboard → **Activity** để xem email đã gửi

## Troubleshooting

### Email không được gửi

1. **Kiểm tra API Key:**
   - Đảm bảo API Key đúng và còn hiệu lực
   - Kiểm tra trong SendGrid Dashboard → **Settings → API Keys**
   - Đảm bảo API Key có quyền "Mail Send"

2. **Kiểm tra Sender Email:**
   - Email phải được xác thực trong SendGrid
   - Vào **Settings → Sender Authentication → Single Sender Verification**
   - Đảm bảo email có status "Verified"

3. **Kiểm tra Logs:**
   - Xem log server để biết lỗi cụ thể
   - Nếu thấy "Email (mock): ..." nghĩa là chưa có SENDGRID_API_KEY

4. **Kiểm tra SendGrid Dashboard:**
   - Vào **Activity** để xem email đã gửi
   - Vào **Suppressions** để xem email bị block (nếu có)
   - Vào **Email API → Activity Feed** để xem chi tiết

### Lỗi thường gặp

1. **"Forbidden" hoặc "401 Unauthorized"**
   - API Key không đúng hoặc đã bị xóa
   - Kiểm tra lại API Key trong `.env` hoặc Railway variables
   - Đảm bảo không có khoảng trắng thừa

2. **"The from address does not match a verified Sender Identity"**
   - Email trong `SENDGRID_FROM_EMAIL` chưa được xác thực
   - Vào SendGrid Dashboard → **Settings → Sender Authentication** để xác thực

3. **"Daily sending limit exceeded"**
   - Gói miễn phí có giới hạn 100 emails/ngày
   - Nâng cấp gói hoặc đợi reset vào ngày hôm sau

4. **"Email address is on suppression list"**
   - Email đã bị block (bounce, spam, unsubscribe)
   - Vào **Suppressions** để xem và xóa nếu cần

## Giới hạn gói miễn phí

- **100 emails/ngày** (forever free)
- **Unlimited contacts**
- **Email support**
- **Basic analytics**

Nếu cần gửi nhiều hơn, có thể nâng cấp:
- **Essentials**: $19.95/tháng - 50,000 emails/tháng
- **Pro**: $89.95/tháng - 100,000 emails/tháng

## Migration từ SMTP

Nếu bạn đang dùng SMTP (nodemailer) và muốn chuyển sang SendGrid:

1. ✅ Đã cài đặt `@sendgrid/mail` package
2. ✅ Đã cập nhật `EmailService` để dùng SendGrid API
3. ⚠️ Cần thay đổi environment variables:
   - Xóa: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
   - Thêm: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`
4. ✅ Code không cần thay đổi, interface vẫn giữ nguyên

## Tài liệu tham khảo

- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference)
- [SendGrid Node.js Library](https://github.com/sendgrid/sendgrid-nodejs)
- [SendGrid Dashboard](https://app.sendgrid.com/)
- [SendGrid Best Practices](https://docs.sendgrid.com/ui/sending-email/getting-started-with-the-sendgrid-api)

