import { Injectable } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { StepExecutor } from '../engine/step-executor.interface.js';
import { GithubService } from '../integrations/github/github.service.js';
import { resolveTemplate } from './resolve-template.util.js';

// Ejecuta una accion sobre un repo de GitHub usando el token de OAuth conectado (ver GithubService).
// config: { repo: "owner/repo", githubAction: "create_issue" | "add_comment", title?, body?, issueNumber? }.
// "title"/"body" soportan placeholders {{campo}} contra el output del paso anterior.
@Injectable()
export class GithubAction implements StepExecutor {
  constructor(private readonly github: GithubService) {}

  async execute(config: Record<string, unknown>, previousOutput: Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const repo = String(config.repo ?? '');
    const [owner, repoName] = repo.split('/');
    if (!owner || !repoName) throw new Error('github: "repo" debe tener el formato "owner/repo"');

    const token = await this.github.getDecryptedToken();
    if (!token) throw new Error('github: no hay una cuenta de GitHub conectada (ver /integrations)');
    const octokit = new Octokit({ auth: token });

    const body = resolveTemplate(String(config.body ?? ''), previousOutput);
    const githubAction = String(config.githubAction ?? '');

    if (githubAction === 'create_issue') {
      const title = resolveTemplate(String(config.title ?? ''), previousOutput);
      if (!title.trim()) throw new Error('github: falta "title" para create_issue');
      const { data } = await octokit.issues.create({ owner, repo: repoName, title, body });
      return { issueNumber: data.number, url: data.html_url };
    }

    if (githubAction === 'add_comment') {
      const issueNumber = Number(resolveTemplate(String(config.issueNumber ?? ''), previousOutput));
      if (!issueNumber) throw new Error('github: falta "issueNumber" (o no es un numero valido) para add_comment');
      const { data } = await octokit.issues.createComment({ owner, repo: repoName, issue_number: issueNumber, body });
      return { commentId: data.id, url: data.html_url };
    }

    throw new Error(`github: "githubAction" desconocida "${githubAction}" (usar "create_issue" o "add_comment")`);
  }
}
