# Changelog

## 2025-12-26

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
