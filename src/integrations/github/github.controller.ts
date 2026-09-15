import { BadRequestException, Controller, Delete, Get, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { GithubService } from './github.service.js';

// Flujo de OAuth de GitHub (Authorization Code) + estado de la conexion, consumidos por
// /integrations en el frontend. La action 'github' del motor usa GithubService directo, no este controller.
@Controller('integrations/github')
export class GithubController {
  constructor(
    private readonly github: GithubService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  status() {
    return this.github.status();
  }

  // Redirige al usuario a la pantalla de autorizacion real de GitHub.
  @Get('authorize')
  authorize(@Res() res: Response) {
    const state = this.github.createState();
    res.redirect(this.github.buildAuthorizeUrl(state));
  }

  // GitHub redirige aca despues de que el usuario autoriza (o rechaza) la app.
  @Get('callback')
  async callback(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('frontendUrl') ?? 'http://localhost:3001';
    if (!code || !state || !this.github.consumeState(state)) {
      return res.redirect(`${frontendUrl}/integrations?error=invalid_state`);
    }
    try {
      await this.github.exchangeCodeAndSave(code);
      return res.redirect(`${frontendUrl}/integrations?connected=1`);
    } catch (error) {
      const message = error instanceof BadRequestException ? error.message : 'No se pudo completar la conexion con GitHub';
      return res.redirect(`${frontendUrl}/integrations?error=${encodeURIComponent(message)}`);
    }
  }

  @Delete('disconnect')
  disconnect() {
    return this.github.disconnect();
  }
}
