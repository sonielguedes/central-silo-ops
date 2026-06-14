# Central Audit Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce production audit risk by taming noisy UI errors, hardening health/deploy checks, separating demo behavior from production, and normalizing visible branding.

**Architecture:** Keep the changes surgical. Add a tiny client-side error feedback helper and wire it only into exposed admin/catalog screens. Improve `/api/health/full` to report operational state without secrets. Harden container/deploy files without changing runtime topology. Make demo indicators explicit and prevent silent mock fallback in production.

**Tech Stack:** Next.js App Router, React, TypeScript, Node.js filesystem APIs, Docker, Nginx.

---

### Task 1: Replace exposed alerts/confirms with controlled error feedback

**Files:**
- Create: `lib/ui/feedback.tsx`
- Modify: `app/administracao/empresas/page.tsx`
- Modify: `app/administracao/grupos-acesso/page.tsx`
- Modify: `app/administracao/usuarios/page.tsx`
- Modify: `app/frota/tipos/page.tsx`
- Modify: `app/frota/modelos/page.tsx`
- Modify: `app/equipamentos/page.tsx`
- Modify: `app/paradas/page.tsx`

- [ ] **Step 1: Add a failing test that asserts exposed actions no longer call `alert/confirm` on target screens**

```ts
// tests/ui-feedback.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const files = [
  'app/administracao/empresas/page.tsx',
  'app/administracao/grupos-acesso/page.tsx',
  'app/administracao/usuarios/page.tsx',
  'app/frota/tipos/page.tsx',
  'app/frota/modelos/page.tsx',
  'app/equipamentos/page.tsx',
  'app/paradas/page.tsx',
];

for (const file of files) {
  const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  assert.ok(!src.includes('alert('), `${file} still uses alert()`);
  assert.ok(!src.includes('confirm('), `${file} still uses confirm()`);
}
```

- [ ] **Step 2: Run the test to confirm it fails before code changes**

Run: `node --test tests/ui-feedback.test.mjs`
Expected: FAIL on the first file that still contains `alert(` or `confirm(`.

- [ ] **Step 3: Implement a minimal controlled feedback helper and wire it into the target screens**

```tsx
// lib/ui/feedback.tsx
"use client";
import React, { createContext, useContext, useState } from 'react';

type Feedback = { type: 'error' | 'success' | 'info'; message: string } | null;
const FeedbackContext = createContext<{ push: (f: Exclude<Feedback, null>) => void } | null>(null);

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  return (
    <FeedbackContext.Provider value={{ push: setFeedback }}>
      {children}
      {feedback ? (
        <div className="fixed bottom-4 right-4 z-[3000] rounded-xl border border-white/10 bg-[#0a0e27] px-4 py-3 text-xs font-bold text-white shadow-2xl">
          {feedback.message}
        </div>
      ) : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback must be used within FeedbackProvider');
  return ctx;
}
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run: `node --test tests/ui-feedback.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ui/feedback.tsx app/administracao/empresas/page.tsx app/administracao/grupos-acesso/page.tsx app/administracao/usuarios/page.tsx app/frota/tipos/page.tsx app/frota/modelos/page.tsx app/equipamentos/page.tsx app/paradas/page.tsx tests/ui-feedback.test.mjs
git commit -m "fix: replace exposed alerts with controlled feedback"
```

### Task 2: Harden `/api/health/full`

**Files:**
- Modify: `app/api/health/full/route.ts`
- Test: `tests/health-full.test.mjs`

- [ ] **Step 1: Write a failing test for status buckets and secret redaction**

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NextRequest } from 'next/server.js';

test('healthfull returns clear status and hides secrets', async () => {
  const mod = await import('../.next/server/app/api/health/full/route.js');
  const res = await mod.GET(new NextRequest('http://localhost/api/health/full'));
  const body = await res.json();
  assert.ok(['OK', 'DEGRADED', 'ERROR'].includes(body.status));
  assert.equal(body.SILO_AUTH_SECRET, undefined);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `node --test tests/health-full.test.mjs`
Expected: FAIL because current payload does not emit the required status enum.

- [ ] **Step 3: Update the route to compute app/data/env/latency and return `OK|DEGRADED|ERROR`**

```ts
// app/api/health/full/route.ts
const start = Date.now();
const envMissing = ['SILO_DATA_DIR', 'SILO_STORAGE_DIR'].every((key) => !process.env[key]);
const dataOk = dataDir.exists && dataDir.readable && dataDir.writable;
const appOk = true;
const status = appOk && dataOk && !envMissing ? 'OK' : dataDir.exists ? 'DEGRADED' : 'ERROR';
```

- [ ] **Step 4: Re-run the test and confirm it passes**

Run: `node --test tests/health-full.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/health/full/route.ts tests/health-full.test.mjs
git commit -m "fix: harden healthcheck payload"
```

### Task 3: Harden Docker/VPS artifacts

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `nginx.conf`
- Modify: `.env.production.example`

- [ ] **Step 1: Add a deployment config test that scans for healthcheck/restart/documented env keys**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('deploy files include healthcheck and env docs', () => {
  const compose = fs.readFileSync('docker-compose.yml', 'utf8');
  const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
  assert.ok(compose.includes('restart: unless-stopped'));
  assert.ok(dockerfile.includes('HEALTHCHECK'));
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/deploy-hardening.test.mjs`
Expected: FAIL until healthcheck and env docs exist.

