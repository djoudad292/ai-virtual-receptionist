import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      });
    }
  }

  private get fromName(): string {
    return process.env.MAIL_FROM_NAME || 'AI Virtual Receptionist';
  }

  private get fromEmail(): string {
    return process.env.MAIL_FROM_EMAIL || 'no-reply@receptionist.djaouad.tech';
  }

  async send(mail: MailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `[mail disabled] No SMTP_HOST configured. Would send to=${mail.to} subject="${mail.subject}"\n${mail.text}`,
      );
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send email to ${mail.to}: ${(err as Error).message}`);
      return false;
    }
  }

  buildResetEmail(resetUrl: string, name?: string | null): { subject: string; text: string; html: string } {
    const greeting = name ? `Hi ${name},` : 'Hi there,';
    const subject = 'Reset your AI Virtual Receptionist password';
    const text = `${greeting}\n\nWe received a request to reset your password. Use the link below to choose a new one. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.\n\n— ${this.fromName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
        <h2 style="margin:0 0 12px">${subject}</h2>
        <p>${greeting}</p>
        <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in <strong>1 hour</strong>.</p>
        <p style="margin:24px 0">
          <a href="${resetUrl}" style="background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">Reset password</a>
        </p>
        <p style="font-size:12px;color:#64748b">If the button does not work, copy this link into your browser:<br/><a href="${resetUrl}">${resetUrl}</a></p>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px">If you did not request this, you can safely ignore this email.</p>
      </div>
    `;
    return { subject, text, html };
  }

  buildInviteEmail(loginUrl: string, name: string, email: string, tempPassword: string): { subject: string; text: string; html: string } {
    const subject = 'You\'ve been invited to join the team';
    const text = `Hi ${name},\n\nYou have been invited to join your company's AI Virtual Receptionist team.\n\nSign in here: ${loginUrl}\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nPlease sign in and change your password right away.\n\n— ${this.fromName}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
        <h2 style="margin:0 0 12px">You've been invited</h2>
        <p>Hi ${name},</p>
        <p>You have been invited to join your company's <strong>AI Virtual Receptionist</strong> team.</p>
        <p style="margin:24px 0">
          <a href="${loginUrl}" style="background:#3b82f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;display:inline-block">Sign in</a>
        </p>
        <table style="border-collapse:collapse;font-size:14px;margin:16px 0">
          <tr><td style="padding:6px 12px;color:#64748b">Email</td><td style="padding:6px 12px;font-weight:600">${email}</td></tr>
          <tr><td style="padding:6px 12px;color:#64748b">Temporary password</td><td style="padding:6px 12px;font-weight:600">${tempPassword}</td></tr>
        </table>
        <p style="font-size:12px;color:#64748b">Please sign in and change your password right away.</p>
        <p style="font-size:12px;color:#94a3b8;margin-top:24px">— ${this.fromName}</p>
      </div>
    `;
    return { subject, text, html };
  }
}
