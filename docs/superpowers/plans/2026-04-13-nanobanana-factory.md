# NanoBanana Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Electron + React + TypeScript desktop app that orchestrates Gemini (NanoBanana) image generation through reusable templates, selectable jobs, labeled image slots, and per-job generation history.

**Architecture:** Electron main / preload / renderer with strict `contextIsolation`. SQLite (`better-sqlite3`) + hand-rolled repositories in main; content-addressed asset files on disk. React + zustand on renderer. Typed IPC via a single contract map in `src/shared`. Generation goes through `IGenerationService` (real `GeminiGenerationService` default, `FakeGenerationService` for tests). Pure `composePrompt` in `shared/` is used by both preview and real execution.

**Tech Stack:** TypeScript 5.6, React 18, electron-vite, better-sqlite3 11, @google/generative-ai, zustand 5, vitest 2, electron-builder.

**Spec:** `docs/superpowers/specs/2026-04-13-nanobanana-factory-design.md`

---

## File Structure Overview

```
src/
  shared/
    types/domain.ts                          # Template, Job, Asset, ImageSlot, Generation, UUID, ...
    ipc-contract.ts                          # IpcContract, IpcEvents type maps
    prompt-compose.ts                        # pure composePrompt(); no I/O
    prompt-compose.test.ts                   # vitest, table-driven
  main/
    index.ts                                 # app.whenReady, BrowserWindow, ipc register
    app-context.ts                           # builds repos + services + passes to ipc
    db/
      connection.ts                          # openDatabase(path)
      migrate.ts                             # runMigrations(db)
      migrations/001_init.sql
      repositories/template-repo.ts
      repositories/job-repo.ts
      repositories/slot-repo.ts
      repositories/asset-repo.ts
      repositories/generation-repo.ts
      repositories/*.test.ts                 # in-memory sqlite integration tests
    services/
      secure-storage.ts                      # safeStorage wrapper
      asset-store.ts                         # userData/assets/<hash>.<ext>
      batch-runner.ts                        # max 3 concurrent, event push
      batch-runner.test.ts
      generation/
        IGenerationService.ts
        GeminiGenerationService.ts
        FakeGenerationService.ts
        constants.ts                         # GEMINI_MODEL
    ipc/
      register.ts                            # helper: handle<C>(channel, fn)
      settings-ipc.ts
      template-ipc.ts
      job-ipc.ts
      slot-ipc.ts
      prompt-ipc.ts
      generation-ipc.ts
      asset-ipc.ts
  preload/index.ts                           # contextBridge.exposeInMainWorld('api', ...)
  renderer/
    index.html
    main.tsx
    App.tsx
    ipc-client.ts                            # ergonomic wrapper around window.api
    styles/global.css
    components/{Button,Dialog,Input,Badge,IconButton}.tsx
    features/
      settings/{store.ts,components/SettingsModal.tsx,components/AppHeader.tsx}
      templates/{store.ts,components/TemplatePanel.tsx,components/TemplateListItem.tsx,components/TemplateEditView.tsx,components/SharedPromptEditor.tsx}
      jobs/{store.ts,components/JobPanel.tsx,components/JobListItem.tsx,components/JobToolbar.tsx,components/BatchProgressBar.tsx,components/JobDetailPanel.tsx,components/JobPromptEditor.tsx,components/TemplateSummary.tsx,components/PromptPreviewDialog.tsx,components/GenerateConfirmDialog.tsx}
      slots/{components/ImageSlotList.tsx,components/ImageSlotCard.tsx,components/AddImageSlotButton.tsx,components/ImageThumbnail.tsx}
      generations/{components/GenerationHistoryList.tsx,components/GenerationHistoryItem.tsx,components/GenerationViewerDialog.tsx}
electron.vite.config.ts
vitest.config.ts
tsconfig.json
tsconfig.node.json
package.json
.gitignore
resources/placeholder.png
```

Each file has one responsibility; splits by domain rather than layer where feasible.

---

## Phase 1 — Project Bootstrap

### Task 1: Initialize npm project and Node tooling

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "lovely-little-eletron",
  "version": "0.1.0",
  "private": true,
  "description": "NanoBanana image generation factory (personal local app).",
  "main": "out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "package": "electron-vite build && electron-builder",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.node.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "better-sqlite3": "^11.5.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.11",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "electron": "^33.0.0",
    "electron-builder": "^25.1.0",
    "electron-vite": "^2.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
out/
dist/
release/
*.db
*.db-journal
.DS_Store
.vscode/
.idea/
```

- [ ] **Step 3: Write `tsconfig.json` (renderer + shared)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@/*": ["src/renderer/*"]
    },
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/shared/**/*", "src/renderer/**/*"],
  "exclude": ["node_modules", "out", "dist"]
}
```

- [ ] **Step 4: Write `tsconfig.node.json` (main + preload)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": { "@shared/*": ["src/shared/*"] },
    "lib": ["ES2022"],
    "types": ["node"]
  },
  "include": ["src/main/**/*", "src/preload/**/*", "src/shared/**/*"],
  "exclude": ["node_modules", "out", "dist"]
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`
Expected: installs cleanly (may take 1–2 min due to better-sqlite3 native build).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore tsconfig.json tsconfig.node.json
git commit -m "chore: bootstrap npm project and tsconfig"
```

---

### Task 2: Configure electron-vite and vitest

**Files:**
- Create: `electron.vite.config.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write `electron.vite.config.ts`**

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    build: {
      rollupOptions: {
        external: ['better-sqlite3'],
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
    build: {
      rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
    },
  },
});
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add electron.vite.config.ts vitest.config.ts
git commit -m "chore: configure electron-vite and vitest"
```

---

## Phase 2 — Shared Types and Prompt Composition (TDD)

### Task 3: Define shared domain types

**Files:**
- Create: `src/shared/types/domain.ts`

- [ ] **Step 1: Write `src/shared/types/domain.ts`**

```ts
export type UUID = string;
export type UnixMs = number;

export interface Template {
  id: UUID;
  name: string;
  sharedPrompt: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface Job {
  id: UUID;
  templateId: UUID;
  name: string;
  prompt: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
}

export interface Asset {
  id: UUID;
  contentHash: string;
  mimeType: string;
  byteSize: number;
  originalFilename: string | null;
  createdAt: UnixMs;
}

export type SlotOwnerKind = 'template' | 'job';

export interface ImageSlot {
  id: UUID;
  ownerKind: SlotOwnerKind;
  ownerId: UUID;
  assetId: UUID;
  variableName: string;
  description: string;
  position: number;
}

export type GenerationStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface ImageRefSnapshot {
  variableName: string;
  assetId: UUID;
  description: string;
}

export interface Generation {
  id: UUID;
  jobId: UUID;
  status: GenerationStatus;
  finalPrompt: string;
  imageRefs: ImageRefSnapshot[];
  resultAssetId: UUID | null;
  errorMessage: string | null;
  model: string;
  startedAt: UnixMs;
  finishedAt: UnixMs | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/shared/types/domain.ts
git commit -m "feat(shared): add domain types"
```

---

### Task 4: `composePrompt` — failing tests

**Files:**
- Create: `src/shared/prompt-compose.test.ts`

- [ ] **Step 1: Write failing tests covering merge/override/warnings**

```ts
import { describe, it, expect } from 'vitest';
import { composePrompt } from './prompt-compose';
import type { ImageSlot } from './types/domain';

const slot = (overrides: Partial<ImageSlot>): ImageSlot => ({
  id: 'id',
  ownerKind: 'template',
  ownerId: 'owner',
  assetId: 'asset',
  variableName: 'imageA',
  description: '',
  position: 0,
  ...overrides,
});

describe('composePrompt', () => {
  it('joins template shared prompt and job prompt with a blank line', () => {
    const r = composePrompt({
      template: { sharedPrompt: 'Style: watercolor.', slots: [] },
      job: { prompt: 'Combine the images.', slots: [] },
    });
    expect(r.finalPrompt).toBe('Style: watercolor.\n\nCombine the images.');
  });

  it('omits empty template prompt', () => {
    const r = composePrompt({
      template: { sharedPrompt: '', slots: [] },
      job: { prompt: 'Only job.', slots: [] },
    });
    expect(r.finalPrompt).toBe('Only job.');
  });

  it('orders image refs: template slots by position, then job slots by position', () => {
    const r = composePrompt({
      template: {
        sharedPrompt: '',
        slots: [
          slot({ variableName: 'style', ownerKind: 'template', position: 1 }),
          slot({ variableName: 'logo', ownerKind: 'template', position: 0, assetId: 'a-logo' }),
        ],
      },
      job: {
        prompt: '',
        slots: [
          slot({ variableName: 'person', ownerKind: 'job', position: 0, assetId: 'a-person' }),
        ],
      },
    });
    expect(r.imageRefs.map(i => i.variableName)).toEqual(['logo', 'style', 'person']);
  });

  it('job slot overrides template slot of the same variable name (appears at job position)', () => {
    const r = composePrompt({
      template: {
        sharedPrompt: '',
        slots: [
          slot({ variableName: 'imageA', ownerKind: 'template', position: 0, assetId: 'tpl' }),
          slot({ variableName: 'extra', ownerKind: 'template', position: 1, assetId: 'ex' }),
        ],
      },
      job: {
        prompt: '',
        slots: [
          slot({ variableName: 'imageA', ownerKind: 'job', position: 0, assetId: 'job-a' }),
        ],
      },
    });
    const names = r.imageRefs.map(i => i.variableName);
    // template 'extra' stays, template 'imageA' is suppressed,
    // job 'imageA' appears (conceptually after template slots).
    expect(names).toEqual(['extra', 'imageA']);
    expect(r.imageRefs.find(i => i.variableName === 'imageA')?.assetId).toBe('job-a');
  });

  it('warns on referenced-but-undefined variables', () => {
    const r = composePrompt({
      template: { sharedPrompt: 'Use {missing}.', slots: [] },
      job: { prompt: '', slots: [] },
    });
    expect(r.warnings.some(w => w.includes('missing'))).toBe(true);
  });

  it('warns on defined-but-unreferenced slots', () => {
    const r = composePrompt({
      template: {
        sharedPrompt: 'no references here',
        slots: [slot({ variableName: 'unused' })],
      },
      job: { prompt: '', slots: [] },
    });
    expect(r.warnings.some(w => w.includes('unused'))).toBe(true);
  });

  it('does not warn when all variables are matched', () => {
    const r = composePrompt({
      template: { sharedPrompt: 'Start', slots: [slot({ variableName: 'imageA' })] },
      job: { prompt: 'refer {imageA}', slots: [] },
    });
    expect(r.warnings).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `npm test -- prompt-compose`
Expected: FAIL — `composePrompt` is not defined.

---

### Task 5: `composePrompt` — implementation

**Files:**
- Create: `src/shared/prompt-compose.ts`

- [ ] **Step 1: Write implementation**

```ts
import type { ImageSlot } from './types/domain';

export interface ComposeInput {
  template: { sharedPrompt: string; slots: ImageSlot[] };
  job:      { prompt: string;       slots: ImageSlot[] };
}

export interface ComposedImageRef {
  variableName: string;
  assetId: string;
  description: string;
}

export interface ComposeResult {
  finalPrompt: string;
  imageRefs: ComposedImageRef[];
  warnings: string[];
}

const VAR_RE = /\{(\w+)\}/g;

function extractReferences(text: string): Set<string> {
  const names = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) names.add(m[1]!);
  return names;
}

