import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type InvitationEmailInput = {
  to: string;
  tenantName: string;
  tenantSlug: string;
  inviterEmail: string;
  role: string;
  token: string;
  expiresAt: Date;
};

@Injectable()
export class InvitationMailService {
  private readonly logger = new Logger(InvitationMailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendInvitationEmail(input: InvitationEmailInput): Promise<boolean> {
    const host = process.env.SMTP_HOST;
    if (!host) {
      this.logger.warn(
        `SMTP_HOST is not configured; invitation email skipped for ${input.to}`,
      );
      return false;
    }

    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<boolean>('SMTP_SECURE', false);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from =
      process.env.SMTP_FROM ??
      process.env.SMTP_USER ??
      'no-reply@docspace.local';

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(user && pass
        ? {
            auth: { user, pass },
          }
        : {}),
    });

    const appBaseUrl =
      process.env.APP_BASE_URL?.trim() || 'http://localhost:5173';
    const inviteUrl = `${appBaseUrl.replace(/\/+$/, '')}/invitations/accept?token=${encodeURIComponent(input.token)}&tenant=${encodeURIComponent(input.tenantSlug)}`;
    const expires = input.expiresAt.toISOString();

    await transporter.sendMail({
      from,
      to: input.to,
      subject: `Invitation to ${input.tenantName} on DocSpace`,
      text: [
        `You were invited to join ${input.tenantName} on DocSpace.`,
        `Role: ${input.role}`,
        `Invited by: ${input.inviterEmail}`,
        `Accept invitation: ${inviteUrl}`,
        `This invitation expires at: ${expires}`,
      ].join('\n'),
      html: `
        <p>You were invited to join <strong>${this.escapeHtml(input.tenantName)}</strong> on DocSpace.</p>
        <p><strong>Role:</strong> ${this.escapeHtml(input.role)}</p>
        <p><strong>Invited by:</strong> ${this.escapeHtml(input.inviterEmail)}</p>
        <p><a href="${inviteUrl}">Accept invitation</a></p>
        <p>This invitation expires at: ${this.escapeHtml(expires)}</p>
      `,
    });

    return true;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
