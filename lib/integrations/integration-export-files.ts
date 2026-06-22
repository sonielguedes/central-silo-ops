import fs from 'node:fs';
import path from 'node:path';

const DATA_ROOT =
  process.env.SILO_STORAGE_DIR ||
  process.env.SILO_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getTenantExportRoot(tenantId: string): string {
  const dir = path.join(DATA_ROOT, tenantId);
  ensureDir(dir);
  return dir;
}

export function getExportFolder(tenantId: string, exportId: string): string {
  const dir = path.join(getTenantExportRoot(tenantId), 'exports', exportId);
  ensureDir(dir);
  return dir;
}

export function resolveSafeExportPath(tenantId: string, exportId: string, fileName: string): string {
  const baseDir = path.resolve(getExportFolder(tenantId, exportId));
  const candidate = path.resolve(baseDir, fileName);
  if (!candidate.startsWith(baseDir + path.sep)) {
    throw new Error('Caminho de arquivo invalido');
  }
  return candidate;
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

export function readBuffer(filePath: string): Buffer {
  return fs.readFileSync(filePath);
}

export function existsFile(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function fileSize(filePath: string): number {
  return fs.statSync(filePath).size;
}

