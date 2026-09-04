import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module.js';
import { RunsController } from './runs.controller.js';

// Expone la ejecucion y el historial de runs sobre el motor.
@Module({
  imports: [EngineModule],
  controllers: [RunsController],
})
export class RunsModule {}