- [ ] **Step 3: Add container healthcheck, persistent volume guidance, and explicit env docs**

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health/full').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

```yaml
restart: unless-stopped
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:3000/api/health/full | grep -q 'OK\\|DEGRADED'"]
```

- [ ] **Step 4: Re-run the test and confirm it passes**

Run: `node --test tests/deploy-hardening.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml nginx.conf .env.production.example tests/deploy-hardening.test.mjs
git commit -m "fix: harden deployment baseline"
```

### Task 4: Make demo/seed behavior explicit in production

**Files:**
- Modify: `lib/mock/master-data.ts`
- Modify: `services/base.service.ts`
- Modify: `lib/server-storage.ts`
- Modify: `components/layout/sidebar.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add a failing test for silent production mock fallback**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('production does not use mock fallback silently', () => {
  process.env.NODE_ENV = 'production';
  const { BaseService } = require('../services/base.service.ts');
  assert.ok(BaseService, 'service loaded');
});
```

- [ ] **Step 2: Run the test and confirm it fails if production still falls back to mock**

Run: `node --test tests/demo-fallback.test.mjs`
Expected: FAIL until production behavior is explicit.

- [ ] **Step 3: Make demo mode explicit with badge text and production fallback guard**

```ts
const IS_DEMO = process.env.NEXT_PUBLIC_APP_ENV === 'demo';
if (process.env.NODE_ENV === 'production' && !process.env.SILO_DATA_DIR && !process.env.SILO_STORAGE_DIR) {
  throw new Error('Production storage is not configured.');
}
```

```tsx
{isDemo ? <span className="...">Ambiente Demonstrativo</span> : null}
```

- [ ] **Step 4: Re-run the test and confirm it passes**

Run: `node --test tests/demo-fallback.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/mock/master-data.ts services/base.service.ts lib/server-storage.ts components/layout/sidebar.tsx app/layout.tsx tests/demo-fallback.test.mjs
git commit -m "fix: make demo mode explicit"
```

### Task 5: Normalize visible branding to SILO OPS

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/sincronizacao/page.tsx`
- Modify: `app/configuracoes/page.tsx`
- Modify: `app/relatorios/page.tsx`

- [ ] **Step 1: Add a small branding scan test for visible product text**

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const visibleFiles = [
  'components/layout/sidebar.tsx',
  'app/login/page.tsx',
  'app/layout.tsx',
  'app/sincronizacao/page.tsx',
  'app/configuracoes/page.tsx',
  'app/relatorios/page.tsx',
];

test('visible branding is normalized', () => {
  for (const file of visibleFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    assert.ok(!src.includes('PLMAGRO'));
    assert.ok(!src.includes('SGPA'));
    assert.ok(!src.includes('AgroSync'));
    assert.ok(!src.includes('Seeme'));
  }
});
```

- [ ] **Step 2: Run the test and confirm it fails on legacy visible copy**

Run: `node --test tests/branding-visible.test.mjs`
Expected: FAIL if any visible text still contains legacy terms.

- [ ] **Step 3: Replace only user-facing text with SILO OPS labels**

```tsx
<p>SILO OPS</p>
<p>Sistema de Inteligência Logística Operacional</p>
```

- [ ] **Step 4: Re-run the test and confirm it passes**

Run: `node --test tests/branding-visible.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/layout/sidebar.tsx app/login/page.tsx app/layout.tsx app/sincronizacao/page.tsx app/configuracoes/page.tsx app/relatorios/page.tsx tests/branding-visible.test.mjs
git commit -m "fix: normalize visible branding"
```

---

**Coverage check**
- Item 1: Task 1
- Item 2: Task 2
- Item 3: Task 3
- Item 4: Task 4
- Item 5: Task 5

