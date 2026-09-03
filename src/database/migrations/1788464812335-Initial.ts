import { MigrationInterface, QueryRunner } from "typeorm";

// Migración vacía a propósito: solo prueba que el ciclo up/down funciona contra la DB real. Las tablas reales llegan en la Fase 1.
export class Initial1788464812335 implements MigrationInterface {

    public async up(_queryRunner: QueryRunner): Promise<void> {
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
    }

}
