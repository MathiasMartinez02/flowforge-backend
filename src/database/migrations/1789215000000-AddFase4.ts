import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFase41789215000000 implements MigrationInterface {
    name = 'AddFase41789215000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflows" ADD "webhook_secret" character varying`);
        await queryRunner.query(`CREATE TABLE "github_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "access_token_encrypted" text NOT NULL, "github_login" character varying, "scope" character varying, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ghcred_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "github_credentials"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP COLUMN "webhook_secret"`);
    }

}
