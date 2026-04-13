# NanoBanana Factory — Design Spec

**Date:** 2026-04-13
**Status:** Approved (pending implementation plan)
**Scope:** MVP-ready foundation for a personal, local-only Electron desktop app that orchestrates Gemini image generation via reusable templates and selectable jobs.

---

## 1. Purpose & Scope

A single-user desktop app that acts as a "generation factory":

- User saves a Gemini (NanoBanana) API key locally.
- User defines **templates** that carry shared instructions (a single prompt text) and shared reference images (each labeled with a variable name + description).
- Under each template the user creates **jobs**. Each job has its own prompt and its own labeled reference images.
- User multi-selects jobs and clicks "Generate selected" to run them with limited parallelism (max 3 concurrent).
- Each generation records its full input snapshot for reproducibility, and results accumulate as a history per job.
- All data — templates, jobs, assets, results — lives on the local machine. Nothing syncs externally.

Out of scope for MVP: cloud sync, multi-user, sharing, credit tracking, prompt blocks (decided against), team workflows.

## 2. Architectural Decisions (summary)

| Decision | Choice | Reason |
|---|---|---|
| Language / UI | TypeScript + React | Prompt requirement; standard Electron renderer stack. |
| Build | `electron-vite` | First-class Electron + Vite + HMR support. |
| DB | `better-sqlite3` (synchronous, embedded) | Relational data (Template → Job → Generation), simple ops in Electron main process. |
| ORM | None — hand-rolled repositories | Keeps SQL visible, minimal toolchain, easy debugging. |
| Image storage | Filesystem, content-addressed (`userData/assets/<hash>.<ext>`) | Avoids DB bloat, enables dedup, easy to back up. |
| Secrets (API key) | Electron `safeStorage` (OS keychain) | Isolated from SQLite, OS-protected. |
| Renderer state | `zustand` per feature | Minimal boilerplate; one store per feature folder. |
| IPC | Typed `contextBridge` + `ipcMain.handle` | Security defaults (`contextIsolation`, `sandbox`) preserved. |
| Generation client | `@google/generative-ai` in main process only | Key never leaves main; renderer receives only results. |
| Testing | `vitest` + repository/service fakes | TDD on pure compose logic + repos + batch runner. |
| Navigation | 3-panel layout, no router | Single window; settings is a modal. |

Generation service is behind an `IGenerationService` interface with a real `GeminiGenerationService` (default) and a `FakeGenerationService` (tests only). Production always uses the real client — the original prompt's "mock service for now" line was corrected by the user.

## 3. Data Model

### 3.1 SQLite schema

```sql
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

### 3.2 TypeScript domain types

Located in `src/shared/types/domain.ts` and imported by both main and renderer.

```typescript
export type UUID = string;
export type UnixMs = number;

export interface Template {
  id: UUID; name: string; sharedPrompt: string;
  createdAt: UnixMs; updatedAt: UnixMs;
}

export interface Job {
  id: UUID; templateId: UUID; name: string; prompt: string;
  createdAt: UnixMs; updatedAt: UnixMs;
}

export interface Asset {
  id: UUID; contentHash: string; mimeType: string;
  byteSize: number; originalFilename: string | null; createdAt: UnixMs;
}

export type SlotOwnerKind = 'template' | 'job';

export interface ImageSlot {
  id: UUID; ownerKind: SlotOwnerKind; ownerId: UUID;
  assetId: UUID; variableName: string; description: string; position: number;
}

export type GenerationStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface ImageRefSnapshot {
  variableName: string; assetId: UUID; description: string;
}

