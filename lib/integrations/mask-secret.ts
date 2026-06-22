import crypto from 'node:crypto';

const ENC_PREFIX = 'enc:v1';

function getKeyMaterial(): Buffer {
  const secret = process.env.SILO_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('SILO_AUTH_SECRET ausente. Configure a chave para armazenar segredos de integracao.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function normalizeSecret(value: string | undefined | null): string {
  return String(value ?? '').trim();
}

export function encryptSecret(value: string | undefined | null): string | undefined {
  const secret = normalizeSecret(value);
  if (!secret) return undefined;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKeyMaterial(), iv);
  const payload = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENC_PREFIX, iv.toString('hex'), tag.toString('hex'), payload.toString('hex')].join(':');
}

export function decryptSecret(value: string | undefined | null): string | undefined {
  const raw = normalizeSecret(value);
  if (!raw) return undefined;
  if (!raw.startsWith(`${ENC_PREFIX}:`)) return raw;

  const parts = raw.split(':');
  if (parts.length !== 5) return undefined;
  const [, , ivHex, tagHex, payloadHex] = parts;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKeyMaterial(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(payloadHex, 'hex')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  } catch {
    return undefined;
  }
}

export function maskSecret(value: string | undefined | null): string | undefined {
  const plain = decryptSecret(value);
  const normalized = normalizeSecret(plain ?? value);
  if (!normalized) return undefined;
  if (normalized.length <= 8) return `${normalized.slice(0, 2)}****`;
  return `${normalized.slice(0, 4)}****${normalized.slice(-4)}`;
}

export function hasSecretValue(value: string | undefined | null): boolean {
  return Boolean(normalizeSecret(value));
}
