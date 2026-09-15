import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Utilidades de crypto compartidas por la Fase 4: firma de webhooks (HMAC) y credenciales
// encriptadas en reposo (AES-256-GCM) para el token de OAuth de GitHub.

// Genera un secreto aleatorio legible en hex, usado como webhook_secret de un workflow.
export function generateSecret(bytes = 24): string {
  return randomBytes(bytes).toString('hex');
}

// Firma un payload crudo (Buffer/string) con HMAC-SHA256, formato "sha256=<hex>" (mismo esquema que
// usa GitHub para sus propios webhooks, ya conocido por cualquier cliente que dispare uno).
export function signPayload(secret: string, rawBody: Buffer | string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

// Compara la firma recibida contra la esperada en tiempo constante (evita timing attacks).
// Devuelve false (no tira error) ante cualquier formato inválido, para no filtrar detalles al caller.
export function verifySignature(secret: string, rawBody: Buffer | string, receivedSignature: string): boolean {
  const expected = signPayload(secret, rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(receivedSignature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// AES-256-GCM: la clave viene de APP_ENCRYPTION_KEY (32 bytes en hex, 64 caracteres).
// Formato de salida: "<iv-hex>:<tag-hex>:<ciphertext-hex>" en un solo string, para guardar en una sola columna.
export function encryptSecret(plainText: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptSecret(encrypted: string, keyHex: string): string {
  const [ivHex, tagHex, dataHex] = encrypted.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('formato de credencial encriptada inválido');
  const key = Buffer.from(keyHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}
