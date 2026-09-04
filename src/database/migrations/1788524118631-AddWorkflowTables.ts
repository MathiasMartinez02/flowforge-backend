import { MigrationInterface, QueryRunner } from "typeorm";

export class AddWorkflowTables1788524118631 implements MigrationInterface {
    name = 'AddWorkflowTables1788524118631'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "workflow_steps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_index" integer NOT NULL, "step_type" character varying NOT NULL, "action_type" character varying, "config" jsonb NOT NULL, "workflow_id" uuid, CONSTRAINT "UQ_ceb5ef9666dd228a8e80bbddf20" UNIQUE ("workflow_id", "order_index"), CONSTRAINT "PK_b602e5ecb22943db11c96a7f31c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_02f0092e12343bfed27bb65fa8" ON "workflow_steps"  ("workflow_id") `);
        await queryRunner.query(`CREATE TABLE "workflows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "trigger_type" character varying NOT NULL, "cron_expression" character varying, "status" character varying NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5b5757cc1cd86268019fef52e0c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workflow_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" character varying NOT NULL DEFAULT 'pending', "trigger_source" character varying NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "error_message" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "workflow_id" uuid, CONSTRAINT "PK_eea9f8d0a660b3f48114c313233" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a2995918456c0a612cf1e5ba22" ON "workflow_runs"  ("workflow_id") `);
        await queryRunner.query(`CREATE TABLE "step_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" character varying NOT NULL DEFAULT 'pending', "attempt" integer NOT NULL DEFAULT '1', "output" jsonb, "error_message" text, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "workflow_run_id" uuid, "workflow_step_id" uuid, CONSTRAINT "PK_5786a3a2b02a77b446ce02c4c09" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7e4235a4b5fae4d1b74545e9a4" ON "step_runs"  ("workflow_run_id") `);
        await queryRunner.query(`ALTER TABLE "workflow_steps" ADD CONSTRAINT "FK_02f0092e12343bfed27bb65fa89" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_runs" ADD CONSTRAINT "FK_a2995918456c0a612cf1e5ba22a" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "step_runs" ADD CONSTRAINT "FK_7e4235a4b5fae4d1b74545e9a45" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "step_runs" ADD CONSTRAINT "FK_a1b0c29fa09826b9511019c449a" FOREIGN KEY ("workflow_step_id") REFERENCES "workflow_steps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "step_runs" DROP CONSTRAINT "FK_a1b0c29fa09826b9511019c449a"`);
        await queryRunner.query(`ALTER TABLE "step_runs" DROP CONSTRAINT "FK_7e4235a4b5fae4d1b74545e9a45"`);
        await queryRunner.query(`ALTER TABLE "workflow_runs" DROP CONSTRAINT "FK_a2995918456c0a612cf1e5ba22a"`);
        await queryRunner.query(`ALTER TABLE "workflow_steps" DROP CONSTRAINT "FK_02f0092e12343bfed27bb65fa89"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e4235a4b5fae4d1b74545e9a4"`);
        await queryRunner.query(`DROP TABLE "step_runs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a2995918456c0a612cf1e5ba22"`);
        await queryRunner.query(`DROP TABLE "workflow_runs"`);
        await queryRunner.query(`DROP TABLE "workflows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_02f0092e12343bfed27bb65fa8"`);
        await queryRunner.query(`DROP TABLE "workflow_steps"`);
    }

}