export interface Generation {
  id: UUID; jobId: UUID; status: GenerationStatus;
  finalPrompt: string; imageRefs: ImageRefSnapshot[];
  resultAssetId: UUID | null; errorMessage: string | null;
  model: string; startedAt: UnixMs; finishedAt: UnixMs | null;
}
```

### 3.3 Design notes

- **Asset dedup**: `assets.content_hash` is unique. Multiple slots can point to the same asset; an orphan-GC pass removes asset files when no slot or generation references them anymore.
- **Reproducibility**: `generations.final_prompt` and `image_refs_json` are immutable snapshots. Editing a template or job later does not alter historical generations.
- **Cascade deletes**: Deleting a template cascades to jobs and generations. Assets are not cascade-deleted; GC handles them.
- **Variable name uniqueness** is scoped per-owner. A template may define `imageA` and a job under it may also define `imageA`; compose logic resolves the conflict (see §6).

## 4. Folder Structure

```
lovely-little-eletron/
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── app-context.ts
│   │   ├── db/
│   │   │   ├── connection.ts
│   │   │   ├── migrate.ts
│   │   │   ├── migrations/001_init.sql
│   │   │   └── repositories/{template,job,slot,asset,generation}-repo.ts
│   │   ├── services/
│   │   │   ├── asset-store.ts
│   │   │   ├── secure-storage.ts
│   │   │   ├── batch-runner.ts
│   │   │   └── generation/{IGenerationService,GeminiGenerationService,FakeGenerationService}.ts
│   │   └── ipc/
│   │       ├── register.ts
│   │       └── {template,job,slot,settings,prompt,generation,asset}-ipc.ts
│   ├── preload/index.ts
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── ipc-client.ts
│   │   ├── features/
│   │   │   ├── templates/{components,hooks,store.ts}
│   │   │   ├── jobs/{components,store.ts}
│   │   │   ├── slots/components
│   │   │   ├── generations/components
│   │   │   └── settings/{components,store.ts}
│   │   ├── components/           # shared UI (Button, Dialog, Badge, Input)
│   │   └── styles/
│   └── shared/
│       ├── types/domain.ts
│       ├── ipc-contract.ts
│       ├── prompt-compose.ts
│       └── prompt-compose.test.ts
├── resources/{icon.png,placeholder.png}
├── tests/setup.ts
├── docs/superpowers/specs/
├── electron.vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── .gitignore
└── package.json
```

**Layering rule**: IPC handler → Service → Repository → DB. Each layer depends only on the layer directly beneath. `shared/` is consumed by both `main/` and `renderer/` but never imports from them.

## 5. IPC Design

### 5.1 Contract

Declared as a single type map in `src/shared/ipc-contract.ts` so both sides share request/response shapes:

```typescript
export interface IpcContract {
  'settings:getApiKeyPresence': { req: void; res: { present: boolean } };
  'settings:setApiKey':         { req: { apiKey: string }; res: void };
  'settings:clearApiKey':       { req: void; res: void };

  'template:list':   { req: void; res: Template[] };
  'template:get':    { req: { id: UUID }; res: Template | null };
  'template:create': { req: { name: string }; res: Template };
  'template:update': { req: { id: UUID; patch: Partial<Pick<Template,'name'|'sharedPrompt'>> }; res: Template };
  'template:delete': { req: { id: UUID }; res: void };

  'job:listByTemplate': { req: { templateId: UUID }; res: Job[] };
  'job:get':    { req: { id: UUID }; res: Job | null };
  'job:create': { req: { templateId: UUID; name: string }; res: Job };
  'job:update': { req: { id: UUID; patch: Partial<Pick<Job,'name'|'prompt'>> }; res: Job };
  'job:delete': { req: { id: UUID }; res: void };

  'slot:listByOwner': { req: { ownerKind: SlotOwnerKind; ownerId: UUID };
                        res: Array<ImageSlot & { asset: Asset }> };
  'slot:create': { req: { ownerKind: SlotOwnerKind; ownerId: UUID;
                          variableName: string; description: string;
                          imageBytes: ArrayBuffer; originalFilename: string; mimeType: string };
                   res: ImageSlot & { asset: Asset } };
  'slot:update': { req: { id: UUID; patch: Partial<Pick<ImageSlot,'variableName'|'description'|'position'>> };
                   res: ImageSlot };
  'slot:delete': { req: { id: UUID }; res: void };

  'prompt:compose': { req: { jobId: UUID };
                      res: { finalPrompt: string;
                             imageRefs: Array<{ variableName: string; description: string; assetId: UUID;
                                                originalFilename: string | null }>;
                             warnings: string[] } };

  'generation:runMany':    { req: { jobIds: UUID[] }; res: { batchId: string } };
  'generation:cancel':     { req: { generationId: UUID }; res: void };
  'generation:listByJob':  { req: { jobId: UUID }; res: Generation[] };

  'asset:getDataUrl': { req: { assetId: UUID }; res: { dataUrl: string } };

  'generation:export': { req: { generationId: UUID };
                         res: { savedPath: string } | { cancelled: true } };
}

