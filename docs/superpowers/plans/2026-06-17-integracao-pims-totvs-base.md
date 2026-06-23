# Integracao PIMS / TOTVS Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a safe, tenant-isolated integration export foundation with local jobs, payload generation, adapters, APIs, UI, and ficha action, without any real PIMS/TOTVS connection.

**Architecture:** Keep the core deterministic and file-backed: a tenant-scoped job store persists `IntegrationExportJob` records, payload builders normalize ficha data, and adapters only emit local artifacts or placeholders. APIs enforce auth/RBAC and operate on the store; the UI reads from those APIs and surfaces job status, history, and actions without coupling to external systems.

**Tech Stack:** Next.js App Router, TypeScript, Node fs/json persistence, existing auth/RBAC/audit helpers, React client UI, Jest/ts-jest.

---

### Task 1: Define integration contracts and failing tests

**Files:**
- Create: `tests/integration-export-job.test.ts`
- Create: `lib/integrations/integration-types.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from '@jest/globals';
import { buildFichaIntegrationPayload, normalizeIntegrationPayload } from '@/lib/integrations/payloads/operator-sheet-payload';

test('normalizes ficha payload without undefined or NaN', () => {
  const payload = normalizeIntegrationPayload({
    tenantId: 't1',
    sheetId: 'sheet-1',
    horimetroInicial: '0,5',
    horimetroFinal: '1.6',
    totalHoras: NaN,
    inconsistencias: [undefined, 'OK'],
  });
  expect(JSON.stringify(payload)).not.toContain('undefined');
  expect(JSON.stringify(payload)).not.toContain('NaN');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/integration-export-job.test.ts -v`
Expected: FAIL because `normalizeIntegrationPayload` is not implemented.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface IntegrationExportJob { /* fields from spec */ }
export interface IntegrationExportResult { /* fields from spec */ }
export interface IntegrationAdapter { /* adapter contract from spec */ }
export function normalizeIntegrationPayload(input: unknown) { return input; }
export function buildFichaIntegrationPayload(input: unknown) { return normalizeIntegrationPayload(input); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/integration-export-job.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/integration-export-job.test.ts lib/integrations/integration-types.ts
git commit -m "test: add integration export contract coverage"
```

### Task 2: Implement tenant-scoped export job store

**Files:**
- Create: `lib/integrations/export-job-store.ts`
- Create: `lib/integrations/__tests__/export-job-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('creates, deduplicates, updates and retries jobs per tenant', () => {
  // exercise createJob/getJobById/listJobs/updateJobStatus/markProcessing/markExported/markFailed/retryJob/cancelJob
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/integrations/__tests__/export-job-store.test.ts -v`
Expected: FAIL because store methods do not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export const IntegrationExportJobStore = { /* file-backed methods */ };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/integrations/__tests__/export-job-store.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/integrations/export-job-store.ts lib/integrations/__tests__/export-job-store.test.ts
git commit -m "feat: add integration export job store"
```

### Task 3: Add adapters and payload builders

**Files:**
- Create: `lib/integrations/adapters/base-adapter.ts`
- Create: `lib/integrations/adapters/pims-file-adapter.ts`
- Create: `lib/integrations/adapters/totvs-placeholder-adapter.ts`
- Create: `lib/integrations/payloads/operator-sheet-payload.ts`
- Create: `lib/integrations/__tests__/pims-file-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('PIMS_FILE adapter writes a local export file and returns fileName', async () => {
  // create job, call export, assert file exists and job transitions to EXPORTED
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/integrations/__tests__/pims-file-adapter.test.ts -v`
Expected: FAIL because adapter is missing.

- [ ] **Step 3: Write minimal implementation**

```ts
export class PimsFileAdapter { /* local file writer only */ }
export class TotvsPlaceholderAdapter { /* placeholder, no network */ }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/integrations/__tests__/pims-file-adapter.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/integrations/adapters/base-adapter.ts lib/integrations/adapters/pims-file-adapter.ts lib/integrations/adapters/totvs-placeholder-adapter.ts lib/integrations/payloads/operator-sheet-payload.ts lib/integrations/__tests__/pims-file-adapter.test.ts
git commit -m "feat: add local integration adapters"
```

### Task 4: Add protected APIs and ficha action

**Files:**
- Create: `app/api/integrations/export-jobs/route.ts`
- Create: `app/api/integrations/export-jobs/[id]/route.ts`
- Create: `app/api/integrations/export-jobs/[id]/retry/route.ts`
- Create: `app/api/integrations/export-jobs/[id]/cancel/route.ts`
- Modify: `app/api/ficha-operador/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('POST /api/integrations/export-jobs blocks EM_ANDAMENTO ficha and accepts VALIDADO ficha', async () => {
  // use route handler test harness
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/api/integrations/export-jobs/__tests__/route.test.ts -v`
Expected: FAIL because route does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export async function GET() {}
export async function POST() {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/api/integrations/export-jobs/__tests__/route.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/integrations/export-jobs app/api/ficha-operador/route.ts
git commit -m "feat: add integration export job APIs"
```

### Task 5: Replace integrations UI with jobs dashboard

**Files:**
- Modify: `app/ferramentas/integracoes/page.tsx`

- [ ] **Step 1: Write the failing test**

```ts
test('renders export jobs summary cards and actions', () => {
  // render page shell and assert labels for pendentes/exportados/falhas
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/ferramentas/integracoes/__tests__/page.test.tsx -v`
Expected: FAIL because dashboard content is absent.

- [ ] **Step 3: Write minimal implementation**

```tsx
export default function IntegracoesPage() { /* jobs dashboard */ }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/ferramentas/integracoes/__tests__/page.test.tsx -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/ferramentas/integracoes/page.tsx
git commit -m "feat: add integrations jobs dashboard"
```

### Task 6: Validate end-to-end and harden

**Files:**
- Modify: any files required by prior tasks only

- [ ] **Step 1: Run lint**

Run: `npm run lint`

- [ ] **Step 2: Run type-check**

Run: `npm run type-check`

- [ ] **Step 3: Run build**

Run: `npm run build`

- [ ] **Step 4: Commit only scope files**

```bash
git status
git add <only-scope-files>
git commit -m "feat: add integration export jobs foundation"
```
