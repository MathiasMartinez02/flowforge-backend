import Joi from 'joi';

// Esquema de validación de variables de entorno: si falta algo, la app no arranca.
// SMTP_*, AI_*, GITHUB_*/APP_ENCRYPTION_KEY son opcionales a proposito: sin configurar, la app
// arranca igual y la action/integracion correspondiente falla en runtime con un mensaje claro
// (no al bootear) — mismo criterio ya usado para SMTP en la Fase 2.
export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().uri().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  FRONTEND_URL: Joi.string().allow('').optional(),
  SMTP_HOST: Joi.string().allow('').optional(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().allow('').optional(),
  SMTP_PASS: Joi.string().allow('').optional(),
  SMTP_FROM: Joi.string().allow('').optional(),
  // Fase 4 — action 'ai_task'.
  AI_PROVIDER: Joi.string().valid('gemini', 'ollama').default('gemini'),
  GEMINI_API_KEY: Joi.string().allow('').optional(),
  GEMINI_MODEL: Joi.string().allow('').optional(),
  OLLAMA_HOST: Joi.string().allow('').optional(),
  OLLAMA_MODEL: Joi.string().allow('').optional(),
  // Fase 4 — action 'github' + OAuth.
  GITHUB_CLIENT_ID: Joi.string().allow('').optional(),
  GITHUB_CLIENT_SECRET: Joi.string().allow('').optional(),
  GITHUB_OAUTH_REDIRECT_URI: Joi.string().allow('').optional(),
  APP_ENCRYPTION_KEY: Joi.string().allow('').optional(),
});

// Agrupa las variables de entorno crudas en un objeto tipado para inyectar vía ConfigService.
// Modificado en la Fase 2: se suma el bloque "smtp" para la action 'notification'.
// Modificado en la Fase 4: se suman "ai", "github", "app.encryptionKey" y "frontendUrl".
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  smtp: {
    host: process.env.SMTP_HOST || undefined,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || process.env.SMTP_USER || undefined,
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'gemini',
    geminiApiKey: process.env.GEMINI_API_KEY || undefined,
    geminiModel: process.env.GEMINI_MODEL || undefined,
    ollamaHost: process.env.OLLAMA_HOST || undefined,
    ollamaModel: process.env.OLLAMA_MODEL || undefined,
  },
  github: {
    clientId: process.env.GITHUB_CLIENT_ID || undefined,
    clientSecret: process.env.GITHUB_CLIENT_SECRET || undefined,
    redirectUri: process.env.GITHUB_OAUTH_REDIRECT_URI || 'http://localhost:3000/integrations/github/callback',
  },
  app: {
    encryptionKey: process.env.APP_ENCRYPTION_KEY || undefined,
  },
});
