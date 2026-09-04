import { HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { StepExecutor } from '../engine/step-executor.interface.js';

// Ejecuta una llamada HTTP generica (GET/POST/etc). config: { method, url, headers?, body? }.
@Injectable()
export class HttpRequestAction implements StepExecutor {
  constructor(private readonly http: HttpService) {}

  async execute(config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const method = String(config.method ?? 'GET').toUpperCase();
    const url = String(config.url ?? '');
    if (!url) throw new Error('http_request: falta "url" en la config del paso');

    try {
      const response = await firstValueFrom(
        this.http.request({
          method,
          url,
          headers: (config.headers as Record<string, string>) ?? undefined,
          data: config.body,
          timeout: 10_000,
        }),
      );
      return { statusCode: response.status, data: response.data };
    } catch (error) {
      if (error instanceof AxiosError) {
        throw new Error(`HTTP ${error.response?.status ?? '???'}: ${error.message}`);
      }
      throw error instanceof HttpException ? error : new Error(String(error));
    }
  }
}