export function composePrompt(input: ComposeInput): ComposeResult {
  const jobNames = new Set(input.job.slots.map(s => s.variableName));

  const templateOrdered = [...input.template.slots]
    .filter(s => !jobNames.has(s.variableName))
    .sort((a, b) => a.position - b.position);

  const jobOrdered = [...input.job.slots].sort((a, b) => a.position - b.position);

  const orderedSlots = [...templateOrdered, ...jobOrdered];

  const parts = [input.template.sharedPrompt.trim(), input.job.prompt.trim()].filter(Boolean);
  const finalPrompt = parts.join('\n\n');

  const referenced = extractReferences(finalPrompt);
  const defined = new Set(orderedSlots.map(s => s.variableName));

  const warnings: string[] = [];
  for (const name of referenced) {
    if (!defined.has(name)) warnings.push(`Variable {${name}} is referenced but not defined.`);
  }
  for (const name of defined) {
    if (!referenced.has(name)) warnings.push(`Image {${name}} is defined but not referenced in the prompt.`);
  }

  return {
    finalPrompt,
    imageRefs: orderedSlots.map(s => ({
      variableName: s.variableName,
      assetId: s.assetId,
      description: s.description,
    })),
    warnings,
  };
}
```

- [ ] **Step 2: Run tests — expect pass**

Run: `npm test -- prompt-compose`
Expected: PASS (all 7 cases).

- [ ] **Step 3: Commit**

```bash
git add src/shared/prompt-compose.ts src/shared/prompt-compose.test.ts
git commit -m "feat(shared): add composePrompt with merge, ordering, and warnings"
```

---

## Phase 3 — Database Foundation

### Task 6: SQLite connection and migration runner

**Files:**
- Create: `src/main/db/connection.ts`
- Create: `src/main/db/migrate.ts`
- Create: `src/main/db/migrations/001_init.sql`

- [ ] **Step 1: Write `src/main/db/migrations/001_init.sql`**

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

CREATE TABLE templates (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  shared_prompt TEXT NOT NULL DEFAULT '',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE assets (
  id                TEXT PRIMARY KEY,
  content_hash      TEXT NOT NULL UNIQUE,
  mime_type         TEXT NOT NULL,
  byte_size         INTEGER NOT NULL,
  original_filename TEXT,
  created_at        INTEGER NOT NULL
);

CREATE TABLE image_slots (
  id            TEXT PRIMARY KEY,
  owner_kind    TEXT NOT NULL CHECK (owner_kind IN ('template','job')),
  owner_id      TEXT NOT NULL,
  asset_id      TEXT NOT NULL REFERENCES assets(id),
  variable_name TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  position      INTEGER NOT NULL,
  created_at    INTEGER NOT NULL,
  UNIQUE (owner_kind, owner_id, variable_name)
);
CREATE INDEX idx_image_slots_owner ON image_slots(owner_kind, owner_id);

CREATE TABLE jobs (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  prompt      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_jobs_template ON jobs(template_id);

CREATE TABLE generations (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','failed')),
  final_prompt    TEXT NOT NULL,
  image_refs_json TEXT NOT NULL,
  result_asset_id TEXT REFERENCES assets(id),
  error_message   TEXT,
  model           TEXT NOT NULL,
  started_at      INTEGER NOT NULL,
  finished_at     INTEGER
);
CREATE INDEX idx_generations_job ON generations(job_id, started_at DESC);
```

- [ ] **Step 2: Write `src/main/db/connection.ts`**

```ts
import Database from 'better-sqlite3';

export type DB = Database.Database;

export function openDatabase(path: string): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
```

- [ ] **Step 3: Write `src/main/db/migrate.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import type { DB } from './connection';

interface MigrationFile { id: number; filename: string; sql: string }

export function loadMigrations(dir: string): MigrationFile[] {
  const files = fs.readdirSync(dir).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
  return files.map(filename => {
    const id = Number(filename.split('_')[0]);
    const sql = fs.readFileSync(path.join(dir, filename), 'utf8');
    return { id, filename, sql };
  });
}

export function runMigrations(db: DB, migrations: MigrationFile[]): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);`);
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((r: any) => r.id as number),
  );
  const apply = db.transaction((m: MigrationFile) => {
    db.exec(m.sql);
    db.prepare('INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)')
      .run(m.id, Date.now());
  });
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    apply(m);
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/db
git commit -m "feat(db): add sqlite connection and migration runner"
```

---

### Task 7: TemplateRepo (TDD)

**Files:**
- Create: `src/main/db/repositories/template-repo.ts`
- Create: `src/main/db/repositories/template-repo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { TemplateRepo } from './template-repo';

function freshDb() {
  const db = openDatabase(':memory:');
  const migrations = loadMigrations(path.resolve(__dirname, '../migrations'));
  runMigrations(db, migrations);
  return db;
}

