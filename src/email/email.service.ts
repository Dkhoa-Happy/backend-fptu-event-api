import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { UserStatus } from '@prisma/client';

type SendMailOptions = {
  to: string;
  subject: string;
  html: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT
      ? Number(process.env.SMTP_PORT)
      : undefined;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    this.from = process.env.SMTP_FROM || 'no-reply@example.com';

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP config missing; emails will be logged instead of sent. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.',
      );
      this.transporter = null;
    }
  }

  async send(options: SendMailOptions) {
    if (!this.transporter) {
      this.logger.log(
        `Email (mock): to=${options.to}, subject=${options.subject}\n${options.html}`,
      );
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      ...options,
    });
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
      oldEndTime &&
      newEndTime &&
      oldEndTime.getTime() !== newEndTime.getTime();

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
}
