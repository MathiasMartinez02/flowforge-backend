import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { StepExecutor } from '../engine/step-executor.interface.js';
import { resolveTemplate } from './resolve-template.util.js';

type Transporter = ReturnType<typeof nodemailer.createTransport>;

// Envia un email via SMTP. config: { to, subject, body }. "subject"/"body" soportan placeholders
// {{campo}} contra el output del paso anterior (ver resolve-template.util.ts).
@Injectable()
export class NotificationAction implements StepExecutor {
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async execute(config: Record<string, unknown>, previousOutput: Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const to = String(config.to ?? '');
    if (!to) throw new Error('notification: falta "to" en la config del paso');

    const subject = resolveTemplate(String(config.subject ?? 'Notificacion de FlowForge'), previousOutput);
    const body = resolveTemplate(String(config.body ?? ''), previousOutput);

    const info = await this.getTransporter().sendMail({
      from: this.config.get<string>('smtp.from'),
      to,
      subject,
      text: body,
    });

    return { messageId: info.messageId, to, subject };
  }

  // Crea el transporter SMTP una sola vez (lazy) a partir de las credenciales en variables de entorno.
  // Sin credenciales configuradas, tira un error claro en vez de fallar silenciosamente.
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;

    const host = this.config.get<string>('smtp.host');
    const port = this.config.get<number>('smtp.port');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');
    if (!host || !user || !pass) {
      throw new Error('notification: faltan credenciales SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS) en el entorno');
    }

    this.transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    return this.transporter;
  }
}
