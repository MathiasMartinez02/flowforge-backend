import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import configuration, { configValidationSchema } from './config/configuration.js';
import { HealthModule } from './health/health.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { RunsModule } from './runs/runs.module.js';
import { WorkerModule } from './queue/worker.module.js';
import { SchedulerModule } from './scheduler/scheduler.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { GithubModule } from './integrations/github/github.module.js';

// Módulo raíz: carga config validada, conecta TypeORM a Postgres, registra health check + workflows + runs.
// Modificado en la Fase 2: se suma WorkerModule para levantar el worker de BullMQ en el mismo proceso
// (un solo worker generico, ver guia de desarrollo seccion 4 — no hay microservicio aparte en el MVP).
// Modificado en la Fase 3: se suma ScheduleModule.forRoot() (habilita SchedulerRegistry, requerido
// por SchedulerModule) para el trigger 'scheduled' via cron dinamico.
// Modificado en la Fase 4: se suman WebhooksModule (trigger 'webhook' publico) y GithubModule
// (OAuth + estado de la conexion, consumido tambien por ActionsModule via GithubService).
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: configValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('databaseUrl'),
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: false,
      }),
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    WorkflowsModule,
    RunsModule,
    WorkerModule,
    SchedulerModule,
    WebhooksModule,
    GithubModule,
  ],
})
export class AppModule {}
