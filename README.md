# 🗄️ SQLite in the Browser

> **A definitive, framework-agnostic boilerplate for local-first web applications.**
> Sub-millisecond queries. Persistent on-device storage. Zero server required.

[![Vite](https://img.shields.io/badge/Vite-5.x-646cff?style=flat-square&logo=vite)](https://vitejs.dev)
[![SQLite WASM](https://img.shields.io/badge/SQLite-WASM-003b57?style=flat-square&logo=sqlite)](https://sqlite.org/wasm/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

---

## 🤔 The "Why": Local-First Architecture

Traditional web apps route every data operation through a remote server. Every read, every write traverses a network. This introduces irreducible latency — milliseconds at best, seconds at worst — and creates a hard dependency on connectivity.

**Local-first** flips this model. Data lives on the user's device and is treated as the source of truth. Sync to a server is optional and secondary. The result:

- ⚡ **Latency measured in microseconds**, not milliseconds
- 📡 **Full offline capability** — the app works whether or not there's a network
- 🔒 **Privacy by default** — user data never leaves the device unless explicitly synced
- 🏗️ **Reduced backend complexity** — query logic lives in the client, not an API server

**SQLite in the browser** (via WebAssembly and OPFS) is the most powerful primitive available today for achieving this.

---

## 💾 SQLite WASM + OPFS

[SQLite](https://sqlite.org) is the world's most widely deployed database engine. The official [`@sqlite.org/sqlite-wasm`](https://sqlite.org/wasm/doc/trunk/index.md) package compiles it to WebAssembly, making the full SQL engine available directly in the browser.

Persistent storage is handled by the **Origin Private File System (OPFS)** — a browser API that gives each origin a sandboxed, private filesystem with synchronous (byte-level, high-performance) access from Web Workers.

OPFS is:

- **Persistent** — survives page reloads, browser restarts, and power cycles
- **Private** — invisible to other origins and inaccessible to the regular filesystem
- **Fast** — synchronous I/O from a Worker avoids the overhead of IndexedDB's async event model

Together, SQLite WASM on OPFS achieves **real, relational, durable storage with sub-millisecond query performance**.

---

## 🧩 The Vanilla Advantage

This boilerplate is intentionally **framework-agnostic**. The entire database layer lives in two files:

```
src/worker.ts  — The SQLite engine, running in a Web Worker
src/db.ts      — A typed, Comlink-wrapped async API for the main thread
```

To use this in **any** modern project, just import `src/db.ts`:

```ts
// In a React component, Svelte store, Astro page, or plain TS file:
import { db } from "./db";

const tasks = await db.getTasks();
await db.insertTask("Ship it!");
```

No framework adapter required. No custom hooks. No stores. It's just an asynchronous module.

---

## 🏗️ Architecture: Why a Web Worker is Mandatory

```
┌─────────────────────────────────────┐
│  Main Thread (UI)                   │
│                                     │
│  src/main.ts                        │
│     │                               │
│     │  await db.getTasks()          │
│     │  (async, via Comlink)         │
│     ▼                               │
│  src/db.ts  (Comlink.wrap)  ───────►│── postMessage ──►┐
└─────────────────────────────────────┘                   │
                                                          ▼
                                      ┌─────────────────────────────────────┐
                                      │  Web Worker                         │
                                      │                                     │
                                      │  src/worker.ts                      │
                                      │     │                               │
                                      │     │  SQLite WASM (OpfsDb)         │
                                      │     │  Synchronous OPFS I/O         │
                                      │     ▼                               │
                                      │  Origin Private File System         │
                                      │  (persistent .sqlite3 file)        │
                                      └─────────────────────────────────────┘
```

OPFS's highest-performance synchronous API (`FileSystemSyncAccessHandle`) is **only accessible from a Web Worker** — it is blocked from the main thread to prevent UI freezing. The SQLite WASM `OpfsDb` class uses this API internally.

[Comlink](https://github.com/GoogleChromeLabs/comlink) bridges the two threads: it wraps the `Database` class exposed in the worker and makes it callable from the main thread using standard `async/await`, transparently marshalling calls over `postMessage`.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A modern browser (Chrome 109+, Edge 109+, Firefox 111+, Safari 16.4+)

### Install & Run

```bash
# Clone the repository
git clone https://github.com/didof/sqlite-in-browser
cd sqlite-in-browser

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Add tasks, refresh the page — your data persists.

Open the **DevTools console** to see the raw query timing logs:

```
[perf] getTasks returned 12 rows in 0.31ms
[perf] insertTask completed in 0.18ms
```

### Build for Production

```bash
npm run build
npm run preview
```

---

## ⚠️ Gotcha: Cross-Origin Isolation Headers are Mandatory

SQLite WASM relies on `SharedArrayBuffer` for optimal performance. For security reasons, browsers only allow `SharedArrayBuffer` in **cross-origin isolated** contexts.

You **must** serve your app with these HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

This boilerplate configures them automatically in `vite.config.ts` for local development.

**For production deployments on platforms that support custom headers**, configure them at your server or CDN level:

| Platform             | How                                      |
| -------------------- | ---------------------------------------- |
| **Netlify**          | `netlify.toml` with `[[headers]]` block  |
| **Vercel**           | `vercel.json` with `headers` array       |
| **Cloudflare Pages** | `_headers` file in public directory      |
| **Nginx**            | `add_header` in `location` block         |
| **Apache**           | `.htaccess` with `Header set` directives |

Example `_headers` for Cloudflare Pages / Netlify:

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

> **Important:** If these headers are missing, SQLite WASM will fall back to a slower, non-persistent in-memory mode, or fail entirely. Check the browser console for warnings.

### 🐙 GitHub Pages: the `coi-serviceworker` workaround

GitHub Pages **does not support custom HTTP headers**. You cannot set COOP/COEP there at the infrastructure level. This is a hard platform limitation.

The solution is [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) — a tiny service worker that intercepts every fetch response and injects the required headers on the client side.

**How it works:**

1. On first page load, the script registers the service worker and immediately reloads the page.
2. On the second load (controlled by the SW), every response is intercepted and the headers are added:
   - `Cross-Origin-Embedder-Policy: require-corp`
   - `Cross-Origin-Opener-Policy: same-origin`
3. `window.crossOriginIsolated` becomes `true` → OPFS and `SharedArrayBuffer` are now available.

This boilerplate ships `public/coi-serviceworker.js` and loads it as the **first script in `<head>`** — before any module scripts — so the reload happens before any application code runs:

```html
<head>
  <!-- Must be first: triggers a reload into a cross-origin isolated context -->
  <script src="coi-serviceworker.js"></script>
  ...
</head>
```

> **Note:** On local dev, the Vite server headers handle isolation directly. The service worker detects `window.crossOriginIsolated === true` and skips registration, so there is no double-reload in development.

---

## 📁 Project Structure

```
sqlite-in-browser/
├── index.html              # Semantic HTML entry point
├── vite.config.ts          # Vite config with COOP/COEP headers
├── tsconfig.json           # Strict TypeScript config
├── package.json
├── public/
│   └── coi-serviceworker.js  # Service worker for GitHub Pages (see below)
└── src/
    ├── worker.ts           # SQLite WASM database engine (Web Worker)
    ├── db.ts               # Comlink-wrapped async DB API (main thread)
    ├── main.ts             # UI logic & DOM manipulation
    └── style.css           # Vanilla CSS design system
```

---

## 🛠️ Extending This Boilerplate

Since this is a raw primitive, extending it is straightforward:

**Add a new SQL query:**

```ts
// In src/worker.ts, inside the Database class:
deleteTask(id: number) {
  this.db.exec({ sql: 'DELETE FROM tasks WHERE id = ?', bind: [id] });
}
```

It's automatically available on `db.deleteTask(id)` in the main thread via Comlink.

**Add a new table:**

```ts
// In initDb(), add another CREATE TABLE IF NOT EXISTS statement:
this.db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT,
    created_at INTEGER DEFAULT (unixepoch())
  )
`);
```

**Use from a React component:**

```tsx
import { db } from "../db"; // adjust path

useEffect(() => {
  db.getTasks().then(setTasks);
}, []);
```

---

## 📄 License

MIT License

Copyright (c) 2026 didof

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
