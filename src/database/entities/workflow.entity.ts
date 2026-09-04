import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { WorkflowStep } from './workflow-step.entity.js';
import { WorkflowRun } from './workflow-run.entity.js';

// Un workflow: su disparador (manual o programado) y la lista ordenada de pasos que ejecuta.
@Entity('workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  // 'manual' | 'scheduled' — sin enum nativo de Postgres a propósito, para no depender de ALTER TYPE cuando se sume 'webhook' en la Fase 4.
  @Column({ name: 'trigger_type', type: 'varchar' })
  triggerType!: string;

  @Column({ name: 'cron_expression', type: 'varchar', nullable: true })
  cronExpression!: string | null;

  // 'draft' | 'active' | 'paused'
  @Column({ type: 'varchar', default: 'active' })
  status!: string;

  @OneToMany(() => WorkflowStep, (step) => step.workflow, { cascade: true })
  steps!: Relation<WorkflowStep>[];

  @OneToMany(() => WorkflowRun, (run) => run.workflow)
  runs!: Relation<WorkflowRun>[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