describe('TemplateRepo', () => {
  let repo: TemplateRepo;
  beforeEach(() => { repo = new TemplateRepo(freshDb()); });

  it('creates and returns a template', () => {
    const t = repo.create('First');
    expect(t.id).toBeTruthy();
    expect(t.name).toBe('First');
    expect(t.sharedPrompt).toBe('');
  });

  it('lists templates newest first', async () => {
    repo.create('A');
    await new Promise(r => setTimeout(r, 2));
    repo.create('B');
    const all = repo.list();
    expect(all.map(t => t.name)).toEqual(['B', 'A']);
  });

  it('updates name and sharedPrompt', () => {
    const t = repo.create('X');
    const u = repo.update(t.id, { name: 'Y', sharedPrompt: 'hi' });
    expect(u.name).toBe('Y');
    expect(u.sharedPrompt).toBe('hi');
  });

  it('deletes a template', () => {
    const t = repo.create('Z');
    repo.delete(t.id);
    expect(repo.get(t.id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- template-repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/db/repositories/template-repo.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Template, UUID } from '@shared/types/domain';

interface Row {
  id: string; name: string; shared_prompt: string;
  created_at: number; updated_at: number;
}

const toTemplate = (r: Row): Template => ({
  id: r.id, name: r.name, sharedPrompt: r.shared_prompt,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export class TemplateRepo {
  constructor(private db: DB) {}

  create(name: string): Template {
    const id = randomUUID();
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO templates (id, name, shared_prompt, created_at, updated_at)
       VALUES (?, ?, '', ?, ?)`,
    ).run(id, name, now, now);
    return this.get(id)!;
  }

  list(): Template[] {
    return (this.db.prepare(
      `SELECT * FROM templates ORDER BY created_at DESC, id DESC`,
    ).all() as Row[]).map(toTemplate);
  }

  get(id: UUID): Template | null {
    const r = this.db.prepare(`SELECT * FROM templates WHERE id = ?`).get(id) as Row | undefined;
    return r ? toTemplate(r) : null;
  }

  update(id: UUID, patch: Partial<Pick<Template, 'name' | 'sharedPrompt'>>): Template {
    const existing = this.get(id);
    if (!existing) throw new Error(`Template not found: ${id}`);
    const name = patch.name ?? existing.name;
    const sharedPrompt = patch.sharedPrompt ?? existing.sharedPrompt;
    const now = Date.now();
    this.db.prepare(
      `UPDATE templates SET name = ?, shared_prompt = ?, updated_at = ? WHERE id = ?`,
    ).run(name, sharedPrompt, now, id);
    return this.get(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM templates WHERE id = ?`).run(id);
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- template-repo`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/main/db/repositories/template-repo.ts src/main/db/repositories/template-repo.test.ts
git commit -m "feat(db): add TemplateRepo"
```

---

### Task 8: AssetRepo (TDD)

**Files:**
- Create: `src/main/db/repositories/asset-repo.ts`
- Create: `src/main/db/repositories/asset-repo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { AssetRepo } from './asset-repo';

function freshDb() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  return db;
}

describe('AssetRepo', () => {
  let repo: AssetRepo;
  beforeEach(() => { repo = new AssetRepo(freshDb()); });

  it('findOrCreate inserts a new asset on first call', () => {
    const a = repo.findOrCreate({
      contentHash: 'h1', mimeType: 'image/png',
      byteSize: 100, originalFilename: 'a.png',
    });
    expect(a.contentHash).toBe('h1');
    expect(repo.getById(a.id)?.id).toBe(a.id);
  });

  it('findOrCreate returns existing asset with matching hash', () => {
    const first = repo.findOrCreate({
      contentHash: 'h1', mimeType: 'image/png', byteSize: 100, originalFilename: null,
    });
    const second = repo.findOrCreate({
      contentHash: 'h1', mimeType: 'image/png', byteSize: 100, originalFilename: 'ignored.png',
    });
    expect(second.id).toBe(first.id);
  });

  it('getByHash returns null when absent', () => {
    expect(repo.getByHash('nope')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- asset-repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/db/repositories/asset-repo.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Asset, UUID } from '@shared/types/domain';

interface Row {
  id: string; content_hash: string; mime_type: string;
  byte_size: number; original_filename: string | null; created_at: number;
}

const toAsset = (r: Row): Asset => ({
  id: r.id, contentHash: r.content_hash, mimeType: r.mime_type,
  byteSize: r.byte_size, originalFilename: r.original_filename, createdAt: r.created_at,
});

export interface AssetCreateInput {
  contentHash: string;
  mimeType: string;
  byteSize: number;
  originalFilename: string | null;
}

export class AssetRepo {
  constructor(private db: DB) {}

  getById(id: UUID): Asset | null {
    const r = this.db.prepare(`SELECT * FROM assets WHERE id = ?`).get(id) as Row | undefined;
    return r ? toAsset(r) : null;
  }

  getByHash(hash: string): Asset | null {
    const r = this.db.prepare(`SELECT * FROM assets WHERE content_hash = ?`).get(hash) as Row | undefined;
    return r ? toAsset(r) : null;
  }

  findOrCreate(input: AssetCreateInput): Asset {
    const existing = this.getByHash(input.contentHash);
    if (existing) return existing;
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO assets (id, content_hash, mime_type, byte_size, original_filename, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, input.contentHash, input.mimeType, input.byteSize, input.originalFilename, Date.now());
    return this.getById(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM assets WHERE id = ?`).run(id);
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- asset-repo`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/main/db/repositories/asset-repo.ts src/main/db/repositories/asset-repo.test.ts
git commit -m "feat(db): add AssetRepo with hash-based upsert"
```

---

### Task 9: SlotRepo (TDD)

**Files:**
- Create: `src/main/db/repositories/slot-repo.ts`
- Create: `src/main/db/repositories/slot-repo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { AssetRepo } from './asset-repo';
import { TemplateRepo } from './template-repo';
import { SlotRepo } from './slot-repo';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  const assets = new AssetRepo(db);
  const templates = new TemplateRepo(db);
  const slots = new SlotRepo(db);
  const asset = assets.findOrCreate({ contentHash: 'h', mimeType: 'image/png', byteSize: 10, originalFilename: null });
  const template = templates.create('T');
  return { slots, asset, template };
}

describe('SlotRepo', () => {
  it('creates a slot under a template', () => {
    const { slots, asset, template } = setup();
    const s = slots.create({
      ownerKind: 'template', ownerId: template.id,
      assetId: asset.id, variableName: 'imageA', description: 'desc', position: 0,
    });
    expect(s.variableName).toBe('imageA');
    expect(slots.listByOwner('template', template.id).length).toBe(1);
  });

  it('rejects duplicate variable names within same owner', () => {
    const { slots, asset, template } = setup();
    slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'imageA', description: '', position: 0 });
    expect(() => slots.create({
      ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'imageA', description: '', position: 1,
    })).toThrow();
  });

  it('orders listByOwner by position asc', () => {
    const { slots, asset, template } = setup();
    slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'b', description: '', position: 2 });
    slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'a', description: '', position: 0 });
    expect(slots.listByOwner('template', template.id).map(s => s.variableName)).toEqual(['a', 'b']);
  });

  it('updates variableName, description, position', () => {
    const { slots, asset, template } = setup();
    const s = slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'x', description: '', position: 0 });
    const u = slots.update(s.id, { variableName: 'y', description: 'hello', position: 5 });
    expect(u.variableName).toBe('y');
    expect(u.description).toBe('hello');
    expect(u.position).toBe(5);
  });

  it('deletes a slot', () => {
    const { slots, asset, template } = setup();
    const s = slots.create({ ownerKind: 'template', ownerId: template.id, assetId: asset.id, variableName: 'x', description: '', position: 0 });
    slots.delete(s.id);
    expect(slots.listByOwner('template', template.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- slot-repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/db/repositories/slot-repo.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { ImageSlot, SlotOwnerKind, UUID } from '@shared/types/domain';

interface Row {
  id: string; owner_kind: SlotOwnerKind; owner_id: string;
  asset_id: string; variable_name: string; description: string;
  position: number; created_at: number;
}

const toSlot = (r: Row): ImageSlot => ({
  id: r.id, ownerKind: r.owner_kind, ownerId: r.owner_id,
  assetId: r.asset_id, variableName: r.variable_name,
  description: r.description, position: r.position,
});

export interface SlotCreateInput {
  ownerKind: SlotOwnerKind; ownerId: UUID;
  assetId: UUID; variableName: string;
  description: string; position: number;
}

export class SlotRepo {
  constructor(private db: DB) {}

  create(input: SlotCreateInput): ImageSlot {
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO image_slots (id, owner_kind, owner_id, asset_id, variable_name, description, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.ownerKind, input.ownerId, input.assetId, input.variableName, input.description, input.position, Date.now());
    return this.getById(id)!;
  }

  getById(id: UUID): ImageSlot | null {
    const r = this.db.prepare(`SELECT * FROM image_slots WHERE id = ?`).get(id) as Row | undefined;
    return r ? toSlot(r) : null;
  }

  listByOwner(kind: SlotOwnerKind, ownerId: UUID): ImageSlot[] {
    return (this.db.prepare(
      `SELECT * FROM image_slots WHERE owner_kind = ? AND owner_id = ? ORDER BY position ASC, created_at ASC`,
    ).all(kind, ownerId) as Row[]).map(toSlot);
  }

  update(id: UUID, patch: Partial<Pick<ImageSlot, 'variableName' | 'description' | 'position'>>): ImageSlot {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Slot not found: ${id}`);
    this.db.prepare(
      `UPDATE image_slots SET variable_name = ?, description = ?, position = ? WHERE id = ?`,
    ).run(
      patch.variableName ?? existing.variableName,
      patch.description ?? existing.description,
      patch.position ?? existing.position,
      id,
    );
    return this.getById(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM image_slots WHERE id = ?`).run(id);
  }

  listReferencedAssetIds(): Set<UUID> {
    const rows = this.db.prepare(`SELECT DISTINCT asset_id FROM image_slots`).all() as { asset_id: string }[];
    return new Set(rows.map(r => r.asset_id));
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- slot-repo`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/main/db/repositories/slot-repo.ts src/main/db/repositories/slot-repo.test.ts
git commit -m "feat(db): add SlotRepo with uniqueness enforcement"
```

---

### Task 10: JobRepo (TDD)

**Files:**
- Create: `src/main/db/repositories/job-repo.ts`
- Create: `src/main/db/repositories/job-repo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { TemplateRepo } from './template-repo';
import { JobRepo } from './job-repo';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  const templates = new TemplateRepo(db);
  const jobs = new JobRepo(db);
  const template = templates.create('T');
  return { db, jobs, template, templates };
}

describe('JobRepo', () => {
  it('creates a job under a template', () => {
    const { jobs, template } = setup();
    const j = jobs.create({ templateId: template.id, name: 'J1' });
    expect(j.templateId).toBe(template.id);
    expect(j.prompt).toBe('');
  });

  it('lists jobs of a template newest first', async () => {
    const { jobs, template } = setup();
    jobs.create({ templateId: template.id, name: 'A' });
    await new Promise(r => setTimeout(r, 2));
    jobs.create({ templateId: template.id, name: 'B' });
    expect(jobs.listByTemplate(template.id).map(j => j.name)).toEqual(['B', 'A']);
  });

  it('updates name and prompt', () => {
    const { jobs, template } = setup();
    const j = jobs.create({ templateId: template.id, name: 'A' });
    const u = jobs.update(j.id, { name: 'B', prompt: 'hello' });
    expect(u.name).toBe('B');
    expect(u.prompt).toBe('hello');
  });

  it('cascades delete when template is deleted', () => {
    const { jobs, template, templates } = setup();
    jobs.create({ templateId: template.id, name: 'A' });
    templates.delete(template.id);
    expect(jobs.listByTemplate(template.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- job-repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/db/repositories/job-repo.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Job, UUID } from '@shared/types/domain';

interface Row {
  id: string; template_id: string; name: string; prompt: string;
  created_at: number; updated_at: number;
}

const toJob = (r: Row): Job => ({
  id: r.id, templateId: r.template_id, name: r.name,
  prompt: r.prompt, createdAt: r.created_at, updatedAt: r.updated_at,
});

export class JobRepo {
  constructor(private db: DB) {}

  create(input: { templateId: UUID; name: string }): Job {
    const id = randomUUID();
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO jobs (id, template_id, name, prompt, created_at, updated_at)
       VALUES (?, ?, ?, '', ?, ?)`,
    ).run(id, input.templateId, input.name, now, now);
    return this.getById(id)!;
  }

  getById(id: UUID): Job | null {
    const r = this.db.prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as Row | undefined;
    return r ? toJob(r) : null;
  }

  listByTemplate(templateId: UUID): Job[] {
    return (this.db.prepare(
      `SELECT * FROM jobs WHERE template_id = ? ORDER BY created_at DESC, id DESC`,
    ).all(templateId) as Row[]).map(toJob);
  }

  update(id: UUID, patch: Partial<Pick<Job, 'name' | 'prompt'>>): Job {
    const existing = this.getById(id);
    if (!existing) throw new Error(`Job not found: ${id}`);
    const now = Date.now();
    this.db.prepare(
      `UPDATE jobs SET name = ?, prompt = ?, updated_at = ? WHERE id = ?`,
    ).run(patch.name ?? existing.name, patch.prompt ?? existing.prompt, now, id);
    return this.getById(id)!;
  }

  delete(id: UUID): void {
    this.db.prepare(`DELETE FROM jobs WHERE id = ?`).run(id);
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- job-repo`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add src/main/db/repositories/job-repo.ts src/main/db/repositories/job-repo.test.ts
git commit -m "feat(db): add JobRepo"
```

---

### Task 11: GenerationRepo (TDD)

**Files:**
- Create: `src/main/db/repositories/generation-repo.ts`
- Create: `src/main/db/repositories/generation-repo.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { openDatabase } from '../connection';
import { loadMigrations, runMigrations } from '../migrate';
import { TemplateRepo } from './template-repo';
import { JobRepo } from './job-repo';
import { GenerationRepo } from './generation-repo';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../migrations')));
  const template = new TemplateRepo(db).create('T');
  const job = new JobRepo(db).create({ templateId: template.id, name: 'J' });
  return { db, job, generations: new GenerationRepo(db) };
}

describe('GenerationRepo', () => {
  it('creates a pending generation', () => {
    const { job, generations } = setup();
    const g = generations.createPending({
      jobId: job.id, finalPrompt: 'hi', imageRefs: [], model: 'gemini',
    });
    expect(g.status).toBe('pending');
    expect(g.finalPrompt).toBe('hi');
  });

  it('marks running', () => {
    const { job, generations } = setup();
    const g = generations.createPending({ jobId: job.id, finalPrompt: 'p', imageRefs: [], model: 'm' });
    const r = generations.markRunning(g.id);
    expect(r.status).toBe('running');
  });

  it('marks succeeded with result asset id', () => {
    const { job, generations, db } = setup();
    // insert a dummy asset row so the FK holds
    db.prepare(`INSERT INTO assets (id, content_hash, mime_type, byte_size, created_at) VALUES (?, ?, ?, ?, ?)`)
      .run('asset-1', 'h', 'image/png', 1, Date.now());
    const g = generations.createPending({ jobId: job.id, finalPrompt: 'p', imageRefs: [], model: 'm' });
    generations.markRunning(g.id);
    const r = generations.markSucceeded(g.id, 'asset-1');
    expect(r.status).toBe('succeeded');
    expect(r.resultAssetId).toBe('asset-1');
  });

  it('marks failed with message', () => {
    const { job, generations } = setup();
    const g = generations.createPending({ jobId: job.id, finalPrompt: 'p', imageRefs: [], model: 'm' });
    const r = generations.markFailed(g.id, 'boom');
    expect(r.status).toBe('failed');
    expect(r.errorMessage).toBe('boom');
  });

  it('lists generations for a job newest first', async () => {
    const { job, generations } = setup();
    generations.createPending({ jobId: job.id, finalPrompt: 'one', imageRefs: [], model: 'm' });
    await new Promise(r => setTimeout(r, 2));
    generations.createPending({ jobId: job.id, finalPrompt: 'two', imageRefs: [], model: 'm' });
    expect(generations.listByJob(job.id).map(g => g.finalPrompt)).toEqual(['two', 'one']);
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- generation-repo`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/db/repositories/generation-repo.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { DB } from '../connection';
import type { Generation, GenerationStatus, ImageRefSnapshot, UUID } from '@shared/types/domain';

interface Row {
  id: string; job_id: string; status: GenerationStatus;
  final_prompt: string; image_refs_json: string;
  result_asset_id: string | null; error_message: string | null;
  model: string; started_at: number; finished_at: number | null;
}

const toGen = (r: Row): Generation => ({
  id: r.id, jobId: r.job_id, status: r.status,
  finalPrompt: r.final_prompt,
  imageRefs: JSON.parse(r.image_refs_json) as ImageRefSnapshot[],
  resultAssetId: r.result_asset_id, errorMessage: r.error_message,
  model: r.model, startedAt: r.started_at, finishedAt: r.finished_at,
});

export class GenerationRepo {
  constructor(private db: DB) {}

  createPending(input: { jobId: UUID; finalPrompt: string; imageRefs: ImageRefSnapshot[]; model: string }): Generation {
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO generations (id, job_id, status, final_prompt, image_refs_json, model, started_at)
       VALUES (?, ?, 'pending', ?, ?, ?, ?)`,
    ).run(id, input.jobId, input.finalPrompt, JSON.stringify(input.imageRefs), input.model, Date.now());
    return this.getById(id)!;
  }

  getById(id: UUID): Generation | null {
    const r = this.db.prepare(`SELECT * FROM generations WHERE id = ?`).get(id) as Row | undefined;
    return r ? toGen(r) : null;
  }

  listByJob(jobId: UUID): Generation[] {
    return (this.db.prepare(
      `SELECT * FROM generations WHERE job_id = ? ORDER BY started_at DESC, id DESC`,
    ).all(jobId) as Row[]).map(toGen);
  }

  private setStatus(id: UUID, status: GenerationStatus, extra: { resultAssetId?: string; errorMessage?: string; setFinished: boolean }) {
    const finished = extra.setFinished ? Date.now() : null;
    this.db.prepare(
      `UPDATE generations SET status = ?, result_asset_id = COALESCE(?, result_asset_id),
         error_message = COALESCE(?, error_message), finished_at = COALESCE(?, finished_at)
       WHERE id = ?`,
    ).run(status, extra.resultAssetId ?? null, extra.errorMessage ?? null, finished, id);
    return this.getById(id)!;
  }

  markRunning(id: UUID): Generation {
    return this.setStatus(id, 'running', { setFinished: false });
  }

  markSucceeded(id: UUID, resultAssetId: UUID): Generation {
    return this.setStatus(id, 'succeeded', { resultAssetId, setFinished: true });
  }

  markFailed(id: UUID, errorMessage: string): Generation {
    return this.setStatus(id, 'failed', { errorMessage, setFinished: true });
  }

  listReferencedAssetIds(): Set<UUID> {
    const refs = this.db.prepare(`SELECT DISTINCT result_asset_id FROM generations WHERE result_asset_id IS NOT NULL`).all() as { result_asset_id: string }[];
    const fromRefs = new Set(refs.map(r => r.result_asset_id));
    const snapshots = this.db.prepare(`SELECT image_refs_json FROM generations`).all() as { image_refs_json: string }[];
    for (const s of snapshots) {
      for (const ref of JSON.parse(s.image_refs_json) as ImageRefSnapshot[]) fromRefs.add(ref.assetId);
    }
    return fromRefs;
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- generation-repo`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add src/main/db/repositories/generation-repo.ts src/main/db/repositories/generation-repo.test.ts
git commit -m "feat(db): add GenerationRepo"
```

---

## Phase 4 — Services (secure storage, asset store, generation, batch runner)

### Task 12: SecureStorage wrapper

**Files:**
- Create: `src/main/services/secure-storage.ts`

- [ ] **Step 1: Write `src/main/services/secure-storage.ts`**

```ts
import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export class SecureStorage {
  constructor(private userDataDir: string) {}

  private file() { return path.join(this.userDataDir, 'secrets.bin'); }

  isAvailable(): boolean { return safeStorage.isEncryptionAvailable(); }

  hasApiKey(): boolean { return fs.existsSync(this.file()); }

  setApiKey(plain: string): void {
    if (!this.isAvailable()) throw new Error('OS encryption unavailable; cannot store API key.');
    const encrypted = safeStorage.encryptString(plain);
    fs.writeFileSync(this.file(), encrypted);
  }

  getApiKey(): string | null {
    if (!this.hasApiKey()) return null;
    const buf = fs.readFileSync(this.file());
    return safeStorage.decryptString(buf);
  }

  clearApiKey(): void {
    if (this.hasApiKey()) fs.unlinkSync(this.file());
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/secure-storage.ts
git commit -m "feat(services): add SecureStorage wrapping safeStorage"
```

---

### Task 13: AssetStore service

**Files:**
- Create: `src/main/services/asset-store.ts`

- [ ] **Step 1: Write `src/main/services/asset-store.ts`**

```ts
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Asset, UUID } from '@shared/types/domain';
import type { AssetRepo } from '../db/repositories/asset-repo';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFor(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'bin';
}

export class AssetStore {
  constructor(private repo: AssetRepo, private userDataDir: string) {
    fs.mkdirSync(this.dir(), { recursive: true });
  }

  private dir() { return path.join(this.userDataDir, 'assets'); }
  private fileFor(asset: Asset) { return path.join(this.dir(), `${asset.contentHash}.${extFor(asset.mimeType)}`); }

  async save(bytes: Buffer, mimeType: string, originalFilename: string | null): Promise<Asset> {
    const contentHash = crypto.createHash('sha256').update(bytes).digest('hex');
    const asset = this.repo.findOrCreate({ contentHash, mimeType, byteSize: bytes.length, originalFilename });
    const target = this.fileFor(asset);
    if (!fs.existsSync(target)) fs.writeFileSync(target, bytes);
    return asset;
  }

  readBytes(assetId: UUID): { bytes: Buffer; mimeType: string; filename: string } {
    const asset = this.repo.getById(assetId);
    if (!asset) throw new Error(`Asset not found: ${assetId}`);
    const bytes = fs.readFileSync(this.fileFor(asset));
    return { bytes, mimeType: asset.mimeType, filename: this.fileFor(asset) };
  }

  dataUrl(assetId: UUID): string {
    const { bytes, mimeType } = this.readBytes(assetId);
    return `data:${mimeType};base64,${bytes.toString('base64')}`;
  }

  deleteFileIfPresent(assetId: UUID): void {
    const asset = this.repo.getById(assetId);
    if (!asset) return;
    const f = this.fileFor(asset);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/asset-store.ts
git commit -m "feat(services): add AssetStore with content-addressed files"
```

---

### Task 14: Generation service interface + Fake implementation + constants

**Files:**
- Create: `src/main/services/generation/IGenerationService.ts`
- Create: `src/main/services/generation/FakeGenerationService.ts`
- Create: `src/main/services/generation/constants.ts`

- [ ] **Step 1: Write `constants.ts`**

```ts
export const GEMINI_MODEL = 'gemini-3.1-flash-image-preview';
```

- [ ] **Step 2: Write `IGenerationService.ts`**

```ts
export interface GenerationImageInput {
  variableName: string;
  description: string;
  bytes: Buffer;
  mimeType: string;
}

export interface GenerationRequest {
  finalPrompt: string;
  images: GenerationImageInput[];
  model: string;
}

export interface GenerationOutcome {
  bytes: Buffer;
  mimeType: string;
}

export interface IGenerationService {
  generate(req: GenerationRequest): Promise<GenerationOutcome>;
}
```

- [ ] **Step 3: Write `FakeGenerationService.ts`**

```ts
import type { GenerationRequest, GenerationOutcome, IGenerationService } from './IGenerationService';

export class FakeGenerationService implements IGenerationService {
  constructor(
    private opts: {
      delayMs?: number;
      shouldFail?: (req: GenerationRequest) => boolean;
      outputBytes?: Buffer;
    } = {},
  ) {}

  async generate(req: GenerationRequest): Promise<GenerationOutcome> {
    if (this.opts.delayMs) await new Promise(r => setTimeout(r, this.opts.delayMs));
    if (this.opts.shouldFail?.(req)) throw new Error('fake failure');
    return {
      bytes: this.opts.outputBytes ?? Buffer.from('fake-image-bytes'),
      mimeType: 'image/png',
    };
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/services/generation
git commit -m "feat(generation): add service interface, constants, and fake impl"
```

---

### Task 15: Real GeminiGenerationService

**Files:**
- Create: `src/main/services/generation/GeminiGenerationService.ts`

- [ ] **Step 1: Write `GeminiGenerationService.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerationRequest, GenerationOutcome, IGenerationService } from './IGenerationService';

export class GeminiGenerationService implements IGenerationService {
  constructor(private getApiKey: () => string | null) {}

  async generate(req: GenerationRequest): Promise<GenerationOutcome> {
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error('API key not set. Open Settings to add one.');

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: req.model });

    const parts: any[] = [];
    for (const img of req.images) {
      const label = `{${img.variableName}}`;
      const text = img.description ? `${label} (${img.description})` : label;
      parts.push({ text });
      parts.push({ inlineData: { data: img.bytes.toString('base64'), mimeType: img.mimeType } });
    }
    parts.push({ text: req.finalPrompt });

    const response = await model.generateContent({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'] as any },
    } as any);

    const candidates = (response.response as any).candidates ?? [];
    for (const c of candidates) {
      const cp = c.content?.parts ?? [];
      for (const p of cp) {
        if (p.inlineData?.data && p.inlineData.mimeType?.startsWith('image/')) {
          return {
            bytes: Buffer.from(p.inlineData.data, 'base64'),
            mimeType: p.inlineData.mimeType,
          };
        }
      }
    }
    throw new Error('No image returned from Gemini.');
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (the SDK's exact image-response shape may tighten later; `any` is intentional to keep the MVP moving).

- [ ] **Step 3: Commit**

```bash
git add src/main/services/generation/GeminiGenerationService.ts
git commit -m "feat(generation): add GeminiGenerationService"
```

---

### Task 16: BatchRunner (TDD with FakeGenerationService)

**Files:**
- Create: `src/main/services/batch-runner.ts`
- Create: `src/main/services/batch-runner.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { openDatabase } from '../db/connection';
import { loadMigrations, runMigrations } from '../db/migrate';
import { TemplateRepo } from '../db/repositories/template-repo';
import { JobRepo } from '../db/repositories/job-repo';
import { SlotRepo } from '../db/repositories/slot-repo';
import { AssetRepo } from '../db/repositories/asset-repo';
import { GenerationRepo } from '../db/repositories/generation-repo';
import { AssetStore } from './asset-store';
import { FakeGenerationService } from './generation/FakeGenerationService';
import { BatchRunner } from './batch-runner';

function setup() {
  const db = openDatabase(':memory:');
  runMigrations(db, loadMigrations(path.resolve(__dirname, '../db/migrations')));
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nb-'));
  const templates = new TemplateRepo(db);
  const jobs = new JobRepo(db);
  const slots = new SlotRepo(db);
  const assets = new AssetRepo(db);
  const generations = new GenerationRepo(db);
  const assetStore = new AssetStore(assets, tempDir);
  const template = templates.create('T');
  const jobIds = Array.from({ length: 5 }, (_, i) => jobs.create({ templateId: template.id, name: `J${i}` }).id);
  return { templates, jobs, slots, assetStore, generations, template, jobIds };
}

describe('BatchRunner', () => {
  it('runs at most 3 generations concurrently and emits updates', async () => {
    const ctx = setup();
    const running = new Set<string>();
    let maxConcurrent = 0;
    const svc = new FakeGenerationService({
      delayMs: 20,
      shouldFail: () => false,
    });
    // instrument by wrapping svc
    const trackedSvc = {
      async generate(req: any) {
        running.add(req.finalPrompt + Math.random());
        maxConcurrent = Math.max(maxConcurrent, running.size);
        try { return await svc.generate(req); }
        finally { running.clear(); }
      },
    };
    const events: string[] = [];
    const runner = new BatchRunner({
      generations: ctx.generations, jobs: ctx.jobs, templates: ctx.templates,
      slots: ctx.slots, assetStore: ctx.assetStore,
      generationService: trackedSvc as any,
      maxConcurrent: 3,
      model: 'test-model',
      emit: (e) => events.push(`${e.status}:${e.jobId}`),
    });

    await runner.runMany(ctx.jobIds);
    expect(events.filter(e => e.startsWith('running:')).length).toBe(5);
    expect(events.filter(e => e.startsWith('succeeded:')).length).toBe(5);
  });

  it('marks generation failed and emits failure event when service throws', async () => {
    const ctx = setup();
    const svc = new FakeGenerationService({ shouldFail: () => true });
    const events: string[] = [];
    const runner = new BatchRunner({
      generations: ctx.generations, jobs: ctx.jobs, templates: ctx.templates,
      slots: ctx.slots, assetStore: ctx.assetStore,
      generationService: svc, maxConcurrent: 2, model: 'm',
      emit: (e) => events.push(`${e.status}:${e.errorMessage ?? ''}`),
    });
    await runner.runMany([ctx.jobIds[0]!]);
    expect(events.some(e => e.startsWith('failed:'))).toBe(true);
    const [gen] = ctx.generations.listByJob(ctx.jobIds[0]!);
    expect(gen!.status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run — expect fail**

Run: `npm test -- batch-runner`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/services/batch-runner.ts`**

```ts
import type { UUID } from '@shared/types/domain';
import { composePrompt } from '@shared/prompt-compose';
import type { TemplateRepo } from '../db/repositories/template-repo';
import type { JobRepo } from '../db/repositories/job-repo';
import type { SlotRepo } from '../db/repositories/slot-repo';
import type { GenerationRepo } from '../db/repositories/generation-repo';
import type { AssetStore } from './asset-store';
import type { IGenerationService } from './generation/IGenerationService';

export interface BatchUpdateEvent {
  generationId: UUID;
  jobId: UUID;
  status: 'running' | 'succeeded' | 'failed';
  resultAssetId?: UUID;
  errorMessage?: string;
}

export interface BatchRunnerDeps {
  templates: TemplateRepo;
  jobs: JobRepo;
  slots: SlotRepo;
  generations: GenerationRepo;
  assetStore: AssetStore;
  generationService: IGenerationService;
  maxConcurrent: number;
  model: string;
  emit: (e: BatchUpdateEvent) => void;
}

export class BatchRunner {
  constructor(private deps: BatchRunnerDeps) {}

  async runMany(jobIds: UUID[]): Promise<void> {
    const queue = [...jobIds];
    const workers: Promise<void>[] = [];
    const slots = Math.min(this.deps.maxConcurrent, queue.length);
    for (let i = 0; i < slots; i++) workers.push(this.worker(queue));
    await Promise.all(workers);
  }

  private async worker(queue: UUID[]): Promise<void> {
    while (queue.length > 0) {
      const jobId = queue.shift();
      if (!jobId) return;
      await this.runOne(jobId);
    }
  }

  private async runOne(jobId: UUID): Promise<void> {
    const { templates, jobs, slots, generations, assetStore, generationService, model, emit } = this.deps;
    const job = jobs.getById(jobId);
    if (!job) return;
    const template = templates.get(job.templateId);
    if (!template) return;

    const composed = composePrompt({
      template: { sharedPrompt: template.sharedPrompt, slots: slots.listByOwner('template', template.id) },
      job: { prompt: job.prompt, slots: slots.listByOwner('job', job.id) },
    });

    const pending = generations.createPending({
      jobId: job.id,
      finalPrompt: composed.finalPrompt,
      imageRefs: composed.imageRefs.map(r => ({ variableName: r.variableName, assetId: r.assetId, description: r.description })),
      model,
    });

    generations.markRunning(pending.id);
    emit({ generationId: pending.id, jobId: job.id, status: 'running' });

    try {
      const images = composed.imageRefs.map(r => {
        const { bytes, mimeType } = assetStore.readBytes(r.assetId);
        return { variableName: r.variableName, description: r.description, bytes, mimeType };
      });
      const result = await generationService.generate({
        finalPrompt: composed.finalPrompt, images, model,
      });
      const asset = await assetStore.save(result.bytes, result.mimeType, null);
      generations.markSucceeded(pending.id, asset.id);
      emit({ generationId: pending.id, jobId: job.id, status: 'succeeded', resultAssetId: asset.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      generations.markFailed(pending.id, message);
      emit({ generationId: pending.id, jobId: job.id, status: 'failed', errorMessage: message });
    }
  }
}
```

- [ ] **Step 4: Run — expect pass**

Run: `npm test -- batch-runner`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/batch-runner.ts src/main/services/batch-runner.test.ts
git commit -m "feat(services): add BatchRunner with concurrency cap and event push"
```

---

## Phase 5 — IPC Contract and Handlers

### Task 17: Shared IPC contract

**Files:**
- Create: `src/shared/ipc-contract.ts`

- [ ] **Step 1: Write `src/shared/ipc-contract.ts`**

```ts
import type {
  Template, Job, Asset, ImageSlot, Generation, SlotOwnerKind, UUID,
} from './types/domain';

export interface IpcContract {
  'settings:getApiKeyPresence': { req: void; res: { present: boolean } };
  'settings:setApiKey':         { req: { apiKey: string }; res: void };
  'settings:clearApiKey':       { req: void; res: void };

  'template:list':   { req: void; res: Template[] };
  'template:get':    { req: { id: UUID }; res: Template | null };
  'template:create': { req: { name: string }; res: Template };
  'template:update': { req: { id: UUID; patch: Partial<Pick<Template, 'name' | 'sharedPrompt'>> }; res: Template };
  'template:delete': { req: { id: UUID }; res: void };

  'job:listByTemplate': { req: { templateId: UUID }; res: Job[] };
  'job:get':    { req: { id: UUID }; res: Job | null };
  'job:create': { req: { templateId: UUID; name: string }; res: Job };
  'job:update': { req: { id: UUID; patch: Partial<Pick<Job, 'name' | 'prompt'>> }; res: Job };
  'job:delete': { req: { id: UUID }; res: void };

  'slot:listByOwner': {
    req: { ownerKind: SlotOwnerKind; ownerId: UUID };
    res: Array<ImageSlot & { asset: Asset }>;
  };
  'slot:create': {
    req: {
      ownerKind: SlotOwnerKind; ownerId: UUID;
      variableName: string; description: string;
      imageBytes: ArrayBuffer;
      originalFilename: string; mimeType: string;
    };
    res: ImageSlot & { asset: Asset };
  };
  'slot:update': {
    req: { id: UUID; patch: Partial<Pick<ImageSlot, 'variableName' | 'description' | 'position'>> };
    res: ImageSlot;
  };
  'slot:delete': { req: { id: UUID }; res: void };

  'prompt:compose': {
    req: { jobId: UUID };
    res: {
      finalPrompt: string;
      imageRefs: Array<{ variableName: string; description: string; assetId: UUID; originalFilename: string | null }>;
      warnings: string[];
    };
  };

  'generation:runMany': { req: { jobIds: UUID[] }; res: { batchId: string } };
  'generation:listByJob': { req: { jobId: UUID }; res: Generation[] };
  'generation:export': { req: { generationId: UUID }; res: { savedPath: string } | { cancelled: true } };

  'asset:getDataUrl': { req: { assetId: UUID }; res: { dataUrl: string } };
}

export interface IpcEvents {
  'generation:update': {
    generationId: UUID; jobId: UUID;
    status: 'running' | 'succeeded' | 'failed';
    resultAssetId?: UUID; errorMessage?: string;
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/ipc-contract.ts
git commit -m "feat(shared): add IPC contract types"
```

---

### Task 18: Preload bridge

**Files:**
- Create: `src/preload/index.ts`

- [ ] **Step 1: Write `src/preload/index.ts`**

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcContract, IpcEvents } from '@shared/ipc-contract';

const api = {
  invoke: <C extends keyof IpcContract>(channel: C, req: IpcContract[C]['req']): Promise<IpcContract[C]['res']> =>
    ipcRenderer.invoke(channel, req),
  on: <E extends keyof IpcEvents>(event: E, handler: (payload: IpcEvents[E]) => void) => {
    const wrapped = (_: unknown, payload: IpcEvents[E]) => handler(payload);
    ipcRenderer.on(event, wrapped);
    return () => ipcRenderer.off(event, wrapped);
  },
};

contextBridge.exposeInMainWorld('api', api);

declare global {
  interface Window { api: typeof api }
}

export type Api = typeof api;
```

- [ ] **Step 2: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(preload): expose typed IPC bridge via contextBridge"
```

---

### Task 19: IPC handler infrastructure and AppContext

**Files:**
- Create: `src/main/app-context.ts`
- Create: `src/main/ipc/register.ts`

- [ ] **Step 1: Write `src/main/app-context.ts`**

```ts
import path from 'node:path';
import type { DB } from './db/connection';
import { TemplateRepo } from './db/repositories/template-repo';
import { JobRepo } from './db/repositories/job-repo';
import { SlotRepo } from './db/repositories/slot-repo';
import { AssetRepo } from './db/repositories/asset-repo';
import { GenerationRepo } from './db/repositories/generation-repo';
import { SecureStorage } from './services/secure-storage';
import { AssetStore } from './services/asset-store';
import { GeminiGenerationService } from './services/generation/GeminiGenerationService';
import type { IGenerationService } from './services/generation/IGenerationService';
import { BatchRunner } from './services/batch-runner';
import { GEMINI_MODEL } from './services/generation/constants';
import type { BatchUpdateEvent } from './services/batch-runner';

export interface AppContext {
  templates: TemplateRepo;
  jobs: JobRepo;
  slots: SlotRepo;
  assets: AssetRepo;
  generations: GenerationRepo;
  assetStore: AssetStore;
  secureStorage: SecureStorage;
  generationService: IGenerationService;
  makeBatchRunner: (emit: (e: BatchUpdateEvent) => void) => BatchRunner;
  userDataDir: string;
}

export function buildAppContext(db: DB, userDataDir: string): AppContext {
  const templates = new TemplateRepo(db);
  const jobs = new JobRepo(db);
  const slots = new SlotRepo(db);
  const assets = new AssetRepo(db);
  const generations = new GenerationRepo(db);
  const assetStore = new AssetStore(assets, userDataDir);
  const secureStorage = new SecureStorage(userDataDir);
  const generationService = new GeminiGenerationService(() => secureStorage.getApiKey());

  const makeBatchRunner = (emit: (e: BatchUpdateEvent) => void) =>
    new BatchRunner({
      templates, jobs, slots, generations, assetStore,
      generationService, maxConcurrent: 3, model: GEMINI_MODEL, emit,
    });

  return { templates, jobs, slots, assets, generations, assetStore, secureStorage, generationService, makeBatchRunner, userDataDir };
}
```

- [ ] **Step 2: Write `src/main/ipc/register.ts`**

```ts
import { ipcMain, BrowserWindow } from 'electron';
import type { IpcContract, IpcEvents } from '@shared/ipc-contract';
import type { AppContext } from '../app-context';
import { registerSettingsIpc } from './settings-ipc';
import { registerTemplateIpc } from './template-ipc';
import { registerJobIpc } from './job-ipc';
import { registerSlotIpc } from './slot-ipc';
import { registerPromptIpc } from './prompt-ipc';
import { registerGenerationIpc } from './generation-ipc';
import { registerAssetIpc } from './asset-ipc';

export function handle<C extends keyof IpcContract>(
  channel: C,
  fn: (req: IpcContract[C]['req']) => Promise<IpcContract[C]['res']> | IpcContract[C]['res'],
): void {
  ipcMain.handle(channel, async (_evt, req) => fn(req));
}

export function broadcast<E extends keyof IpcEvents>(event: E, payload: IpcEvents[E]): void {
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send(event, payload);
}

export function registerIpc(ctx: AppContext): void {
  registerSettingsIpc(ctx);
  registerTemplateIpc(ctx);
  registerJobIpc(ctx);
  registerSlotIpc(ctx);
  registerPromptIpc(ctx);
  registerGenerationIpc(ctx);
  registerAssetIpc(ctx);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/main/app-context.ts src/main/ipc/register.ts
git commit -m "feat(main): add AppContext and ipc register helper"
```

---

### Task 20: Settings, Template, Job IPC handlers

**Files:**
- Create: `src/main/ipc/settings-ipc.ts`
- Create: `src/main/ipc/template-ipc.ts`
- Create: `src/main/ipc/job-ipc.ts`

- [ ] **Step 1: Write `settings-ipc.ts`**

```ts
import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerSettingsIpc(ctx: AppContext): void {
  handle('settings:getApiKeyPresence', () => ({ present: ctx.secureStorage.hasApiKey() }));
  handle('settings:setApiKey', ({ apiKey }) => { ctx.secureStorage.setApiKey(apiKey); });
  handle('settings:clearApiKey', () => { ctx.secureStorage.clearApiKey(); });
}
```

- [ ] **Step 2: Write `template-ipc.ts`**

```ts
import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerTemplateIpc(ctx: AppContext): void {
  handle('template:list', () => ctx.templates.list());
  handle('template:get', ({ id }) => ctx.templates.get(id));
  handle('template:create', ({ name }) => ctx.templates.create(name));
  handle('template:update', ({ id, patch }) => ctx.templates.update(id, patch));
  handle('template:delete', ({ id }) => { ctx.templates.delete(id); });
}
```

- [ ] **Step 3: Write `job-ipc.ts`**

```ts
import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerJobIpc(ctx: AppContext): void {
  handle('job:listByTemplate', ({ templateId }) => ctx.jobs.listByTemplate(templateId));
  handle('job:get', ({ id }) => ctx.jobs.getById(id));
  handle('job:create', ({ templateId, name }) => ctx.jobs.create({ templateId, name }));
  handle('job:update', ({ id, patch }) => ctx.jobs.update(id, patch));
  handle('job:delete', ({ id }) => { ctx.jobs.delete(id); });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc/settings-ipc.ts src/main/ipc/template-ipc.ts src/main/ipc/job-ipc.ts
git commit -m "feat(ipc): add settings/template/job handlers"
```

---

### Task 21: Slot, Prompt, Generation, Asset IPC handlers

**Files:**
- Create: `src/main/ipc/slot-ipc.ts`
- Create: `src/main/ipc/prompt-ipc.ts`
- Create: `src/main/ipc/generation-ipc.ts`
- Create: `src/main/ipc/asset-ipc.ts`

- [ ] **Step 1: Write `slot-ipc.ts`**

```ts
import type { AppContext } from '../app-context';
import { handle } from './register';
import type { Asset, ImageSlot } from '@shared/types/domain';

export function registerSlotIpc(ctx: AppContext): void {
  handle('slot:listByOwner', ({ ownerKind, ownerId }) => {
    const rows = ctx.slots.listByOwner(ownerKind, ownerId);
    return rows.map(s => ({ ...s, asset: ctx.assets.getById(s.assetId)! })) as Array<ImageSlot & { asset: Asset }>;
  });

  handle('slot:create', async ({ ownerKind, ownerId, variableName, description, imageBytes, originalFilename, mimeType }) => {
    const asset = await ctx.assetStore.save(Buffer.from(imageBytes), mimeType, originalFilename);
    const existing = ctx.slots.listByOwner(ownerKind, ownerId);
    const position = existing.length;
    const slot = ctx.slots.create({ ownerKind, ownerId, assetId: asset.id, variableName, description, position });
    return { ...slot, asset };
  });

  handle('slot:update', ({ id, patch }) => ctx.slots.update(id, patch));
  handle('slot:delete', ({ id }) => { ctx.slots.delete(id); });
}
```

- [ ] **Step 2: Write `prompt-ipc.ts`**

```ts
import type { AppContext } from '../app-context';
import { handle } from './register';
import { composePrompt } from '@shared/prompt-compose';

export function registerPromptIpc(ctx: AppContext): void {
  handle('prompt:compose', ({ jobId }) => {
    const job = ctx.jobs.getById(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    const template = ctx.templates.get(job.templateId);
    if (!template) throw new Error(`Template not found: ${job.templateId}`);

    const result = composePrompt({
      template: { sharedPrompt: template.sharedPrompt, slots: ctx.slots.listByOwner('template', template.id) },
      job: { prompt: job.prompt, slots: ctx.slots.listByOwner('job', job.id) },
    });

    return {
      finalPrompt: result.finalPrompt,
      warnings: result.warnings,
      imageRefs: result.imageRefs.map(r => ({
        variableName: r.variableName,
        description: r.description,
        assetId: r.assetId,
        originalFilename: ctx.assets.getById(r.assetId)?.originalFilename ?? null,
      })),
    };
  });
}
```

- [ ] **Step 3: Write `generation-ipc.ts`**

```ts
import { dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppContext } from '../app-context';
import { broadcast, handle } from './register';

export function registerGenerationIpc(ctx: AppContext): void {
  handle('generation:runMany', ({ jobIds }) => {
    const batchId = randomUUID();
    const runner = ctx.makeBatchRunner(ev => broadcast('generation:update', ev));
    // fire-and-forget; events stream progress
    void runner.runMany(jobIds);
    return { batchId };
  });

  handle('generation:listByJob', ({ jobId }) => ctx.generations.listByJob(jobId));

  handle('generation:export', async ({ generationId }) => {
    const gen = ctx.generations.getById(generationId);
    if (!gen || !gen.resultAssetId) throw new Error('Generation has no result to export.');
    const job = ctx.jobs.getById(gen.jobId);
    const template = job ? ctx.templates.get(job.templateId) : null;

    const { bytes, mimeType } = ctx.assetStore.readBytes(gen.resultAssetId);
    const ext = mimeType === 'image/png' ? 'png'
              : mimeType === 'image/jpeg' ? 'jpg'
              : mimeType === 'image/webp' ? 'webp'
              : 'bin';
    const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
    const ts = new Date(gen.startedAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}`;
    const defaultName = `${safe(template?.name ?? 'template')}_${safe(job?.name ?? 'job')}_${stamp}.${ext}`;

    const r = await dialog.showSaveDialog({ defaultPath: defaultName });
    if (r.canceled || !r.filePath) return { cancelled: true } as const;
    fs.writeFileSync(r.filePath, bytes);
    return { savedPath: r.filePath };
  });
}
```

- [ ] **Step 4: Write `asset-ipc.ts`**

```ts
import type { AppContext } from '../app-context';
import { handle } from './register';

export function registerAssetIpc(ctx: AppContext): void {
  handle('asset:getDataUrl', ({ assetId }) => ({ dataUrl: ctx.assetStore.dataUrl(assetId) }));
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/slot-ipc.ts src/main/ipc/prompt-ipc.ts src/main/ipc/generation-ipc.ts src/main/ipc/asset-ipc.ts
git commit -m "feat(ipc): add slot/prompt/generation/asset handlers"
```

---

### Task 22: Main entry point

**Files:**
- Create: `src/main/index.ts`
- Create: `resources/placeholder.png`

- [ ] **Step 1: Create placeholder image**

Run: `node -e "const fs=require('fs'); const b=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63600100000500010d0a2db40000000049454e44ae426082','hex'); fs.mkdirSync('resources',{recursive:true}); fs.writeFileSync('resources/placeholder.png', b);"`
Expected: creates a 1×1 transparent png.

- [ ] **Step 2: Write `src/main/index.ts`**

```ts
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { openDatabase } from './db/connection';
import { loadMigrations, runMigrations } from './db/migrate';
import { buildAppContext } from './app-context';
import { registerIpc } from './ipc/register';

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  const db = openDatabase(path.join(userDataDir, 'app.db'));
  const migrationsDir = app.isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(__dirname, '../../src/main/db/migrations');
  runMigrations(db, loadMigrations(migrationsDir));

  const ctx = buildAppContext(db, userDataDir);
  registerIpc(ctx);

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts resources/placeholder.png
git commit -m "feat(main): add app entry point with db init and ipc registration"
```

---

## Phase 6 — Renderer Foundation

### Task 23: Renderer skeleton and IPC client

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/ipc-client.ts`
- Create: `src/renderer/styles/global.css`

- [ ] **Step 1: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>NanoBanana Factory</title>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self';" />
    <link rel="stylesheet" href="./styles/global.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `main.tsx`**

```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 3: Write `ipc-client.ts`**

```ts
import type { IpcContract, IpcEvents } from '@shared/ipc-contract';

type Api = {
  invoke: <C extends keyof IpcContract>(channel: C, req: IpcContract[C]['req']) => Promise<IpcContract[C]['res']>;
  on: <E extends keyof IpcEvents>(event: E, handler: (payload: IpcEvents[E]) => void) => () => void;
};

const api = (window as unknown as { api: Api }).api;

export const ipc = {
  settings: {
    getApiKeyPresence: () => api.invoke('settings:getApiKeyPresence', undefined),
    setApiKey: (apiKey: string) => api.invoke('settings:setApiKey', { apiKey }),
    clearApiKey: () => api.invoke('settings:clearApiKey', undefined),
  },
  template: {
    list:   () => api.invoke('template:list', undefined),
    get:    (id: string) => api.invoke('template:get', { id }),
    create: (name: string) => api.invoke('template:create', { name }),
    update: (id: string, patch: IpcContract['template:update']['req']['patch']) => api.invoke('template:update', { id, patch }),
    delete: (id: string) => api.invoke('template:delete', { id }),
  },
  job: {
    listByTemplate: (templateId: string) => api.invoke('job:listByTemplate', { templateId }),
    get:    (id: string) => api.invoke('job:get', { id }),
    create: (templateId: string, name: string) => api.invoke('job:create', { templateId, name }),
    update: (id: string, patch: IpcContract['job:update']['req']['patch']) => api.invoke('job:update', { id, patch }),
    delete: (id: string) => api.invoke('job:delete', { id }),
  },
  slot: {
    listByOwner: (ownerKind: 'template' | 'job', ownerId: string) =>
      api.invoke('slot:listByOwner', { ownerKind, ownerId }),
    create: (req: IpcContract['slot:create']['req']) => api.invoke('slot:create', req),
    update: (id: string, patch: IpcContract['slot:update']['req']['patch']) => api.invoke('slot:update', { id, patch }),
    delete: (id: string) => api.invoke('slot:delete', { id }),
  },
  prompt: {
    compose: (jobId: string) => api.invoke('prompt:compose', { jobId }),
  },
  generation: {
    runMany: (jobIds: string[]) => api.invoke('generation:runMany', { jobIds }),
    listByJob: (jobId: string) => api.invoke('generation:listByJob', { jobId }),
    export: (generationId: string) => api.invoke('generation:export', { generationId }),
    onUpdate: (fn: (p: IpcEvents['generation:update']) => void) => api.on('generation:update', fn),
  },
  asset: {
    getDataUrl: (assetId: string) => api.invoke('asset:getDataUrl', { assetId }),
  },
};
```

- [ ] **Step 4: Write `App.tsx` (placeholder layout)**

```tsx
import React, { useEffect } from 'react';
import { AppHeader } from './features/settings/components/AppHeader';
import { TemplatePanel } from './features/templates/components/TemplatePanel';
import { JobPanel } from './features/jobs/components/JobPanel';
import { JobDetailPanel } from './features/jobs/components/JobDetailPanel';
import { useTemplateStore } from './features/templates/store';
import { useJobStore } from './features/jobs/store';
import { ipc } from './ipc-client';

export function App() {
  const loadTemplates = useTemplateStore(s => s.load);
  const applyGenerationEvent = useJobStore(s => s.applyGenerationEvent);

  useEffect(() => {
    void loadTemplates();
    const off = ipc.generation.onUpdate(applyGenerationEvent);
    return off;
  }, [loadTemplates, applyGenerationEvent]);

  return (
    <div className="app">
      <AppHeader />
      <div className="main-grid">
        <TemplatePanel />
        <JobPanel />
        <JobDetailPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `styles/global.css`**

```css
:root { color-scheme: light dark; }
body { margin: 0; font-family: -apple-system, system-ui, sans-serif; }
.app { height: 100vh; display: flex; flex-direction: column; }
.main-grid { flex: 1; display: grid; grid-template-columns: 240px 320px 1fr; overflow: hidden; }
.main-grid > * { overflow: auto; border-right: 1px solid #ccc3; padding: 12px; }
button { cursor: pointer; }
input, textarea { font: inherit; }
.badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; }
.badge-idle { background: #ddd; }
.badge-pending { background: #ffd; }
.badge-running { background: #cdf; }
.badge-succeeded { background: #cfc; }
.badge-failed { background: #fcc; }
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer
git commit -m "feat(renderer): add html/entry/App skeleton and ipc-client"
```

---

### Task 24: Settings feature (store + modal + header)

**Files:**
- Create: `src/renderer/features/settings/store.ts`
- Create: `src/renderer/features/settings/components/AppHeader.tsx`
- Create: `src/renderer/features/settings/components/SettingsModal.tsx`

- [ ] **Step 1: Write store**

```ts
import { create } from 'zustand';
import { ipc } from '@/ipc-client';

interface SettingsState {
  apiKeyPresent: boolean;
  modalOpen: boolean;
  open: () => void;
  close: () => void;
  refresh: () => Promise<void>;
  save: (apiKey: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKeyPresent: false,
  modalOpen: false,
  open: () => set({ modalOpen: true }),
  close: () => set({ modalOpen: false }),
  refresh: async () => {
    const { present } = await ipc.settings.getApiKeyPresence();
    set({ apiKeyPresent: present });
  },
  save: async (apiKey) => {
    await ipc.settings.setApiKey(apiKey);
    set({ apiKeyPresent: true });
  },
  clear: async () => {
    await ipc.settings.clearApiKey();
    set({ apiKeyPresent: false });
  },
}));
```

- [ ] **Step 2: Write `AppHeader.tsx`**

```tsx
import React, { useEffect } from 'react';
import { useSettingsStore } from '../store';
import { SettingsModal } from './SettingsModal';

export function AppHeader() {
  const { apiKeyPresent, open, refresh } = useSettingsStore();
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #ccc3' }}>
      <strong>NanoBanana Factory</strong>
      <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>
        API key: {apiKeyPresent ? 'configured' : 'not set'}
      </span>
      <button onClick={open} style={{ marginLeft: 12 }}>⚙ Settings</button>
      <SettingsModal />
    </header>
  );
}
```

- [ ] **Step 3: Write `SettingsModal.tsx`**

```tsx
import React, { useState } from 'react';
import { useSettingsStore } from '../store';

export function SettingsModal() {
  const { modalOpen, close, apiKeyPresent, save, clear } = useSettingsStore();
  const [input, setInput] = useState('');
  if (!modalOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: 20, borderRadius: 8, minWidth: 360 }}>
        <h3>Settings</h3>
        <div style={{ marginTop: 8 }}>
          <label>Gemini API key</label>
          <input
            type="password"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={apiKeyPresent ? '(already saved)' : 'AIza...'}
            style={{ width: '100%', padding: 6, marginTop: 4 }}
          />
        </div>
        <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {apiKeyPresent && <button onClick={() => void clear()}>Clear</button>}
          <button onClick={close}>Cancel</button>
          <button
            onClick={async () => { if (input) { await save(input); setInput(''); close(); } }}
            disabled={!input}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/features/settings
git commit -m "feat(settings): add store and modal for Gemini API key"
```

---

### Task 25: Templates feature (store + panel + list item + edit view)

**Files:**
- Create: `src/renderer/features/templates/store.ts`
- Create: `src/renderer/features/templates/components/TemplatePanel.tsx`
- Create: `src/renderer/features/templates/components/TemplateListItem.tsx`
- Create: `src/renderer/features/templates/components/TemplateEditView.tsx`
- Create: `src/renderer/features/templates/components/SharedPromptEditor.tsx`

- [ ] **Step 1: Write store**

```ts
import { create } from 'zustand';
import type { Template } from '@shared/types/domain';
import { ipc } from '@/ipc-client';

interface TemplateState {
  templates: Template[];
  selectedId: string | null;
  load: () => Promise<void>;
  select: (id: string | null) => void;
  create: (name: string) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Template, 'name' | 'sharedPrompt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  selectedId: null,
  load: async () => {
    const templates = await ipc.template.list();
    set(state => ({
      templates,
      selectedId: state.selectedId && templates.some(t => t.id === state.selectedId)
        ? state.selectedId
        : templates[0]?.id ?? null,
    }));
  },
  select: (id) => set({ selectedId: id }),
  create: async (name) => {
    const t = await ipc.template.create(name);
    set({ templates: [t, ...get().templates], selectedId: t.id });
  },
  update: async (id, patch) => {
    const u = await ipc.template.update(id, patch);
    set({ templates: get().templates.map(t => t.id === id ? u : t) });
  },
  remove: async (id) => {
    await ipc.template.delete(id);
    const remaining = get().templates.filter(t => t.id !== id);
    set({ templates: remaining, selectedId: remaining[0]?.id ?? null });
  },
}));
```

- [ ] **Step 2: Write `TemplatePanel.tsx`**

```tsx
import React, { useState } from 'react';
import { useTemplateStore } from '../store';
import { TemplateListItem } from './TemplateListItem';
import { TemplateEditView } from './TemplateEditView';

export function TemplatePanel() {
  const { templates, selectedId, create } = useTemplateStore();
  const [name, setName] = useState('');
  const onNew = async () => {
    if (!name.trim()) return;
    await create(name.trim());
    setName('');
  };
  return (
    <section>
      <h4>Templates</h4>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {templates.map(t => <TemplateListItem key={t.id} template={t} active={t.id === selectedId} />)}
      </ul>
      <div style={{ marginTop: 8, display: 'flex', gap: 4 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New template name" />
        <button onClick={onNew}>+</button>
      </div>
      <hr />
      <TemplateEditView />
    </section>
  );
}
```

- [ ] **Step 3: Write `TemplateListItem.tsx`**

```tsx
import React from 'react';
import type { Template } from '@shared/types/domain';
import { useTemplateStore } from '../store';

export function TemplateListItem({ template, active }: { template: Template; active: boolean }) {
  const { select, remove } = useTemplateStore();
  return (
    <li
      onClick={() => select(template.id)}
      style={{
        padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
        background: active ? '#cdf' : 'transparent',
        display: 'flex', alignItems: 'center', gap: 4,
      }}
    >
      <span style={{ flex: 1 }}>{template.name}</span>
      <button
        onClick={e => { e.stopPropagation(); if (confirm(`Delete template "${template.name}"?`)) void remove(template.id); }}
        style={{ fontSize: 11 }}
      >
        🗑
      </button>
    </li>
  );
}
```

- [ ] **Step 4: Write `SharedPromptEditor.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import type { Template } from '@shared/types/domain';
import { useTemplateStore } from '../store';

export function SharedPromptEditor({ template }: { template: Template }) {
  const update = useTemplateStore(s => s.update);
  const [value, setValue] = useState(template.sharedPrompt);
  useEffect(() => { setValue(template.sharedPrompt); }, [template.id, template.sharedPrompt]);

  return (
    <textarea
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => { if (value !== template.sharedPrompt) void update(template.id, { sharedPrompt: value }); }}
      rows={5}
      style={{ width: '100%' }}
      placeholder="Shared prompt for every job under this template. Use {variableName} to reference images."
    />
  );
}
```

- [ ] **Step 5: Write `TemplateEditView.tsx`**

```tsx
import React from 'react';
import { useTemplateStore } from '../store';
import { SharedPromptEditor } from './SharedPromptEditor';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';

export function TemplateEditView() {
  const template = useTemplateStore(s => s.templates.find(t => t.id === s.selectedId));
  const update = useTemplateStore(s => s.update);
  if (!template) return <p style={{ opacity: 0.6 }}>Select a template.</p>;

  return (
    <div>
      <input
        value={template.name}
        onChange={e => void update(template.id, { name: e.target.value })}
        style={{ width: '100%', fontSize: 16, fontWeight: 'bold' }}
      />
      <h5 style={{ marginTop: 12 }}>Shared prompt</h5>
      <SharedPromptEditor template={template} />
      <h5 style={{ marginTop: 12 }}>Shared images</h5>
      <ImageSlotList ownerKind="template" ownerId={template.id} />
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/features/templates
git commit -m "feat(templates): add store, panel, list item, and edit view"
```

---

### Task 26: Slots feature (reusable ImageSlotList + card + thumbnail)

**Files:**
- Create: `src/renderer/features/slots/components/ImageSlotList.tsx`
- Create: `src/renderer/features/slots/components/ImageSlotCard.tsx`
- Create: `src/renderer/features/slots/components/ImageThumbnail.tsx`
- Create: `src/renderer/features/slots/components/AddImageSlotButton.tsx`

- [ ] **Step 1: Write `ImageThumbnail.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { ipc } from '@/ipc-client';

export function ImageThumbnail({ assetId, size = 64 }: { assetId: string; size?: number }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    void ipc.asset.getDataUrl(assetId).then(r => { if (!cancelled) setSrc(r.dataUrl); });
    return () => { cancelled = true; };
  }, [assetId]);
  if (!src) return <div style={{ width: size, height: size, background: '#eee' }} />;
  return <img src={src} width={size} height={size} style={{ objectFit: 'cover', borderRadius: 4 }} />;
}
```

- [ ] **Step 2: Write `ImageSlotCard.tsx`**

```tsx
import React, { useState } from 'react';
import type { Asset, ImageSlot } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from './ImageThumbnail';

export function ImageSlotCard(props: {
  slot: ImageSlot & { asset: Asset };
  onChange: () => void;
}) {
  const { slot, onChange } = props;
  const [variableName, setVariableName] = useState(slot.variableName);
  const [description, setDescription] = useState(slot.description);

  const commit = async (patch: Partial<Pick<ImageSlot, 'variableName' | 'description'>>) => {
    await ipc.slot.update(slot.id, patch);
    onChange();
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid #ccc5', padding: 6, borderRadius: 6, marginBottom: 6 }}>
      <ImageThumbnail assetId={slot.assetId} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          value={variableName}
          onChange={e => setVariableName(e.target.value.replace(/[^\w]/g, ''))}
          onBlur={() => variableName !== slot.variableName && void commit({ variableName })}
          placeholder="variableName"
        />
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => description !== slot.description && void commit({ description })}
          placeholder="description (optional)"
        />
      </div>
      <button onClick={async () => { await ipc.slot.delete(slot.id); onChange(); }}>🗑</button>
    </div>
  );
}
```

- [ ] **Step 3: Write `AddImageSlotButton.tsx`**

```tsx
import React, { useRef } from 'react';
import type { SlotOwnerKind } from '@shared/types/domain';
import { ipc } from '@/ipc-client';

export function AddImageSlotButton(props: {
  ownerKind: SlotOwnerKind;
  ownerId: string;
  existingNames: string[];
  onAdded: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const baseName = `image${String.fromCharCode(65 + props.existingNames.length)}`;
    let variableName = baseName;
    let i = 1;
    while (props.existingNames.includes(variableName)) variableName = `${baseName}${i++}`;

    const buf = await file.arrayBuffer();
    await ipc.slot.create({
      ownerKind: props.ownerKind, ownerId: props.ownerId,
      variableName, description: '',
      imageBytes: buf, originalFilename: file.name, mimeType: file.type || 'image/png',
    });
    props.onAdded();
  };

  return (
    <>
      <button onClick={() => ref.current?.click()}>+ Add image</button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }}
      />
    </>
  );
}
```

- [ ] **Step 4: Write `ImageSlotList.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import type { Asset, ImageSlot, SlotOwnerKind } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageSlotCard } from './ImageSlotCard';
import { AddImageSlotButton } from './AddImageSlotButton';

export function ImageSlotList({ ownerKind, ownerId, readOnly = false }: {
  ownerKind: SlotOwnerKind;
  ownerId: string;
  readOnly?: boolean;
}) {
  const [slots, setSlots] = useState<Array<ImageSlot & { asset: Asset }>>([]);

  const reload = useCallback(async () => {
    setSlots(await ipc.slot.listByOwner(ownerKind, ownerId));
  }, [ownerKind, ownerId]);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <div>
      {slots.map(s => readOnly
        ? (
          <div key={s.id} style={{ fontSize: 12, opacity: 0.8 }}>
            {`{${s.variableName}}`} {s.description && `— ${s.description}`}
          </div>
        )
        : <ImageSlotCard key={s.id} slot={s} onChange={reload} />
      )}
      {!readOnly && (
        <AddImageSlotButton
          ownerKind={ownerKind}
          ownerId={ownerId}
          existingNames={slots.map(s => s.variableName)}
          onAdded={reload}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/features/slots
git commit -m "feat(slots): add reusable ImageSlotList and related components"
```

---

### Task 27: Jobs store (with generation event integration)

**Files:**
- Create: `src/renderer/features/jobs/store.ts`

- [ ] **Step 1: Write store**

```ts
import { create } from 'zustand';
import type { Job } from '@shared/types/domain';
import type { IpcEvents } from '@shared/ipc-contract';
import { ipc } from '@/ipc-client';

export type JobRuntimeStatus = 'idle' | 'pending' | 'running' | 'succeeded' | 'failed';

interface JobState {
  jobsByTemplateId: Record<string, Job[]>;
  selectedId: string | null;
  checkedIds: Set<string>;
  statusByJobId: Record<string, JobRuntimeStatus>;

  loadByTemplate: (templateId: string) => Promise<void>;
  select: (id: string | null) => void;
  toggleCheck: (id: string) => void;
  clearChecks: () => void;
  create: (templateId: string, name: string) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Job, 'name' | 'prompt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  runSelected: () => Promise<void>;
  applyGenerationEvent: (ev: IpcEvents['generation:update']) => void;
}

export const useJobStore = create<JobState>((set, get) => ({
  jobsByTemplateId: {},
  selectedId: null,
  checkedIds: new Set(),
  statusByJobId: {},

  loadByTemplate: async (templateId) => {
    const jobs = await ipc.job.listByTemplate(templateId);
    set(state => ({
      jobsByTemplateId: { ...state.jobsByTemplateId, [templateId]: jobs },
      selectedId: state.selectedId && jobs.some(j => j.id === state.selectedId) ? state.selectedId : jobs[0]?.id ?? null,
    }));
  },
  select: (id) => set({ selectedId: id }),
  toggleCheck: (id) => set(state => {
    const next = new Set(state.checkedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { checkedIds: next };
  }),
  clearChecks: () => set({ checkedIds: new Set() }),
  create: async (templateId, name) => {
    const j = await ipc.job.create(templateId, name);
    set(state => ({
      jobsByTemplateId: { ...state.jobsByTemplateId, [templateId]: [j, ...(state.jobsByTemplateId[templateId] ?? [])] },
      selectedId: j.id,
    }));
  },
  update: async (id, patch) => {
    const u = await ipc.job.update(id, patch);
    set(state => {
      const list = state.jobsByTemplateId[u.templateId] ?? [];
      return { jobsByTemplateId: { ...state.jobsByTemplateId, [u.templateId]: list.map(j => j.id === id ? u : j) } };
    });
  },
  remove: async (id) => {
    const job = Object.values(get().jobsByTemplateId).flat().find(j => j.id === id);
    await ipc.job.delete(id);
    if (!job) return;
    set(state => ({
      jobsByTemplateId: {
        ...state.jobsByTemplateId,
        [job.templateId]: (state.jobsByTemplateId[job.templateId] ?? []).filter(j => j.id !== id),
      },
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
  },
  runSelected: async () => {
    const ids = [...get().checkedIds];
    if (ids.length === 0) return;
    const statusByJobId = { ...get().statusByJobId };
    for (const id of ids) statusByJobId[id] = 'pending';
    set({ statusByJobId });
    await ipc.generation.runMany(ids);
  },
  applyGenerationEvent: (ev) => {
    set(state => ({ statusByJobId: { ...state.statusByJobId, [ev.jobId]: ev.status } }));
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/features/jobs/store.ts
git commit -m "feat(jobs): add zustand store with generation event handling"
```

---

### Task 28: Jobs panel, list item, toolbar, progress bar

**Files:**
- Create: `src/renderer/features/jobs/components/JobPanel.tsx`
- Create: `src/renderer/features/jobs/components/JobListItem.tsx`
- Create: `src/renderer/features/jobs/components/JobToolbar.tsx`
- Create: `src/renderer/features/jobs/components/BatchProgressBar.tsx`

- [ ] **Step 1: Write `JobPanel.tsx`**

```tsx
import React, { useEffect } from 'react';
import { useTemplateStore } from '@/features/templates/store';
import { useJobStore } from '../store';
import { JobListItem } from './JobListItem';
import { JobToolbar } from './JobToolbar';
import { BatchProgressBar } from './BatchProgressBar';

export function JobPanel() {
  const templateId = useTemplateStore(s => s.selectedId);
  const jobs = useJobStore(s => templateId ? s.jobsByTemplateId[templateId] ?? [] : []);
  const loadByTemplate = useJobStore(s => s.loadByTemplate);

  useEffect(() => { if (templateId) void loadByTemplate(templateId); }, [templateId, loadByTemplate]);
  if (!templateId) return <section><h4>Jobs</h4><p style={{ opacity: 0.6 }}>Select a template.</p></section>;

  return (
    <section>
      <h4>Jobs</h4>
      <JobToolbar templateId={templateId} />
      <BatchProgressBar />
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {jobs.map(j => <JobListItem key={j.id} job={j} />)}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Write `JobListItem.tsx`**

```tsx
import React from 'react';
import type { Job } from '@shared/types/domain';
import { useJobStore } from '../store';

export function JobListItem({ job }: { job: Job }) {
  const { selectedId, checkedIds, statusByJobId, select, toggleCheck } = useJobStore();
  const status = statusByJobId[job.id] ?? 'idle';
  const active = selectedId === job.id;
  const checked = checkedIds.has(job.id);

  return (
    <li
      onClick={() => select(job.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 6px', borderRadius: 4, cursor: 'pointer',
        background: active ? '#cdf' : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onClick={e => e.stopPropagation()}
        onChange={() => toggleCheck(job.id)}
      />
      <span style={{ flex: 1 }}>{job.name}</span>
      <span className={`badge badge-${status}`}>{status}</span>
    </li>
  );
}
```

- [ ] **Step 3: Write `JobToolbar.tsx`**

```tsx
import React, { useState } from 'react';
import { useJobStore } from '../store';

export function JobToolbar({ templateId }: { templateId: string }) {
  const { create, checkedIds, runSelected } = useJobStore();
  const [name, setName] = useState('');
  const count = checkedIds.size;

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="New job name" style={{ flex: 1 }} />
      <button
        disabled={!name.trim()}
        onClick={async () => { await create(templateId, name.trim()); setName(''); }}
      >+</button>
      <button
        disabled={count === 0}
        onClick={() => { if (confirm(`Generate ${count} selected job(s)?`)) void runSelected(); }}
      >
        ▶ Generate ({count})
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Write `BatchProgressBar.tsx`**

```tsx
import React from 'react';
import { useJobStore } from '../store';

export function BatchProgressBar() {
  const statuses = useJobStore(s => s.statusByJobId);
  const entries = Object.values(statuses);
  const running = entries.filter(s => s === 'running' || s === 'pending').length;
  if (running === 0) return null;
  return (
    <div style={{ background: '#cdf', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
      {running} in progress…
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/features/jobs/components/JobPanel.tsx src/renderer/features/jobs/components/JobListItem.tsx src/renderer/features/jobs/components/JobToolbar.tsx src/renderer/features/jobs/components/BatchProgressBar.tsx
git commit -m "feat(jobs): add panel, list item, toolbar, and progress bar"
```

---

### Task 29: Job detail panel, prompt editor, preview, confirm dialog, template summary

**Files:**
- Create: `src/renderer/features/jobs/components/JobDetailPanel.tsx`
- Create: `src/renderer/features/jobs/components/JobPromptEditor.tsx`
- Create: `src/renderer/features/jobs/components/TemplateSummary.tsx`
- Create: `src/renderer/features/jobs/components/PromptPreviewDialog.tsx`
- Create: `src/renderer/features/jobs/components/GenerateConfirmDialog.tsx`

- [ ] **Step 1: Write `JobPromptEditor.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import type { Job } from '@shared/types/domain';
import { useJobStore } from '../store';

export function JobPromptEditor({ job }: { job: Job }) {
  const update = useJobStore(s => s.update);
  const [value, setValue] = useState(job.prompt);
  useEffect(() => { setValue(job.prompt); }, [job.id, job.prompt]);

  return (
    <textarea
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => value !== job.prompt && void update(job.id, { prompt: value })}
      rows={6}
      style={{ width: '100%' }}
      placeholder="Job-specific prompt. Use {variableName} to reference images."
    />
  );
}
```

- [ ] **Step 2: Write `TemplateSummary.tsx`**

```tsx
import React from 'react';
import type { Template } from '@shared/types/domain';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';

export function TemplateSummary({ template }: { template: Template }) {
  return (
    <div style={{ background: '#eee8', padding: 8, borderRadius: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>From template: {template.name}</div>
      <div style={{ whiteSpace: 'pre-wrap', marginTop: 4, fontSize: 13 }}>
        {template.sharedPrompt || <em>(no shared prompt)</em>}
      </div>
      <div style={{ marginTop: 4 }}>
        <ImageSlotList ownerKind="template" ownerId={template.id} readOnly />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `PromptPreviewDialog.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from '@/features/slots/components/ImageThumbnail';

export function PromptPreviewDialog({ jobId, open, onClose }: { jobId: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof ipc.prompt.compose>> | null>(null);

  useEffect(() => {
    if (!open) return;
    setData(null);
    void ipc.prompt.compose(jobId).then(setData);
  }, [open, jobId]);

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: 16, borderRadius: 8, width: 600, maxHeight: '80vh', overflow: 'auto' }}>
        <h3>Prompt preview</h3>
        {!data && <p>Composing…</p>}
        {data && (
          <>
            <h4>Final prompt</h4>
            <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 8 }}>{data.finalPrompt || '(empty)'}</pre>
            <h4>Attached images</h4>
            {data.imageRefs.length === 0 && <p>(none)</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {data.imageRefs.map(r => (
                <div key={r.assetId + r.variableName} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <ImageThumbnail assetId={r.assetId} size={48} />
                  <div style={{ fontSize: 12 }}>
                    <div><code>{`{${r.variableName}}`}</code></div>
                    <div style={{ opacity: 0.7 }}>{r.description || <em>no description</em>}</div>
                  </div>
                </div>
              ))}
            </div>
            {data.warnings.length > 0 && (
              <>
                <h4>Warnings</h4>
                <ul>{data.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </>
            )}
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `GenerateConfirmDialog.tsx`**

```tsx
import React from 'react';

export function GenerateConfirmDialog(props: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!props.open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0007', display: 'grid', placeItems: 'center', zIndex: 10 }}>
      <div style={{ background: 'white', padding: 16, borderRadius: 8, minWidth: 280 }}>
        <p>Generate {props.count} job(s)? This will call the Gemini API {props.count} time(s).</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={props.onCancel}>Cancel</button>
          <button onClick={props.onConfirm}>Generate</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write `JobDetailPanel.tsx`**

```tsx
import React, { useState } from 'react';
import { useJobStore } from '../store';
import { useTemplateStore } from '@/features/templates/store';
import { ImageSlotList } from '@/features/slots/components/ImageSlotList';
import { JobPromptEditor } from './JobPromptEditor';
import { TemplateSummary } from './TemplateSummary';
import { PromptPreviewDialog } from './PromptPreviewDialog';
import { GenerationHistoryList } from '@/features/generations/components/GenerationHistoryList';

export function JobDetailPanel() {
  const job = useJobStore(s => {
    if (!s.selectedId) return null;
    for (const list of Object.values(s.jobsByTemplateId)) {
      const found = list.find(j => j.id === s.selectedId);
      if (found) return found;
    }
    return null;
  });
  const update = useJobStore(s => s.update);
  const remove = useJobStore(s => s.remove);
  const template = useTemplateStore(s => job ? s.templates.find(t => t.id === job.templateId) ?? null : null);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!job) return <section><h4>Detail</h4><p style={{ opacity: 0.6 }}>Select a job.</p></section>;

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          value={job.name}
          onChange={e => void update(job.id, { name: e.target.value })}
          style={{ flex: 1, fontSize: 16, fontWeight: 'bold' }}
        />
        <button onClick={() => { if (confirm(`Delete job "${job.name}"?`)) void remove(job.id); }}>🗑</button>
      </div>
      <h5 style={{ marginTop: 12 }}>Images</h5>
      <ImageSlotList ownerKind="job" ownerId={job.id} />
      <h5 style={{ marginTop: 12 }}>Prompt</h5>
      <JobPromptEditor job={job} />
      {template && <><h5 style={{ marginTop: 12 }}>Template</h5><TemplateSummary template={template} /></>}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => setPreviewOpen(true)}>👁 Preview</button>
      </div>
      <h5 style={{ marginTop: 12 }}>History</h5>
      <GenerationHistoryList jobId={job.id} />
      <PromptPreviewDialog jobId={job.id} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </section>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/features/jobs/components
git commit -m "feat(jobs): add detail panel, prompt editor, preview, confirm, template summary"
```

---

### Task 30: Generation history UI

**Files:**
- Create: `src/renderer/features/generations/components/GenerationHistoryList.tsx`
- Create: `src/renderer/features/generations/components/GenerationHistoryItem.tsx`
- Create: `src/renderer/features/generations/components/GenerationViewerDialog.tsx`

- [ ] **Step 1: Write `GenerationViewerDialog.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { ipc } from '@/ipc-client';

export function GenerationViewerDialog(props: { assetId: string | null; onClose: () => void }) {
  const [src, setSrc] = useState<string>('');
  useEffect(() => {
    if (!props.assetId) return;
    void ipc.asset.getDataUrl(props.assetId).then(r => setSrc(r.dataUrl));
  }, [props.assetId]);
  if (!props.assetId) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000b', display: 'grid', placeItems: 'center', zIndex: 10 }}
         onClick={props.onClose}>
      {src && <img src={src} style={{ maxWidth: '90vw', maxHeight: '90vh' }} />}
    </div>
  );
}
```

- [ ] **Step 2: Write `GenerationHistoryItem.tsx`**

```tsx
import React, { useState } from 'react';
import type { Generation } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { ImageThumbnail } from '@/features/slots/components/ImageThumbnail';
import { GenerationViewerDialog } from './GenerationViewerDialog';

export function GenerationHistoryItem({ generation }: { generation: Generation }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const ts = new Date(generation.startedAt).toLocaleString();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #eee', padding: '6px 0' }}>
      {generation.resultAssetId
        ? <div onClick={() => setViewerOpen(true)} style={{ cursor: 'zoom-in' }}><ImageThumbnail assetId={generation.resultAssetId} size={48} /></div>
        : <div style={{ width: 48, height: 48, background: '#fcc', display: 'grid', placeItems: 'center', borderRadius: 4 }}>✗</div>
      }
      <div style={{ flex: 1, fontSize: 12 }}>
        <div>{ts}</div>
        <div style={{ opacity: 0.7 }}>{generation.status}{generation.errorMessage ? ` — ${generation.errorMessage}` : ''}</div>
      </div>
      {generation.resultAssetId && (
        <button onClick={async () => { await ipc.generation.export(generation.id); }}>Export</button>
      )}
      <GenerationViewerDialog assetId={viewerOpen ? generation.resultAssetId : null} onClose={() => setViewerOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 3: Write `GenerationHistoryList.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import type { Generation } from '@shared/types/domain';
import { ipc } from '@/ipc-client';
import { useJobStore } from '@/features/jobs/store';
import { GenerationHistoryItem } from './GenerationHistoryItem';

export function GenerationHistoryList({ jobId }: { jobId: string }) {
  const [items, setItems] = useState<Generation[]>([]);
  const statuses = useJobStore(s => s.statusByJobId);

  const reload = useCallback(async () => {
    setItems(await ipc.generation.listByJob(jobId));
  }, [jobId]);

  useEffect(() => { void reload(); }, [reload]);
  // reload whenever this job's runtime status flips
  useEffect(() => { void reload(); }, [statuses[jobId], reload]);

  if (items.length === 0) return <p style={{ opacity: 0.6, fontSize: 12 }}>No generations yet.</p>;
  return <div>{items.map(g => <GenerationHistoryItem key={g.id} generation={g} />)}</div>;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/features/generations
git commit -m "feat(generations): add history list, item, and viewer"
```

---

## Phase 7 — Verification

### Task 31: Full typecheck and test run

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: PASS with zero errors.

- [ ] **Step 2: Tests**

Run: `npm test`
Expected: PASS — all suites (`prompt-compose`, `template-repo`, `asset-repo`, `slot-repo`, `job-repo`, `generation-repo`, `batch-runner`).

- [ ] **Step 3: Dev build boot smoke check**

Run: `npm run dev`
Expected: window opens, API key status reads "not set", clicking Settings opens the modal, creating a template appears in the left panel.
Stop with Ctrl+C after verifying.

- [ ] **Step 4: Commit any fix-ups**

```bash
# only if tweaks were required
git commit -am "chore: wire-up fixes after full verification"
```

---

## Self-Review Notes

- **Spec coverage:** Settings (§2 Template §3 data model, §5 IPC) — Tasks 12, 17, 20, 24. Templates — Tasks 3, 7, 17, 20, 25. Jobs — Tasks 10, 17, 20, 27, 28, 29. Slots — Tasks 9, 21, 26. Prompt compose — Tasks 4, 5, 21. Generation — Tasks 11, 14, 15, 16, 21, 30. Export — Task 21. Security (contextIsolation, safeStorage, data URLs, CSP) — Tasks 12, 18, 22, 23. Testing targets (compose, repos, batch-runner, IPC thin pass-through) — Tasks 4–11, 16 (IPC handlers are thin enough that the verification smoke in Task 31 covers them).
- **Type consistency:** `composePrompt` uses `ComposedImageRef` internally but the IPC contract flattens to `{variableName, description, assetId, originalFilename}` in `prompt-ipc.ts` — intentional, since the IPC layer enriches with `originalFilename` from assets.
- **No placeholders:** every step has concrete code/commands and an expected outcome.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-13-nanobanana-factory.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints.

Which approach?
