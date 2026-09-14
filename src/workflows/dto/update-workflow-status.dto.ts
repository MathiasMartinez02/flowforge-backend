import { IsIn } from 'class-validator';

// Body de PATCH /workflows/:id/status: activa/pausa un workflow (afecta si el scheduler lo dispara).
export class UpdateWorkflowStatusDto {
  @IsIn(['draft', 'active', 'paused'])
  status!: string;
}
