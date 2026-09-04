import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import { Workflow } from './workflow.entity.js';

// Un paso dentro de un workflow: una accion (http_request, notification) o una condicion, en un orden fijo.
@Entity('workflow_steps')
@Unique(['workflow', 'orderIndex'])
export class WorkflowStep {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Workflow, (workflow) => workflow.steps, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow!: Relation<Workflow>;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex!: number;

  // 'action' | 'condition' — solo 'action' esta implementado en la Fase 1, 'condition' llega en la Fase 2.
  @Column({ name: 'step_type', type: 'varchar' })
  stepType!: string;

  // 'http_request' | 'notification' — solo 'http_request' tiene executor real en la Fase 1.
  @Column({ name: 'action_type', type: 'varchar', nullable: true })
  actionType!: string | null;

  // Payload especifico del tipo: { method, url, headers?, body? } para http_request, { field, operator, value } para condition.
  @Column({ type: 'jsonb' })
  config!: Record<string, unknown>;
}
