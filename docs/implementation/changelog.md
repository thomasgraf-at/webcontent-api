# Changelog

## 2025-12-27

### Handler Functions DOM API

Replaced limited function scope API with jQuery-like DOM API using linkedom for host-side parsing.

- `api.$()` / `api.$$()` - Full CSS selector support
- `node.text` - Block-aware text extraction
- `node.attr()` / `node.dataAttr()` - Attribute access
- `node.$()` - Scoped child queries
- `node.closest()` / `node.parent()` - DOM traversal
- Configurable timeout (default 5s, max 60s)

New: `src/services/dom-bridge.ts`, `docs/usage/handler-functions.md`, `docs/implementation/handler-apis.md`

---

### Response Structure Refactor

- Renamed `response` → `result` in envelope
- `debug` moved to top level, opt-in via `--debug` or `debug=true`

---

### Extended Scope Options

- `auto` - Site handler detection (falls back to `main`)
- `selector` - CSS selector-based with include/exclude
- `function` - Handler functions in QuickJS sandbox

New: `src/services/scope.ts`, `src/services/sandbox.ts`

---

### Page IDs

- 12-character nanoid identifiers for stored pages
- `GET /pages/:id`, `POST /get`, `POST /gets` endpoints
- CLI: `webcontent get --id`, `webcontent gets --ids`

---

### Request Logging

- CLI logs to `./logs/requests.log`
- Server logs to console with colored status codes

---

## 2025-12-26

### API Structure

- Nested `data` and `store` inside `options` object
- Moved test files to `/tests/` directory

---

### Store Command

- `webcontent store` / `POST /store` for direct storage without fetching
- Human-readable TTL formats: `7d`, `6h`, `3mo`, `1y`

---

### Database Storage

- Optional Turso/libSQL storage with `--store` flag
- TTL and client/shard identifiers

---

### Deployment

- Cloud Run support with Dockerfile
- Node.js + Bun hybrid approach

---

### Plugin System

- `headings` plugin with minLevel/maxLevel options
- Extensible data plugin architecture
