# FlowForge — Backend

Motor de automatización tipo Zapier/n8n: workflows con un trigger (manual o programado), una cadena
ordenada de pasos (`action` o `condition`) y ejecución real por colas con reintentos.

API en NestJS + TypeORM + PostgreSQL, colas con BullMQ + Redis. El repo del frontend (Next.js) vive
en [`flowforge-front`](https://github.com/MathiasMartinez02/flowforge-front); ambos se orquestan
juntos desde un `docker-compose.yml` en la carpeta contenedora del proyecto (no versionado en
ninguno de los dos repos).

## Qué resuelve

El pipeline central es lo que muestra el proyecto: cada paso de un workflow se encola como su propio
job de BullMQ, con reintentos y backoff exponencial reales (no un `try/catch` en memoria), y el
resultado de cada paso queda persistido en su propia fila (`step_runs`) para poder reconstruir el
timeline completo de una ejecución.

```text
Trigger (manual o cron)
        │
        ▼
workflow-engine.service  →  crea workflow_run + primer step_run (pending)
        │
        ▼
workflow.producer  →  encola un job en BullMQ: { stepRunId, previousOutput }
        │
        ▼
workflow.processor (worker)
        │
        ├── step_type = 'condition' → condition-evaluator (==, !=, >, <, contains)
        │      ├── true  → encola el siguiente paso
        │      └── false → resto de los pasos 'skipped', run 'completed' (no es un fallo)
        │
        └── step_type = 'action' → action-registry.get(action_type)
               ├── http_request (Axios), notification (SMTP/nodemailer), ai_task (Gemini/Ollama) o github (Octokit)
               ├── 3 intentos, backoff exponencial (2s, 4s, 8s) — reintentos nativos de BullMQ
               └── último intento agotado → step_run y workflow_run quedan 'failed'
```

Un `workflow_run` también puede arrancar por un `POST /webhooks/:workflowId` público y firmado
(`trigger_type = 'webhook'`), no solo por el botón manual o el cron — ver sección "Fase 4" más abajo.

Cada `action` recibe como input el `output` del paso anterior, no solo el trigger original — así una
`condition` puede evaluar el status code de un `http_request` previo, y una `notification` puede
incluir datos de un paso anterior en el mensaje (`{{campo}}`).

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | NestJS 12 (ESM nativo) | arquitectura modular, DI de fábrica para BullMQ/TypeORM |
| ORM | TypeORM 1.x + migraciones versionadas | sin `synchronize`, el schema se audita por commit |
| Colas | `@nestjs/bullmq` + BullMQ + Redis (ioredis) | retry/backoff nativos, un worker genérico por `action_type` |
| Scheduling | `@nestjs/schedule` + `SchedulerRegistry` | un `CronJob` dinámico por workflow programado, registrado/dado de baja en caliente |
| Validación | `class-validator` + `class-transformer`, `whitelist`+`forbidNonWhitelisted` | DTOs estrictos, rechaza campos no declarados |
| Config | `@nestjs/config` + Joi | falla rápido al bootear si falta una env var |
| Testing | Vitest (unitarios + e2e) | reemplaza a Jest como test runner por default del scaffold actual de Nest |

## Cómo levantarlo

### Con Docker Compose (recomendado)

Desde la carpeta contenedora del proyecto (`flowforge/`, un nivel arriba de este repo):

```bash
docker compose up --build
```

Levanta Postgres, Redis, este backend (con migraciones automáticas antes de arrancar Nest, ver
`docker-entrypoint.sh`) y el frontend. Backend en `http://localhost:3000`, `GET /health` confirma la
conexión real a la base.

### Local (sin Docker)

```bash
cp .env.example .env          # completar si hace falta (SMTP es opcional)
npm ci
npm run migration:run         # requiere Postgres real corriendo (docker compose up -d postgres redis alcanza)
npm run start:dev
```

## Modelo de datos

5 tablas (sin enums nativos de Postgres a propósito — `varchar` + validación en la app, para no
depender de `ALTER TYPE` al sumar tipos nuevos de trigger/action):

- **`workflows`** — nombre, `trigger_type` (`manual` | `scheduled` | `webhook`), `cron_expression`,
  `webhook_secret` (solo si `trigger_type = 'webhook'`), `status` (`draft` | `active` | `paused`).
- **`workflow_steps`** — pasos ordenados (`order_index`), `step_type` (`action` | `condition`),
  `action_type` (`http_request` | `notification` | `ai_task` | `github`), `config` (jsonb específico del tipo).
- **`workflow_runs`** — una ejecución completa: estado, `trigger_source`, timestamps, error.
- **`step_runs`** — el resultado de cada paso dentro de un run: estado, `attempt`, `output` (jsonb,
  lo consume el paso siguiente), error.
- **`github_credentials`** (Fase 4) — fila única con el access token de OAuth de GitHub, encriptado
  en reposo (AES-256-GCM). Sin multi-tenant: la herramienta es de un solo usuario, no hace falta
  asociarla a un `user_id`.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/workflows` | crea un workflow con sus pasos (transacción) |
| `GET` | `/workflows` | lista workflows con sus pasos |
| `GET` | `/workflows/:id` | detalle de un workflow |
| `PATCH` | `/workflows/:id/status` | activa/pausa un workflow — resincroniza su cron en caliente |
| `POST` | `/workflows/:id/runs` | dispara una ejecución manual (encola el primer paso, no espera a que termine) |
| `GET` | `/workflows/:id/runs` | historial de runs de un workflow |
| `GET` | `/runs/:id` | detalle de un run con el timeline de sus `step_runs` |
| `GET` | `/health` | liveness + ping real a Postgres |
| `POST` | `/workflows/:id/webhook-secret/regenerate` | regenera el secreto de firma de un workflow `webhook` |
| `POST` | `/webhooks/:workflowId` | endpoint público del trigger `webhook` — requiere firma HMAC válida |
| `GET` | `/integrations/github/status` | si hay una cuenta de GitHub conectada y con qué login |
| `GET` | `/integrations/github/authorize` | redirige al flujo real de OAuth de GitHub |
| `GET` | `/integrations/github/callback` | callback de OAuth: intercambia el code, guarda el token encriptado |
| `DELETE` | `/integrations/github/disconnect` | borra la credencial de GitHub guardada |

## Scheduling (`trigger_type = 'scheduled'`)

`SchedulerService` registra un `CronJob` dinámico (via `SchedulerRegistry`) por cada workflow con
`trigger_type = 'scheduled'` y `status = 'active'`, tanto al bootear el proceso como al crear un
workflow nuevo o cambiar su `status` (`PATCH /workflows/:id/status`) — no hace falta reiniciar el
backend para que un cambio de scheduling tome efecto. Al dispararse, llama al mismo
`WorkflowEngineService.triggerRun` que usa el botón "Ejecutar ahora" manual, con
`trigger_source: 'scheduled'`.

**Trade-off documentado a propósito**: sin lock distribuido. Para una sola instancia del backend
(el caso del MVP) no hace falta — en producción con más de una instancia esto duplicaría runs; la
solución sería un lock de Redis o los repeatable jobs de BullMQ (que deduplican por `jobId`).

## Fase 4 — Webhook, action `ai_task` y action `github`

**Trigger `webhook`**: `POST /webhooks/:workflowId` público, firmado con HMAC-SHA256. Al crear un
workflow con `triggerType: "webhook"` el backend genera un `webhook_secret` aleatorio (24 bytes).
El caller debe firmar el body crudo con ese secreto y mandarlo en el header
`X-Flowforge-Signature: sha256=<hex>` (mismo esquema que usa GitHub para sus propios webhooks). La
verificación se hace en tiempo constante (`timingSafeEqual`) contra `request.rawBody` (Nest con
`rawBody: true`, ver `main.ts`) — nunca contra el JSON re-serializado, que no es fiable byte a byte.
El payload recibido se pasa como `previousOutput` del primer paso, igual que el output de un paso
anterior en la cadena normal — así una `condition` o un `notification` pueden usar `{{campo}}` del
body del webhook. El secreto se puede regenerar (`POST /workflows/:id/webhook-secret/regenerate`),
invalidando el anterior.

**Action `ai_task`**: ejecuta un prompt de texto contra Gemini u Ollama (`AI_PROVIDER`). No existe
un paquete `ai-core` reusable de PRISM — ese backend es Python (FastAPI) con su lógica de IA
acoplada a sus propios schemas Pydantic, no un paquete Node publicable. Se reimplementó el mismo
patrón (provider intercambiable por env var) en TypeScript (`actions/ai.action.ts`), con la misma
convención de nombres de variables de entorno para no divergir entre los dos proyectos del
portfolio. `prompt`/`systemInstruction` soportan `{{campo}}` contra el output del paso anterior.

**Action `github`**: crea issues o comenta en un repo real, vía OAuth (Authorization Code) real con
GitHub — no un Personal Access Token pegado a mano. El access token se guarda **encriptado en
reposo** (AES-256-GCM, `common/crypto.util.ts`) con la clave `APP_ENCRYPTION_KEY` — es la tabla
`credentials` con secretos encriptados que la guía de desarrollo marcaba como una fase posterior
(sección 0), implementada acá. Fila única (`github_credentials`): sin multi-tenant, coherente con
el resto del proyecto. El "state" del flujo de OAuth (anti-CSRF) vive en un `Map` en memoria con
TTL de 5 minutos — mismo criterio MVP que el scheduler sin lock distribuido: alcanza para una sola
instancia del backend, documentado como trade-off.

Para usar la action `github` hay que crear una OAuth App en
[github.com/settings/developers](https://github.com/settings/developers) con "Authorization
callback URL" = `GITHUB_OAUTH_REDIRECT_URI`, y generar `APP_ENCRYPTION_KEY` con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Testing

```bash
npm run test        # unitarios (condition-evaluator, workflow-engine, scheduler, crypto.util)
npm run test:e2e     # GET /health contra Postgres real — requiere DATABASE_URL apuntando a una base real
npm run lint
```

CI (`.github/workflows/ci.yml`) corre lint + build + unitarios + migraciones + e2e en cada push/PR,
contra servicios reales de Postgres y Redis (no mockeados).

## Política de reintentos

3 intentos por `action`, backoff exponencial (2s, 4s, 8s) — configurado nativo en BullMQ
(`attempts`, `backoff: { type: 'exponential', delay: 2000 }`), no reinventado a mano. Cada intento
fallido se apila en `step_run.output.attempts` para poder mostrar "Intento 2/3" en el frontend con
datos reales, sin agregar una tabla nueva al modelo.

## Cómo agregar un tipo de `action` nuevo

Implementar `StepExecutor` (`execute(config, previousOutput)`) y registrarlo en
`action-registry.ts` — el motor de ejecución (`workflow-engine.service.ts`) no se toca.

## Decisiones fuera de alcance (a propósito)

Sin autenticación ni multi-tenant (herramienta de un solo usuario para portfolio, no un SaaS). Las
credenciales de servicios que no requieren OAuth (SMTP, Gemini, Ollama) van por variable de entorno;
la única que sí lo requiere (GitHub) usa la tabla `github_credentials` encriptada (ver Fase 4). Sin
lock distribuido para el trigger `scheduled` ni para el "state" del OAuth de GitHub — ambos
documentados como el mismo trade-off: válido para una sola instancia del backend (el MVP), no para
producción con más de una.
