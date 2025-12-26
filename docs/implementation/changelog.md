# Changelog

## 2025-12-27

### Page IDs

Added unique identifiers for stored pages using nanoid.

**Features**:
- 12-character URL-safe IDs generated with `nanoid`
- IDs returned in store/fetch responses when storing
- Direct page retrieval by ID

**New API Endpoints**:
- `GET /pages/:id` - Get single page by ID
- `POST /get` with `{ id }` - Alternative single page lookup
- `POST /gets` with `{ ids: [...] }` - Get multiple pages (max 100)

**New CLI Commands**:
- `webcontent get --id <id>` - Retrieve single page
- `webcontent gets --ids <id1,id2,...>` - Retrieve multiple pages

**Response Changes**:
- `/store` now returns `id` in response
- `/fetch` with `store` option now returns `id` in response
- Retrieved pages include `cached: true` flag

**Database Schema**:
- Changed `id` column from `INTEGER AUTOINCREMENT` to `TEXT PRIMARY KEY`
- IDs are generated on insert, not by database

---

### Request Logging

Added request logging for both CLI and server.

**CLI Logging**:
- Logs to file: `./logs/requests.log` (gitignored)
- Plain text format (no colors)

**Server Logging**:
- Logs to console with colors
- Status codes: green (2xx), yellow (3xx), red (4xx-5xx)
- Arrow icon (`➤`) prefix

**Log Format**:
```
14:32:05 | POST /fetch | https://example.com | id:abc123 | 200
```

**Fields logged**: timestamp (HH:MM:SS), command, url, id, status, count

---

## 2025-12-26

### API Request Structure Refactoring

Restructured request format to nest `data` and `store` inside `options`:

**Before:**
```json
{
  "url": "...",
  "data": { "headings": true },
  "store": { "ttl": "7d" }
}
```

**After:**
```json
{
  "url": "...",
  "options": {
    "scope": "main",
    "format": "markdown",
    "data": { "headings": true },
    "store": { "ttl": "7d" }
  }
}
```

All options must be nested inside `options`.

---

### Test Files Reorganized

Moved test HTML files to `/tests/` directory:
- `tests/fetch.html` - Fetch API testing
- `tests/store.html` - Store API testing (new)

---

### Store Command/API

Added `store` command and `/store` API endpoint for storing page data directly without fetching.

- CLI: `webcontent store <url> --content "..." [options]`
- API: `POST /store` with JSON body
- Requires URL and at least one of: body, content, or data
- Supports all PageData fields: status, title, meta, options
- TTL duration format supported

---

### TTL Duration Parsing

Added human-readable TTL duration formats for database storage.

**Supported formats**:
- Plain seconds: `60`, `3600`
- Minutes: `60min`, `60m`
- Hours: `6hours`, `6h`
- Days: `10days`, `10d`
- Months: `3months`, `3mo`
- Years: `1year`, `1y`

Works in both CLI (`--ttl 7d`) and API (`store.ttl: "7d"`).

---

### Database Storage

Added optional Turso/libSQL database storage for fetch results.

- Store fetched pages with `--store` flag (CLI) or `store` parameter (API)
- Configurable TTL and client/shard identifiers
- Automatic domain extraction and metadata storage

---

### Google Cloud Run Deployment

Added Cloud Run deployment support with Cloud Build.

- Dockerfile using Node.js + Bun hybrid approach
- `npm install` for native dependencies, Bun for runtime
- Server binds to `0.0.0.0` for container compatibility

---

### Plugin System

Added extensible data plugin architecture.

- `headings` plugin extracts h1-h6 hierarchy
- Plugin options support (minLevel, maxLevel)
- Separate `data` parameter from core `include` fields