export interface IpcEvents {
  'generation:update': {
    generationId: UUID; jobId: UUID;
    status: 'running' | 'succeeded' | 'failed';
    resultAssetId?: UUID; errorMessage?: string;
  };
}
```

### 5.2 Preload bridge

```typescript
const api = {
  invoke: <C extends keyof IpcContract>(ch: C, req: IpcContract[C]['req']) =>
    ipcRenderer.invoke(ch, req) as Promise<IpcContract[C]['res']>,
  on: <E extends keyof IpcEvents>(ev: E, fn: (p: IpcEvents[E]) => void) => {
    const w = (_: unknown, p: IpcEvents[E]) => fn(p);
    ipcRenderer.on(ev, w);
    return () => ipcRenderer.off(ev, w);
  },
};
contextBridge.exposeInMainWorld('api', api);
```

Renderer code wraps this in `src/renderer/ipc-client.ts` for ergonomic call sites (`ipc.template.list()`, `ipc.generation.onUpdate(fn)`).

### 5.3 Main handler registration

`src/main/ipc/register.ts` defines a typed `handle<C>` helper and calls domain files (`template-ipc.ts`, `job-ipc.ts`, …) to register their handlers against an `AppContext` built in `app-context.ts`.

### 5.4 Design notes

- `asset:getDataUrl` returns a base64 data URL instead of a path. This keeps `contextIsolation` intact — the renderer never learns absolute filesystem paths. A later optimization can swap in a custom `app://` protocol handler if memory pressure becomes an issue.
- `generation:runMany` returns immediately with a `batchId`. Progress flows back as `generation:update` events. The renderer's job store subscribes once (at App mount) and updates per-job status badges.
- Image upload happens in a single IPC call (`slot:create` with `imageBytes`) rather than a two-step upload-then-attach flow. This is adequate for a personal app; if asset reuse across slots becomes a frequent workflow, split into `asset:upload` + `slot:attach`.

## 6. Prompt Composition

Located in `src/shared/prompt-compose.ts` — pure, dependency-free, usable by both preview (renderer) and execution (main). This guarantees preview output matches what the API actually receives.

### 6.1 Merge rules

- Image slots are merged by `variableName`. When a template and a job both define the same name, **the job's slot wins** (override semantics).
- Ordering of the attached image list: all template slots first (by `position`), then all job slots (by `position`). If a name is overridden, it appears once, at the job's position (template entry suppressed).
- The final prompt text is `template.sharedPrompt` then `job.prompt`, joined by `\n\n`, with empty parts omitted.

### 6.2 Warnings

- Referenced but undefined: any `{foo}` in the combined prompt whose name has no corresponding slot.
- Defined but unreferenced: any slot whose `{variableName}` never appears in the combined prompt.

Both are surfaced in `compose:result.warnings`. Preview UI groups them by severity; generation proceeds regardless (the user may reference images implicitly through description text).

### 6.3 Gemini payload assembly (main only)

Per the reference Python flow, each image is preceded by a text Part describing it:

```typescript
const parts: Part[] = [];
for (const ref of composed.imageRefs) {
  const label = `{${ref.variableName}}`;
  const desc = ref.description ? `${label} (${ref.description})` : label;
  parts.push({ text: desc });
  const { bytes, mimeType } = await assetStore.readBytes(ref.assetId);
  parts.push({ inlineData: { data: bytes.toString('base64'), mimeType } });
}
parts.push({ text: composed.finalPrompt });

await client.models.generateContent({
  model: 'gemini-3.1-flash-image-preview',
  contents: [{ role: 'user', parts }],
  config: { responseModalities: ['IMAGE'] },
});
```

The model identifier is kept as a constant in `src/main/services/generation/constants.ts` so a future settings toggle can override it.

## 7. Renderer Structure

### 7.1 Layout

Single window, 3-panel grid: **TemplatePanel | JobPanel | JobDetailPanel**. A gear icon in `AppHeader` opens a `SettingsModal` for API key management. No routing library; selection state drives the layout.

### 7.2 Component tree (summary)

```
App
├── AppHeader → SettingsModal
└── MainLayout
    ├── TemplatePanel → TemplateListItem[], TemplateEditView
    │                   (SharedPromptEditor, ImageSlotList[template])
    ├── JobPanel      → JobToolbar, JobListItem[], BatchProgressBar
    └── JobDetailPanel → JobHeader, ImageSlotList[job], JobPromptEditor,
                         TemplateSummary (readonly), PromptPreviewDialog,
                         GenerateConfirmDialog, GenerationHistoryList
```

`ImageSlotList` is a shared component parameterized by `ownerKind` + `ownerId`.

### 7.3 State management

One `zustand` store per feature (`templates`, `jobs`, `settings`). Stores wrap IPC calls and expose actions plus selector-friendly state. The `jobs` store subscribes to `generation:update` events at App mount and updates `statusByJobId` live.

