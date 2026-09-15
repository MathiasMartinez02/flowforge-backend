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

  // 'manual' | 'scheduled' | 'webhook' — sin enum nativo de Postgres a propósito (ver Fase 3/4).
  @Column({ name: 'trigger_type', type: 'varchar' })
  triggerType!: string;

  @Column({ name: 'cron_expression', type: 'varchar', nullable: true })
  cronExpression!: string | null;

  // Solo si trigger_type = 'webhook': firma HMAC-SHA256 del payload (ver crypto.util.ts). Se genera
  // al crear el workflow y se puede regenerar. Plaintext en DB, mismo criterio que el resto del
  // proyecto (herramienta de un solo usuario, sin multi-tenant) — no es un secreto de terceros.
  @Column({ name: 'webhook_secret', type: 'varchar', nullable: true })
  webhookSecret!: string | null;

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
