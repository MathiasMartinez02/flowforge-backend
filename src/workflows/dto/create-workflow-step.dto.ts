import { IsIn, IsInt, IsObject, Min, ValidateIf } from 'class-validator';

// Paso de un workflow al crearlo.
// Cambio en la Fase 2: antes solo aceptaba stepType 'action' con actionType 'http_request' (Fase 1).
// Ahora suma stepType 'condition' (sin actionType, config: { field, operator, value }) y
// la action 'notification' (config: { to, subject, body }).
// Cambio en la Fase 4: se suman las actions 'ai_task' (config: { prompt, systemInstruction? }) y
// 'github' (config: { repo, githubAction, title?, body?, issueNumber? }).
export class CreateWorkflowStepDto {
  @IsInt()
  @Min(0)
  orderIndex!: number;

  @IsIn(['action', 'condition'])
  stepType!: string;

  // Solo requerido (y validado) cuando el paso es una accion; un 'condition' no lleva actionType.
  @ValidateIf((step: CreateWorkflowStepDto) => step.stepType === 'action')
  @IsIn(['http_request', 'notification', 'ai_task', 'github'])
  actionType?: string;

  @IsObject()
  config!: Record<string, unknown>;
}