### 7.4 UX details

- **Variable autocomplete**: typing `{` in prompt editors surfaces defined variable names from the current template + job.
- **Preview dialog**: runs `prompt:compose` and displays the composed prompt text, the ordered image list (thumbnail, label, description), and any warnings.
- **Generate confirmation**: a simple confirm dialog listing selected jobs and expected API call count; OK triggers `generation:runMany`.
- **History items**: clicking one shows the result at full size with an Export button and a "clone as new job" shortcut for reproducibility.

## 8. Generation & Batch Runner

`src/main/services/batch-runner.ts` manages concurrency:

- Accepts a list of `jobIds`, creates one `generations` row per job with status `pending`.
- Runs up to 3 in parallel. Each execution:
  1. Load template, job, merged slots → call `composePrompt`.
  2. Build Gemini `parts` (text + inlineData) and call `generateContent`.
  3. Extract the first `IMAGE` part from the response, hash it, persist via `AssetStore`, set `generations.result_asset_id`, mark `succeeded`.
  4. On error: mark `failed`, record `error_message`.
- After each transition, emit `generation:update` to all renderer windows via `webContents.send`.
- Cancel support: a generation in `pending` can be removed from the queue; one already `running` cannot be cancelled mid-request (Gemini SDK constraint) but its result is discarded if the user deletes the job.

Rate limiting beyond the concurrency cap is not implemented in MVP; if Gemini returns rate-limit errors the generation simply fails and the user may retry.

## 9. Asset Store & Export

- `asset-store.ts` writes incoming bytes to `userData/assets/<contentHash>.<ext>` where `<ext>` is derived from the mime type. A SHA-256 hash is computed streaming so large images don't balloon memory.
- **Export (`generation:export`)**: opens Electron's `dialog.showSaveDialog` with a default filename of `{templateName}_{jobName}_{YYYY-MM-DD_HHmm}.{ext}` (decision C). User can rename. No sidecar JSON in MVP — the DB retains the full snapshot for later re-derivation if needed.
- **GC**: on template/job deletion, after the cascade, a sweep removes any asset with zero references from `image_slots`, `generations.result_asset_id`, and `generations.image_refs_json`. Runs synchronously after deletion; for a personal app the asset count stays small enough that this is cheap.

## 10. Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on the renderer window.
- Only `contextBridge`-exposed methods are reachable from the renderer.
- API key stored with Electron `safeStorage` (OS keychain). It is never sent over IPC after being set; the renderer only queries presence.
- Renderer never receives filesystem paths; images are delivered as data URLs.
- CSP on `index.html`: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline';` (inline styles allowed for convenience; can tighten later).
- Gemini SDK runs in main only — the API key never crosses the IPC boundary.

## 11. Testing Strategy

TDD applies to the four targets below. UI component tests are out of scope for MVP.

| Target | Style | Location |
|---|---|---|
| `composePrompt` (pure) | Unit, table-driven | `src/shared/prompt-compose.test.ts` |
| Repositories | Integration against an in-memory SQLite DB with migrations applied | `src/main/db/repositories/*.test.ts` |
| `BatchRunner` | Integration using `FakeGenerationService` to verify concurrency cap, event order, failure handling | `src/main/services/batch-runner.test.ts` |
| IPC handlers | Thin contract tests verifying req/res pass-through | `src/main/ipc/*.test.ts` |

Vitest is configured with two projects — `shared`/`main` (node env) and, if added later, `renderer` (jsdom env).

## 12. Build & Tooling

- `electron-vite dev` — dev server with HMR for main/preload/renderer.
- `electron-vite build` — production bundle.
- `electron-builder` — packages to .dmg/.zip on macOS (primary target per env).
- `vitest run` — all tests.
- `tsc --noEmit` — typecheck across all three tsconfig projects.

`.gitignore` excludes `node_modules/`, `out/`, `dist/`, `release/`, and any local `app.db` artifacts from dev runs.

## 13. Open Questions / Future Work

- Whether to expose `responseModalities`, aspect-ratio hints, or negative prompts in the UI once the base flow works.
- Whether to add a sidecar JSON alongside exported PNGs once the user has a real need to share generations with metadata.
- Whether to implement an `app://` protocol for image delivery if memory pressure from data URLs becomes noticeable.
- Whether to support cancelling in-flight generations once the Gemini SDK supports it cleanly.

These do not block MVP and are intentionally deferred.
