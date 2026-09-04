import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { CreateWorkflowStepDto } from './create-workflow-step.dto.js';

// Body de POST /workflows: crea el workflow y sus pasos en una sola transaccion.
export class CreateWorkflowDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['manual', 'scheduled'])
  triggerType!: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps!: CreateWorkflowStepDto[];
}
