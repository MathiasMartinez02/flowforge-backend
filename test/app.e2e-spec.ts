import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

// E2E real contra Postgres/Redis (no mockeado, mismo criterio que el resto del proyecto) — requiere
// las variables de entorno de conexion reales (ver .env.example, o los servicios que levanta el job
// de CI en .github/workflows/ci.yml). Reemplaza el boilerplate original de Nest (AppController "Hello
// World", sacado en la Fase 1) que ya no tenia ninguna ruta real que probar.
describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health (GET) responde ok con la conexion real a Postgres arriba', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        if (res.body.status !== 'ok') {
          throw new Error(`esperaba status "ok", la respuesta trajo "${res.body.status}"`);
        }
      });
  });
});
