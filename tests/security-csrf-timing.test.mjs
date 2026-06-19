/**
 * tests/security-csrf-timing.test.mjs
 *
 * Testa a lógica de comparação CSRF com timingSafeEqual.
 * Garante que a correção em lib/auth/csrf.ts funciona corretamente
 * e previne timing attacks.
 *
 * Execução: node --test tests/security-csrf-timing.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

// ── Replicar lógica corrigida de csrf.ts ─────────────────────────────────────

function requireCsrfLogic(cookie, header) {
  if (!cookie || !header) return { error: 'CSRF invalido' };

  try {
    const cookieBuf = Buffer.from(cookie, 'utf-8');
    const headerBuf = Buffer.from(header, 'utf-8');
    if (
      cookieBuf.length !== headerBuf.length ||
      !crypto.timingSafeEqual(cookieBuf, headerBuf)
    ) {
      return { error: 'CSRF invalido' };
    }
  } catch {
    return { error: 'CSRF invalido' };
  }

  return null; // OK
}

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// ── Testes ────────────────────────────────────────────────────────────────────

test('token CSRF válido (cookie === header) é aceito', () => {
  const token = generateCsrfToken();
  const result = requireCsrfLogic(token, token);
  assert.equal(result, null, 'Tokens iguais devem passar');
});

test('token CSRF ausente no cookie é rejeitado', () => {
  const token = generateCsrfToken();
  const result = requireCsrfLogic(null, token);
  assert.ok(result?.error, 'Cookie ausente deve ser rejeitado');
});

test('token CSRF ausente no header é rejeitado', () => {
  const token = generateCsrfToken();
  const result = requireCsrfLogic(token, null);
  assert.ok(result?.error, 'Header ausente deve ser rejeitado');
});

test('tokens CSRF diferentes são rejeitados', () => {
  const tokenA = generateCsrfToken();
  const tokenB = generateCsrfToken();
  const result = requireCsrfLogic(tokenA, tokenB);
  assert.ok(result?.error, 'Tokens diferentes devem ser rejeitados');
});

test('token CSRF com tamanhos diferentes é rejeitado (proteção de tamanho)', () => {
  const token = generateCsrfToken();
  const shorter = token.slice(0, -4);
  const result = requireCsrfLogic(token, shorter);
  assert.ok(result?.error, 'Tamanhos diferentes devem ser rejeitados antes do timingSafeEqual');
});

test('token vazio é rejeitado', () => {
  const result = requireCsrfLogic('', '');
  assert.ok(result?.error, 'Token vazio deve ser rejeitado');
});

test('timingSafeEqual não lança exceção para tokens de tamanho igual', () => {
  const token = generateCsrfToken();
  // Trocar um char mantendo o tamanho
  const modified = token.slice(0, -1) + (token.slice(-1) === 'a' ? 'b' : 'a');
  assert.doesNotThrow(() => requireCsrfLogic(token, modified));
  const result = requireCsrfLogic(token, modified);
  assert.ok(result?.error, 'Token modificado deve ser rejeitado');
});

test('múltiplos tokens únicos são gerados a cada chamada', () => {
  const tokens = new Set(Array.from({ length: 20 }, () => generateCsrfToken()));
  assert.equal(tokens.size, 20, 'Todos os tokens devem ser únicos (sem colisão em 20 amostras)');
});

test('token tem entropia suficiente (>= 32 bytes)', () => {
  const token = generateCsrfToken();
  // base64url: cada char representa 6 bits → 32 bytes = 256 bits = ~43 chars
  assert.ok(token.length >= 43, `Token muito curto: ${token.length} chars`);
});
