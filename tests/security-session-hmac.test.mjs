/**
 * tests/security-session-hmac.test.mjs
 *
 * Testa a lógica de verificação HMAC do cookie de sessão.
 * Valida que o algoritmo implementado no middleware.ts (Web Crypto API)
 * é equivalente ao de auth-store.ts (Node.js crypto) e que cookies
 * adulterados são rejeitados.
 *
 * Execução: node --test tests/security-session-hmac.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

// ── Replicar lógica de auth-store.ts ─────────────────────────────────────────

function signSessionId(sessionId, secret) {
  return crypto.createHmac('sha256', secret).update(sessionId).digest('hex');
}

function packCookie(sessionId, secret) {
  return `${sessionId}.${signSessionId(sessionId, secret)}`;
}

// ── Replicar lógica de middleware.ts (Web Crypto API) ─────────────────────────

async function verifySessionCookieEdge(cookieValue, secret) {
  if (!secret) return false;

  const parts = cookieValue.split('.');
  if (parts.length === 1) return Boolean(parts[0].trim());
  if (parts.length !== 2) return false;

  const [sessionId, signature] = parts;
  if (!sessionId || !signature) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const hexPairs = signature.match(/.{1,2}/g);
    if (!hexPairs || hexPairs.length !== 32) return false;
    const sigBytes = new Uint8Array(hexPairs.map(b => parseInt(b, 16)));

    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(sessionId));
  } catch {
    return false;
  }
}

// ── Testes ────────────────────────────────────────────────────────────────────

const SECRET = crypto.randomBytes(32).toString('hex');

test('cookie bem formado é aceito pelo verificador Edge', async () => {
  const sessionId = crypto.randomUUID();
  const cookie = packCookie(sessionId, SECRET);
  const valid = await verifySessionCookieEdge(cookie, SECRET);
  assert.equal(valid, true, 'Cookie legítimo deve passar');
});

test('assinatura adulterada é rejeitada', async () => {
  const sessionId = crypto.randomUUID();
  const cookie = packCookie(sessionId, SECRET);
  const tampered = cookie.slice(0, -1) + (cookie.slice(-1) === 'a' ? 'b' : 'a');
  const valid = await verifySessionCookieEdge(tampered, SECRET);
  assert.equal(valid, false, 'Cookie adulterado deve ser rejeitado');
});

test('sessionId adulterado é rejeitado', async () => {
  const sessionId = crypto.randomUUID();
  const cookie = packCookie(sessionId, SECRET);
  const [, sig] = cookie.split('.');
  const fakeSession = crypto.randomUUID();
  const tampered = `${fakeSession}.${sig}`;
  const valid = await verifySessionCookieEdge(tampered, SECRET);
  assert.equal(valid, false, 'SessionId trocado deve ser rejeitado');
});

test('cookie com secret errado é rejeitado', async () => {
  const sessionId = crypto.randomUUID();
  const cookie = packCookie(sessionId, SECRET);
  const wrongSecret = crypto.randomBytes(32).toString('hex');
  const valid = await verifySessionCookieEdge(cookie, wrongSecret);
  assert.equal(valid, false, 'Secret diferente deve rejeitar cookie');
});

test('cookie vazio é rejeitado', async () => {
  const valid = await verifySessionCookieEdge('', SECRET);
  assert.equal(valid, false);
});

test('cookie com múltiplos pontos é rejeitado', async () => {
  const valid = await verifySessionCookieEdge('a.b.c', SECRET);
  assert.equal(valid, false, 'Mais de um ponto → formato inválido');
});

test('assinatura com tamanho errado é rejeitada', async () => {
  const sessionId = crypto.randomUUID();
  const shortSig = 'a'.repeat(62);
  const valid = await verifySessionCookieEdge(`${sessionId}.${shortSig}`, SECRET);
  assert.equal(valid, false, 'Assinatura com tamanho incorreto deve ser rejeitada');
});

test('algoritmo Node.js e Edge geram resultados equivalentes', async () => {
  const sessionId = crypto.randomUUID();
  const nodeSig = signSessionId(sessionId, SECRET);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const raw = await crypto.subtle.sign('HMAC', key, encoder.encode(sessionId));
  const edgeSig = Array.from(new Uint8Array(raw))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  assert.equal(nodeSig, edgeSig, 'Assinaturas Node.js e Edge devem ser idênticas');
});
