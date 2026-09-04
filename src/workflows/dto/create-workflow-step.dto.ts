import { IsIn, IsInt, IsObject, Min } from 'class-validator';

// Paso de un workflow al crearlo. Fase 1: solo accion http_request (condition llega en la Fase 2).
export class CreateWorkflowStepDto {
  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsIn(['action'])
  stepType!: string;

  @IsIn(['http_request'])
  actionType!: string;

  @IsObject()
  config!: Record<string, unknown>;
}
