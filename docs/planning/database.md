# Database Future Plans

Planned enhancements for the database storage feature.

## Implemented

- `DatabaseService` with `storePage()` method
- CLI: `--store`, `--ttl`, `--client` flags
- API: `store` parameter (boolean or `{ ttl, client }`)
- Schema: `pages` table with indexes

See `docs/implementation/core-implementation.md` for current implementation details.

---

## Planned: Listing & Filtering

Query stored pages via CLI and API.

### CLI Commands

```bash
# List recent pages
webcontent db list --limit 10

# Filter by domain
webcontent db list --domain example.com

# Filter by client
webcontent db list --client my-app
```

### API Endpoints

```
GET /pages?domain=example.com&limit=10
GET /pages/:id
```

---

## Planned: Cleanup Routine

Automatic deletion of expired records (where `deleteAt < now`).

### Options

1. **CLI command**: `webcontent db cleanup`
2. **Cron job**: Scheduled external trigger
3. **Server startup**: Run cleanup on server start

### Implementation

```sql
DELETE FROM pages WHERE deleteAt < ?;
```

---

## Planned: Deduplication (Optional)

Add option to update existing records instead of always inserting:

```bash
webcontent fetch https://example.com --store --upsert
```

Would require unique constraint on `(url, client)` or similar.
