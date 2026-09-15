import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GithubCredential } from '../../database/entities/github-credential.entity.js';
import { GithubController } from './github.controller.js';
import { GithubService } from './github.service.js';

// GithubService se exporta para que ActionsModule lo inyecte en GithubAction sin duplicar la
// logica de credenciales entre el flujo de OAuth y la ejecucion de un paso de workflow.
@Module({
  imports: [TypeOrmModule.forFeature([GithubCredential])],
  controllers: [GithubController],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
