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
  }) {
    const { email, fullName, status } = params;
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
          : '<p>If you believe this is a mistake, please contact support.</p>'
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
}
