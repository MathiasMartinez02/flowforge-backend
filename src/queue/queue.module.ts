import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

// Configura la conexion compartida a Redis para BullMQ (una sola vez, via forRootAsync).
// Los modulos que encolan o procesan jobs importan este modulo y ademas registran su propia
// cola con BullModule.registerQueue({ name: WORKFLOW_QUEUE }) — ver engine.module.ts y worker.module.ts.
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
