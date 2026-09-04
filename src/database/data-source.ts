import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

// DataSource standalone que usa la CLI de TypeORM para generar/correr migraciones (no pasa por el DI de Nest).
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
