import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GithubCredential } from '../../database/entities/github-credential.entity.js';
import { decryptSecret, encryptSecret } from '../../common/crypto.util.js';

const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

// Maneja el flujo de OAuth de GitHub (Authorization Code) y guarda/lee la unica credencial de la
// herramienta (sin multi-tenant, ver guia de desarrollo). El access token se guarda encriptado con
// AES-256-GCM (APP_ENCRYPTION_KEY) — es la tabla "credentials" que la guia marcaba como fase posterior.
// Sin lock/sesion distribuida para el "state" del OAuth a proposito (mismo criterio MVP que el
// scheduler): un Map en memoria alcanza para una sola instancia del backend.
@Injectable()
export class GithubService {
  private readonly pendingStates = new Map<string, number>();

  constructor(
    @InjectRepository(GithubCredential) private readonly credentials: Repository<GithubCredential>,
    private readonly config: ConfigService,
  ) {}

  // Genera un "state" de un solo uso para prevenir CSRF en el callback de OAuth.
  createState(): string {
    this.cleanupExpiredStates();
    const state = randomBytes(16).toString('hex');
    this.pendingStates.set(state, Date.now());
    return state;
  }

  consumeState(state: string): boolean {
    this.cleanupExpiredStates();
    return this.pendingStates.delete(state);
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, createdAt] of this.pendingStates) {
      if (now - createdAt > OAUTH_STATE_TTL_MS) this.pendingStates.delete(state);
    }
  }

  buildAuthorizeUrl(state: string): string {
    const clientId = this.config.get<string>('github.clientId');
    if (!clientId) throw new BadRequestException('Falta GITHUB_CLIENT_ID en el entorno');
    const redirectUri = this.config.get<string>('github.redirectUri');
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri ?? '', scope: 'repo', state });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  // Intercambia el "code" del callback por un access_token real y lo persiste encriptado.
  async exchangeCodeAndSave(code: string): Promise<void> {
    const clientId = this.config.get<string>('github.clientId');
    const clientSecret = this.config.get<string>('github.clientSecret');
    if (!clientId || !clientSecret) throw new BadRequestException('Falta GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET en el entorno');

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = (await tokenRes.json()) as { access_token?: string; scope?: string; error_description?: string };
    if (!tokenData.access_token) {
      throw new BadRequestException(`GitHub no devolvio un access_token: ${tokenData.error_description ?? 'respuesta invalida'}`);
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' },
    });
    const user = (await userRes.json()) as { login?: string };

    const encryptionKey = this.requireEncryptionKey();
    const existing = await this.findSingleRow();
    const row = existing ?? this.credentials.create();
    row.accessTokenEncrypted = encryptSecret(tokenData.access_token, encryptionKey);
    row.githubLogin = user.login ?? null;
    row.scope = tokenData.scope ?? null;
    await this.credentials.save(row);
  }

  async status(): Promise<{ connected: boolean; login: string | null }> {
    const row = await this.findSingleRow();
    return { connected: !!row, login: row?.githubLogin ?? null };
  }

  // Devuelve un objeto (no void) para que el frontend pueda parsear la respuesta como JSON siempre.
  async disconnect(): Promise<{ disconnected: true }> {
    await this.credentials.clear();
    return { disconnected: true };
  }

  // Usado por GithubAction: devuelve el token real en claro, o null si no hay cuenta conectada.
  async getDecryptedToken(): Promise<string | null> {
    const row = await this.findSingleRow();
    if (!row) return null;
    return decryptSecret(row.accessTokenEncrypted, this.requireEncryptionKey());
  }

  // Fila unica: sin filtro (no hay multi-tenant), toma la primera que exista.
  private async findSingleRow(): Promise<GithubCredential | null> {
    const [row] = await this.credentials.find({ take: 1 });
    return row ?? null;
  }

  private requireEncryptionKey(): string {
    const key = this.config.get<string>('app.encryptionKey');
    if (!key) throw new BadRequestException('Falta APP_ENCRYPTION_KEY en el entorno (32 bytes en hex)');
    return key;
  }
}
