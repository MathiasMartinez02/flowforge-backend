import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Workflow } from './workflow.entity.js';
import { StepRun } from './step-run.entity.js';

// Una ejecucion completa de un workflow: agrupa los step_runs de cada paso.
@Entity('workflow_runs')
export class WorkflowRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @ManyToOne(() => Workflow, (workflow) => workflow.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workflow_id' })
  workflow!: Relation<Workflow>;

  // 'pending' | 'running' | 'completed' | 'failed'
  @Column({ type: 'varchar', default: 'pending' })
  status!: string;

  // 'manual' | 'scheduled'
  @Column({ name: 'trigger_source', type: 'varchar' })
  triggerSource!: string;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @OneToMany(() => StepRun, (stepRun) => stepRun.workflowRun, { cascade: true })
  stepRuns!: Relation<StepRun>[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
