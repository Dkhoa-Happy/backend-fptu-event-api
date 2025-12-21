import { Injectable, Logger } from '@nestjs/common';
import sgMail from '@sendgrid/mail';
import { UserStatus } from '@prisma/client';

type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly isConfigured: boolean;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@example.com';
    this.fromName = process.env.SENDGRID_FROM_NAME || 'FPT Event Team';

    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.isConfigured = true;
      this.logger.log('SendGrid email service initialized successfully');
    } else {
      this.logger.warn(
        'SENDGRID_API_KEY missing; emails will be logged instead of sent. Set SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME.',
      );
      this.isConfigured = false;
    }
  }

  async send(options: SendMailOptions) {
    if (!this.isConfigured) {
      this.logger.log(
        `Email (mock): to=${options.to}, subject=${options.subject}\n${options.html}`,
      );
      return;
    }

    try {
      const msg = {
        to: options.to,
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject: options.subject,
        html: options.html,
      };

      await sgMail.send(msg);
      this.logger.log(`Email sent successfully to ${options.to}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error?.message || String(error)}`,
      );
      // Don't throw error to prevent breaking the flow, just log it
      // If you want to throw, uncomment the line below
      // throw error;
    }
  }

  async sendUserApprovalEmail(params: {
    email: string;
    fullName: string;
    status: UserStatus;
    reason?: string;
  }) {
    const { email, fullName, status, reason } = params;
    const isApproved = status === UserStatus.APPROVED;
    const subject = isApproved
      ? 'Your account has been approved'
      : 'Your account has been rejected';

    const html = `
      <p>Hi ${fullName || 'there'},</p>
      <p>Your account has been <strong>${status}</strong> by admin.</p>
      ${
        isApproved
          ? '<p>You can now sign in and start using the system.</p>'
          : `<p>Lý do từ chối: <strong>${reason || 'Không được cung cấp'}</strong></p>
             <p>Nếu cần hỗ trợ, vui lòng liên hệ bộ phận hỗ trợ.</p>`
      }
      <p>Regards,<br/>FPT Event Team</p>
    `;

    await this.send({
      to: email,
      subject,
      html,
    });
  }

  async sendUserPendingEmail(params: { email: string; fullName: string }) {
    const { email, fullName } = params;
    const html = `
      <p>Hi ${fullName || 'there'},</p>
      <p>We received your registration and your account is <strong>PENDING</strong> approval.</p>
      <p>Please wait for an admin to review your submission. You will receive another email once it is approved or rejected.</p>
      <p>Regards,<br/>FPT Event Team</p>
    `;

    await this.send({
      to: email,
      subject: 'Your account is pending approval',
      html,
    });
  }

  async sendEventCancellationEmail(params: {
    email: string;
    fullName: string;
    eventTitle: string;
    eventStartTime?: Date;
  }) {
    const { email, fullName, eventTitle, eventStartTime } = params;
    const startTimeStr = eventStartTime
      ? new Date(eventStartTime).toLocaleString('vi-VN', {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Thông báo hủy sự kiện</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Chúng tôi rất tiếc phải thông báo rằng sự kiện bạn đã đăng ký đã bị hủy:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1976d2;">${eventTitle}</h3>
          ${startTimeStr ? `<p><strong>Thời gian dự kiến:</strong> ${startTimeStr}</p>` : ''}
        </div>
        <p><strong>Vé của bạn đã được tự động hủy.</strong></p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với bộ phận hỗ trợ.</p>
        <p>Chúng tôi xin lỗi vì sự bất tiện này.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject: `Sự kiện "${eventTitle}" đã bị hủy`,
      html,
    });
  }

  async sendEventTimeChangeEmail(params: {
    email: string;
    fullName: string;
    eventTitle: string;
    oldStartTime?: Date;
    newStartTime?: Date;
    oldEndTime?: Date;
    newEndTime?: Date;
  }) {
    const {
      email,
      fullName,
      eventTitle,
      oldStartTime,
      newStartTime,
      oldEndTime,
      newEndTime,
    } = params;

    const formatDateTime = (date?: Date) => {
      if (!date) return '';
      return new Date(date).toLocaleString('vi-VN', {
        dateStyle: 'full',
        timeStyle: 'short',
      });
    };

    const oldStartStr = formatDateTime(oldStartTime);
    const newStartStr = formatDateTime(newStartTime);
    const oldEndStr = formatDateTime(oldEndTime);
    const newEndStr = formatDateTime(newEndTime);

    const hasStartTimeChange =
      oldStartTime &&
      newStartTime &&
      oldStartTime.getTime() !== newStartTime.getTime();
    const hasEndTimeChange =
      oldEndTime && newEndTime && oldEndTime.getTime() !== newEndTime.getTime();

    let timeChangeDetails = '';
    if (hasStartTimeChange && hasEndTimeChange) {
      timeChangeDetails = `
        <div style="margin: 15px 0;">
          <p><strong>Thời gian bắt đầu:</strong></p>
          <p style="color: #d32f2f; text-decoration: line-through;">Cũ: ${oldStartStr}</p>
          <p style="color: #2e7d32; font-weight: bold;">Mới: ${newStartStr}</p>
        </div>
        <div style="margin: 15px 0;">
          <p><strong>Thời gian kết thúc:</strong></p>
          <p style="color: #d32f2f; text-decoration: line-through;">Cũ: ${oldEndStr}</p>
          <p style="color: #2e7d32; font-weight: bold;">Mới: ${newEndStr}</p>
        </div>
      `;
    } else if (hasStartTimeChange) {
      timeChangeDetails = `
        <div style="margin: 15px 0;">
          <p><strong>Thời gian bắt đầu:</strong></p>
          <p style="color: #d32f2f; text-decoration: line-through;">Cũ: ${oldStartStr}</p>
          <p style="color: #2e7d32; font-weight: bold;">Mới: ${newStartStr}</p>
        </div>
      `;
    } else if (hasEndTimeChange) {
      timeChangeDetails = `
        <div style="margin: 15px 0;">
          <p><strong>Thời gian kết thúc:</strong></p>
          <p style="color: #d32f2f; text-decoration: line-through;">Cũ: ${oldEndStr}</p>
          <p style="color: #2e7d32; font-weight: bold;">Mới: ${newEndStr}</p>
        </div>
      `;
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Thông báo thay đổi thời gian sự kiện</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Chúng tôi xin thông báo rằng thời gian sự kiện bạn đã đăng ký đã được thay đổi:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1976d2;">${eventTitle}</h3>
          ${timeChangeDetails}
        </div>
        <p><strong>Vui lòng lưu ý thời gian mới và sắp xếp thời gian của bạn cho phù hợp.</strong></p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với bộ phận tổ chức sự kiện.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject: `Thông báo thay đổi thời gian: ${eventTitle}`,
      html,
    });
  }

  async sendPasswordResetOtp(params: {
    email: string;
    fullName: string;
    otp: string;
  }) {
    const { email, fullName, otp } = params;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Mã OTP đặt lại mật khẩu</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Bạn đã yêu cầu đặt lại mật khẩu cho tài khoản của mình.</p>
        <p>Vui lòng sử dụng mã OTP sau để xác nhận và đặt lại mật khẩu:</p>
        <div style="text-align: center; margin: 30px 0;">
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; display: inline-block;">
            <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1976d2; margin: 0;">
              ${otp}
            </p>
          </div>
        </div>
        <p><strong>Lưu ý:</strong></p>
        <ul style="color: #666;">
          <li>Mã OTP này sẽ hết hạn sau <strong>10 phút</strong>.</li>
          <li>Không chia sẻ mã OTP này với bất kỳ ai.</li>
          <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</li>
        </ul>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject: 'Mã OTP đặt lại mật khẩu - FPT Event System',
      html,
    });
  }

  async sendCancellationRequestApprovedEmail(params: {
    email: string;
    fullName: string;
    eventTitle: string;
    reason?: string;
  }) {
    const { email, fullName, eventTitle, reason } = params;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2e7d32;">Yêu cầu hủy sự kiện đã được phê duyệt</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Yêu cầu hủy sự kiện của bạn đã được admin phê duyệt. Sự kiện đã được hủy thành công.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1976d2;">${eventTitle}</h3>
          ${reason ? `<p><strong>Lý do hủy:</strong> ${reason}</p>` : ''}
        </div>
        <p><strong>Tất cả vé đã được tự động hủy và thông báo đã được gửi đến người tham gia.</strong></p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với bộ phận hỗ trợ.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject: `Yêu cầu hủy sự kiện "${eventTitle}" đã được phê duyệt`,
      html,
    });
  }

  async sendCancellationRequestRejectedEmail(params: {
    email: string;
    fullName: string;
    eventTitle: string;
    reason: string;
    adminNote?: string;
  }) {
    const { email, fullName, eventTitle, reason, adminNote } = params;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d32f2f;">Yêu cầu hủy sự kiện bị từ chối</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Rất tiếc, yêu cầu hủy sự kiện của bạn đã bị admin từ chối.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1976d2;">${eventTitle}</h3>
          <p><strong>Lý do bạn yêu cầu hủy:</strong> ${reason}</p>
          ${adminNote ? `<p><strong>Ghi chú từ admin:</strong> ${adminNote}</p>` : ''}
        </div>
        <p><strong>Sự kiện vẫn sẽ diễn ra như dự kiến.</strong></p>
        <p>Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với bộ phận hỗ trợ.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject: `Yêu cầu hủy sự kiện "${eventTitle}" bị từ chối`,
      html,
    });
  }

  /**
   * Gửi email thông tin tài khoản cho staff khi được tạo bởi organizer/admin
   */
  async sendAccountCreatedEmail(params: {
    email: string;
    password: string;
    roleName?: string;
    fullName?: string;
  }) {
    const { email, password, roleName, fullName } = params;
    const subject = 'Thông tin tài khoản của bạn';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Chào mừng đến với FPT Event System</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Tài khoản${roleName ? ` (${roleName})` : ''} của bạn đã được tạo thành công. Dưới đây là thông tin đăng nhập:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Email đăng nhập:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 3px;">${email}</code></p>
          <p style="margin: 10px 0;"><strong>Mật khẩu:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 3px;">${password}</code></p>
        </div>
        <p><strong>⚠️ Lưu ý quan trọng:</strong></p>
        <ul>
          <li>Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên để bảo mật tài khoản</li>
          <li>Không chia sẻ thông tin đăng nhập với người khác</li>
          <li>Nếu bạn không yêu cầu tài khoản này, vui lòng liên hệ bộ phận hỗ trợ ngay lập tức</li>
        </ul>
        <p>Bạn có thể đăng nhập tại: <a href="${process.env.FRONTEND_URL || 'https://your-frontend-url.com'}/login" style="color: #1976d2;">Đăng nhập</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject,
      html,
    });
  }

  async sendOrganizerRequestSubmittedUser(params: {
    email: string;
    fullName: string;
    organizerName: string;
  }) {
    const { email, fullName, organizerName } = params;
    const subject = 'Đã nhận yêu cầu trở thành Organizer';
    const html = `
      <p>Chào ${fullName || 'bạn'},</p>
      <p>Chúng tôi đã nhận được yêu cầu trở thành Organizer cho <strong>${organizerName}</strong>.</p>
      <p>Admin sẽ xem xét và phản hồi trong thời gian sớm nhất.</p>
      <p>Cảm ơn bạn đã đóng góp cho cộng đồng.</p>
      <p>Trân trọng,<br/>FPT Event Team</p>
    `;

    await this.send({ to: email, subject, html });
  }

  async sendOrganizerRequestSubmittedAdmin(params: {
    email: string;
    requesterName: string;
    organizerName: string;
  }) {
    const { email, requesterName, organizerName } = params;
    const subject = 'Yêu cầu mới: Student muốn trở thành Organizer';
    const html = `
      <p>Chào admin,</p>
      <p><strong>${requesterName}</strong> vừa gửi yêu cầu trở thành Organizer cho <strong>${organizerName}</strong>.</p>
      <p>Vui lòng truy cập trang quản trị để duyệt yêu cầu.</p>
      <p>Trân trọng,<br/>FPT Event Team</p>
    `;

    await this.send({ to: email, subject, html });
  }

  async sendOrganizerRequestApproved(params: {
    email: string;
    fullName: string;
    organizerName: string;
  }) {
    const { email, fullName, organizerName } = params;
    const subject = 'Yêu cầu Organizer đã được phê duyệt';
    const html = `
      <p>Chào ${fullName || 'bạn'},</p>
      <p>Yêu cầu trở thành Organizer của bạn cho <strong>${organizerName}</strong> đã được <strong>PHÊ DUYỆT</strong>.</p>
      <p>Tài khoản của bạn đã được nâng lên <strong>event_organizer</strong>. Bạn có thể bắt đầu tạo và quản lý sự kiện.</p>
      <p>Trân trọng,<br/>FPT Event Team</p>
    `;

    await this.send({ to: email, subject, html });
  }

  async sendOrganizerRequestRejected(params: {
    email: string;
    fullName: string;
    organizerName: string;
    reason?: string;
  }) {
    const { email, fullName, organizerName, reason } = params;
    const subject = 'Yêu cầu Organizer bị từ chối';
    const html = `
      <p>Chào ${fullName || 'bạn'},</p>
      <p>Rất tiếc, yêu cầu trở thành Organizer cho <strong>${organizerName}</strong> đã bị <strong>TỪ CHỐI</strong>.</p>
      ${reason ? `<p>Lý do: <strong>${reason}</strong></p>` : ''}
      <p>Nếu cần bổ sung hồ sơ, bạn có thể gửi lại yêu cầu mới.</p>
      <p>Trân trọng,<br/>FPT Event Team</p>
    `;

    await this.send({ to: email, subject, html });
  }

  /**
   * Legacy: chỉ cho staff, giữ lại cho tương thích
   */
  async sendStaffAccountEmail(params: {
    email: string;
    password: string;
    fullName?: string;
  }) {
    const { email, password, fullName } = params;
    const subject = 'Thông tin tài khoản Staff của bạn';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Chào mừng đến với FPT Event System</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Tài khoản Staff của bạn đã được tạo thành công. Dưới đây là thông tin đăng nhập:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 10px 0;"><strong>Email đăng nhập:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 3px;">${email}</code></p>
          <p style="margin: 10px 0;"><strong>Mật khẩu:</strong> <code style="background-color: #fff; padding: 2px 6px; border-radius: 3px;">${password}</code></p>
        </div>
        <p><strong>⚠️ Lưu ý quan trọng:</strong></p>
        <ul>
          <li>Vui lòng đổi mật khẩu sau lần đăng nhập đầu tiên để bảo mật tài khoản</li>
          <li>Không chia sẻ thông tin đăng nhập với người khác</li>
          <li>Nếu bạn không yêu cầu tài khoản này, vui lòng liên hệ bộ phận hỗ trợ ngay lập tức</li>
        </ul>
        <p>Bạn có thể đăng nhập tại: <a href="${process.env.FRONTEND_URL || 'https://your-frontend-url.com'}/login" style="color: #1976d2;">Đăng nhập</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Thông báo khi tài khoản hiện có được nâng quyền lên Staff (không gửi mật khẩu)
   */
  async sendStaffRoleUpgradedEmail(params: {
    email: string;
    fullName?: string;
    organizerName?: string;
  }) {
    const { email, fullName, organizerName } = params;
    const subject = 'Tài khoản của bạn đã được nâng quyền Staff';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Tài khoản được nâng quyền</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Tài khoản của bạn trên hệ thống <strong>FPT Event System</strong> đã được nâng quyền thành <strong>Staff</strong>${
          organizerName
            ? ` cho CLB/Organizer <strong>${organizerName}</strong>`
            : ''
        }.</p>
        <p>Bạn có thể đăng nhập và sử dụng các chức năng dành cho Staff trên hệ thống.</p>
        <p>Nếu bạn không mong đợi thay đổi này, vui lòng liên hệ bộ phận hỗ trợ.</p>
        <p>Bạn có thể đăng nhập tại: <a href="${
          process.env.FRONTEND_URL || 'https://your-frontend-url.com'
        }/login" style="color: #1976d2;">Đăng nhập</a></p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject,
      html,
    });
  }

  /**
   * Gửi email thông báo cho staff khi được assign vào event
   */
  async sendStaffAssignedEmail(params: {
    email: string;
    fullName: string;
    eventTitle: string;
    eventStartTime: Date;
    eventEndTime: Date;
    organizerName?: string;
    venueName?: string;
    venueLocation?: string;
  }) {
    const {
      email,
      fullName,
      eventTitle,
      eventStartTime,
      eventEndTime,
      organizerName,
      venueName,
      venueLocation,
    } = params;
    const startTimeStr = new Date(eventStartTime).toLocaleString('vi-VN', {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    const endTimeStr = new Date(eventEndTime).toLocaleString('vi-VN', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const subject = `Bạn đã được phân công làm staff cho sự kiện: ${eventTitle}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Thông báo phân công Staff</h2>
        <p>Xin chào ${fullName || 'bạn'},</p>
        <p>Bạn đã được phân công làm staff cho sự kiện sau:</p>
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1976d2;">${eventTitle}</h3>
          <p><strong>Thời gian bắt đầu:</strong> ${startTimeStr}</p>
          <p><strong>Thời gian kết thúc:</strong> ${endTimeStr}</p>
          ${organizerName ? `<p><strong>Organizer:</strong> ${organizerName}</p>` : ''}
          ${venueName ? `<p><strong>Địa điểm:</strong> ${venueName}${venueLocation ? ` - ${venueLocation}` : ''}</p>` : ''}
        </div>
        <p><strong>Nhiệm vụ của bạn:</strong></p>
        <ul>
          <li>Thực hiện check-in cho người tham dự bằng cách quét mã QR</li>
          <li>Hỗ trợ check-in thủ công khi cần thiết</li>
          <li>Có mặt tại địa điểm sự kiện trước thời gian bắt đầu ít nhất 30 phút</li>
        </ul>
        <p>Vui lòng kiểm tra thông tin sự kiện và chuẩn bị sẵn sàng cho nhiệm vụ của mình.</p>
        <p>Nếu có bất kỳ câu hỏi nào, vui lòng liên hệ với organizer hoặc bộ phận hỗ trợ.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">
          Trân trọng,<br/>
          <strong>FPT Event Team</strong>
        </p>
      </div>
    `;

    await this.send({
      to: email,
      subject,
      html,
    });
  }
}
