import { Injectable } from '@nestjs/common';
import { StepExecutor } from '../engine/step-executor.interface.js';
import { HttpRequestAction } from './http-request.action.js';

// Mapea action_type -> executor. Notification (Fase 2) y AI (Fase 4) se agregan aca, no en el motor.
@Injectable()
export class ActionRegistry {
  constructor(private readonly httpRequestAction: HttpRequestAction) {}

  get(actionType: string): StepExecutor {
    switch (actionType) {
      case 'http_request':
        return this.httpRequestAction;
      default:
        throw new Error(`No hay executor registrado para action_type "${actionType}"`);
    }
  }
}
