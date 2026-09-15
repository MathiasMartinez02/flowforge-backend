import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

// Bootstrap: CORS abierto al frontend local, DTOs validados globalmente (rechaza campos no declarados).
// Cambio en la Fase 4: rawBody: true expone request.rawBody (Buffer) sin romper el parseo normal de
// JSON — lo necesita webhooks.controller.ts para verificar la firma HMAC contra los bytes exactos
// que mandó el cliente (recalcularla sobre el JSON re-serializado no es fiable byte a byte).
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
