# Database Plans

Future enhancements for the database storage feature.

## Implemented

- `DatabaseService` with `storePage()` method
- CLI: `--store`, `--ttl`, `--client` flags
- API: `options.store` with `ttl` and `client`
- POST `/store` endpoint for direct storage
- Schema: `pages` table with indexes
- TTL duration parsing (60m, 6h, 7d, 3mo, 1y)

---

## Planned Features

See dedicated planning docs:
- [get.md](./get.md) - Cached fetch with database lookup
- [list.md](./list.md) - List and filter stored pages

---

## Cleanup Routine

Automatic deletion of expired records (where `deleteAt < now`).

### Options

1. **CLI command**: `webcontent db cleanup`
2. **Scheduled job**: External cron trigger via `/cleanup` endpoint
3. **On-demand**: Run during low-traffic periods

### Implementation

```sql
DELETE FROM pages WHERE deleteAt < ?;
```

### API Endpoint

```
POST /cleanup
{
  "secret": "admin-secret"
}
```

Returns:
```json
{
  "deleted": 150,
  "remaining": 1200
}
```

Protect with secret or auth token.

---

## Stats Endpoint

Get database statistics.

```
GET /stats
```

```json
{
  "pages": {
    "total": 1200,
    "byDomain": [
      { "domain": "example.com", "count": 450 },
      { "domain": "other.com", "count": 300 }
    ],
    "byClient": [
      { "client": "app-1", "count": 600 },
      { "client": null, "count": 400 }
    ]
  },
  "storage": {
    "expiringSoon": 50,
    "oldestTimestamp": 1699000000000
  }
}
```

---

## Schema Migrations

### optionsHash Column

Required for `/get` endpoint:

```sql
ALTER TABLE pages ADD COLUMN optionsHash TEXT;
CREATE INDEX idx_pages_url_hash ON pages(url, optionsHash);
```

### Future: Full-text Search

For better search in `/list`:

```sql
CREATE VIRTUAL TABLE pages_fts USING fts5(
  url, title, description,
  content='pages',
  content_rowid='id'
);
```

---

## CLI Commands

```bash
# Database management
webcontent db cleanup              # Delete expired records
webcontent db stats                # Show statistics
webcontent db migrate              # Run pending migrations

# Query commands (see list.md, get.md)
webcontent get <url>               # Get cached or fetch
webcontent list --client my-app    # List stored pages
```

---

## Considerations

### Upsert vs Insert

Current behavior: Always insert new record.

Option: Update existing record if URL + client match.

```bash
webcontent fetch https://example.com --store --upsert
```

**Decision**: Defer. Current append-only model is simpler and preserves history.

### Sharding by Client

For multi-tenant scenarios, `client` field enables logical sharding.

- Each client sees only their records
- Cleanup can be per-client
- Stats can be per-client

### Turso Embedded Replicas

For local development/testing:

```typescript
const db = createClient({
  url: process.env.TURSO_URL,
  syncUrl: process.env.TURSO_SYNC_URL,  // Remote for sync
  authToken: process.env.TURSO_AUTH_TOKEN,
});
```

Enables offline-first with sync to remote.
