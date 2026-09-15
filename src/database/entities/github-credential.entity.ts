import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Credencial de OAuth de GitHub. Fila unica (herramienta de un solo usuario, sin multi-tenant) —
// GithubService hace upsert sobre el primer registro que encuentre en vez de manejar un id fijo.
// accessTokenEncrypted usa AES-256-GCM (ver crypto.util.ts) con la clave APP_ENCRYPTION_KEY.
@Entity('github_credentials')
export class GithubCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted!: string;

  @Column({ name: 'github_login', type: 'varchar', nullable: true })
  githubLogin!: string | null;

  @Column({ type: 'varchar', nullable: true })
  scope!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
