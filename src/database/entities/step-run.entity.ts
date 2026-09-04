import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { WorkflowRun } from './workflow-run.entity.js';
import { WorkflowStep } from './workflow-step.entity.js';

// El resultado de ejecutar un paso puntual dentro de un run: estado, intento, output/error.
@Entity('step_runs')
export class StepRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => WorkflowRun, (run) => run.stepRuns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_run_id' })
  workflowRun!: Relation<WorkflowRun>;

  @ManyToOne(() => WorkflowStep, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_step_id' })
  workflowStep!: Relation<WorkflowStep>;

  // 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  @Column({ type: 'varchar', default: 'pending' })
  status!: string;

  @Column({ type: 'int', default: 1 })
  attempt!: number;

  // Resultado del paso (lo consume el paso siguiente como previousOutput).
  @Column({ type: 'jsonb', nullable: true })
  output!: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;
}
