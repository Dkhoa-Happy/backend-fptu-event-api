# Hướng dẫn Setup Google OAuth trên Google Cloud Console

## Bước 1: Tạo Project trên Google Cloud Console

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Đăng nhập bằng tài khoản Google của bạn
3. Click vào dropdown project ở thanh trên cùng (hoặc tạo project mới)
4. Click **"New Project"** nếu chưa có project
5. Điền tên project (ví dụ: "FPT Event System")
6. Click **"Create"**

## Bước 2: Bật Google+ API

1. Trong Google Cloud Console, vào **"APIs & Services"** > **"Library"**
2. Tìm kiếm **"Google+ API"** hoặc **"Google Identity Services API"**
3. Click vào API và chọn **"Enable"**

## Bước 3: Tạo OAuth 2.0 Credentials

1. Vào **"APIs & Services"** > **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** ở trên cùng
3. Chọn **"OAuth client ID"**
4. Nếu chưa có OAuth consent screen, bạn sẽ được yêu cầu cấu hình:
   - **User Type**: Chọn **"External"** (cho development) hoặc **"Internal"** (nếu dùng Google Workspace)
   - Click **"CREATE"**
   - Điền thông tin:
     - **App name**: Tên ứng dụng (ví dụ: "FPT Event System")
     - **User support email**: Email hỗ trợ
     - **Developer contact information**: Email của bạn
   - Click **"SAVE AND CONTINUE"**
   - Ở màn hình **Scopes**, click **"SAVE AND CONTINUE"** (có thể bỏ qua)
   - Ở màn hình **Test users**, thêm email test nếu cần, click **"SAVE AND CONTINUE"**
   - Xem lại và click **"BACK TO DASHBOARD"**

5. Quay lại **"Credentials"**, click **"+ CREATE CREDENTIALS"** > **"OAuth client ID"**
6. Chọn **Application type**: **"Web application"**
7. Điền thông tin:
   - **Name**: Tên cho OAuth client (ví dụ: "FPT Event Backend")
   - **Authorized JavaScript origins**:
     - Development: `http://localhost:3000` (hoặc port bạn dùng)
     - Production: `https://yourdomain.com`
   - **Authorized redirect URIs**:
     - Development: `http://localhost:3000/auth/google/callback`
     - Production: `https://yourdomain.com/auth/google/callback`
8. Click **"CREATE"**
9. Bạn sẽ thấy popup với **Client ID** và **Client Secret** - **LƯU LẠI** các giá trị này!

## Bước 4: Cấu hình Environment Variables

Thêm các biến môi trường sau vào file `.env` của bạn:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

**Lưu ý:**

- Thay `your_client_id_here` và `your_client_secret_here` bằng giá trị từ bước 3
- Đối với production, thay `http://localhost:3000` bằng domain thực tế của bạn
- Đảm bảo `GOOGLE_CALLBACK_URL` khớp chính xác với **Authorized redirect URIs** đã cấu hình

## Bước 5: Chạy Migration Prisma

Sau khi cập nhật schema, chạy migration để cập nhật database:

```bash
npx prisma migrate dev --name add_google_oauth
```

Hoặc nếu đã có migration:

```bash
npx prisma generate
npx prisma migrate deploy
```

## Bước 6: Test API

1. Khởi động server:

   ```bash
   npm run start:dev
   ```

2. Test endpoint:
   - Mở trình duyệt và truy cập: `http://localhost:3000/auth/google`
   - Bạn sẽ được redirect đến Google để đăng nhập
   - Sau khi đăng nhập, Google sẽ redirect về `/auth/google/callback`
   - API sẽ trả về JWT token

## Lưu ý quan trọng

1. **Security**: Không commit file `.env` lên Git. Thêm vào `.gitignore`
2. **Production**:
   - Sử dụng HTTPS cho production
   - Cập nhật **Authorized redirect URIs** với domain production
   - Cập nhật `GOOGLE_CALLBACK_URL` trong environment variables
3. **OAuth Consent Screen**:
   - Ở chế độ "Testing", chỉ có thể đăng nhập với email đã thêm vào test users
   - Để publish app, cần submit để Google review (cho external users)
4. **Campus**: User đăng nhập bằng Google sẽ được gán vào campus đầu tiên (Active). Bạn có thể cần cập nhật logic này nếu muốn user chọn campus.

## Troubleshooting

- **Error: redirect_uri_mismatch**: Kiểm tra `GOOGLE_CALLBACK_URL` có khớp với **Authorized redirect URIs** không
- **Error: invalid_client**: Kiểm tra `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` đã đúng chưa
- **Error: access_denied**: User chưa được thêm vào test users list (nếu app ở chế độ Testing)
