import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration, { configValidationSchema } from './config/configuration.js';
import { HealthModule } from './health/health.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { RunsModule } from './runs/runs.module.js';

// Módulo raíz: carga config validada, conecta TypeORM a Postgres, registra health check + workflows + runs.
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
    HealthModule,
    WorkflowsModule,
    RunsModule,
  ],
})
export class AppModule {}
