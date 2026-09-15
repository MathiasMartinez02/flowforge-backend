import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, generateSecret, signPayload, verifySignature } from './crypto.util.js';

describe('crypto.util', () => {
  it('genera secretos aleatorios y de largo distinto entre llamadas', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(48); // 24 bytes en hex = 48 caracteres
  });

  it('firma y verifica un payload con el secreto correcto', () => {
    const secret = generateSecret();
    const body = JSON.stringify({ hello: 'world' });
    const signature = signPayload(secret, body);
    expect(signature).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(verifySignature(secret, body, signature)).toBe(true);
  });

  it('rechaza la verificacion si el secreto no coincide', () => {
    const body = 'payload';
    const signature = signPayload(generateSecret(), body);
    expect(verifySignature(generateSecret(), body, signature)).toBe(false);
  });

  it('rechaza la verificacion si el body cambio (integridad del payload)', () => {
    const secret = generateSecret();
    const signature = signPayload(secret, 'payload original');
    expect(verifySignature(secret, 'payload modificado', signature)).toBe(false);
  });

  it('rechaza una firma con formato invalido sin tirar excepcion', () => {
    const secret = generateSecret();
    expect(verifySignature(secret, 'payload', 'no-es-una-firma-valida')).toBe(false);
  });

  it('encripta y desencripta un secreto simetricamente (AES-256-GCM)', () => {
    const key = randomBytes(32).toString('hex');
    const plainText = 'gho_tokendemuestra1234567890';
    const encrypted = encryptSecret(plainText, key);
    expect(encrypted).not.toBe(plainText);
    expect(decryptSecret(encrypted, key)).toBe(plainText);
  });

  it('falla al desencriptar con la clave equivocada (autenticacion GCM)', () => {
    const encrypted = encryptSecret('secreto', randomBytes(32).toString('hex'));
    expect(() => decryptSecret(encrypted, randomBytes(32).toString('hex'))).toThrow();
  });
});
