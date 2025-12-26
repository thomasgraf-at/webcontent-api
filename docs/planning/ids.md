# Page IDs

Unique identifiers for stored pages.

## Overview

Each stored page gets a unique `id` for direct retrieval.

## ID Format

Use short, URL-safe IDs:

```typescript
function generatePageId(): string {
  // 12 character base62 ID
  // ~62^12 = 3.2e21 possible values
  return nanoid(12);
}
```

Or use Bun's built-in:

```typescript
const id = Bun.randomUUIDv7(); // Time-ordered UUID
```

**Recommendation**: Use `nanoid` with 12 chars for shorter, URL-friendly IDs.

## Database Schema

```sql
ALTER TABLE pages ADD COLUMN id TEXT UNIQUE;
CREATE UNIQUE INDEX idx_pages_id ON pages(id);
```

Generate ID on insert:

```typescript
const pageData: PageData = {
  id: generatePageId(),
  url: result.url,
  // ...
};
```

## API Endpoints

### Get by ID

```
GET /pages/:id
```

```
POST /get
{
  "id": "abc123def456"
}
```

Returns full page data:

```json
{
  "request": {
    "id": "abc123def456"
  },
  "response": {
    "id": "abc123def456",
    "timestamp": 1700000000000,
    "url": "https://example.com",
    "status": 200,
    "meta": { ... },
    "content": "...",
    "data": { ... },
    "cached": true
  }
}
```

### Get Multiple by IDs

```
POST /pages
{
  "ids": ["abc123", "def456", "ghi789"]
}
```

Response:

```json
{
  "count": 3,
  "results": [
    { "id": "abc123", ... },
    { "id": "def456", ... },
    { "id": "ghi789", ... }
  ]
}
```

Order matches input order. Missing IDs are omitted (or included with `error` field).

## CLI Commands

```bash
# Get single page by ID
webcontent get --id abc123def456

# Get multiple pages by ID
webcontent get --ids abc123,def456,ghi789

# Output includes ID
webcontent fetch https://example.com --store
# Output: { "response": { "id": "abc123def456", ... } }
```

## Response Changes

All stored page responses include `id`:

```json
{
  "response": {
    "id": "abc123def456",
    "timestamp": 1700000000000,
    "url": "...",
    "cached": true
  }
}
```

For `/fetch` without storage, `id` is not included.

## Use Cases

1. **Bookmarking**: Save page ID for later retrieval
2. **References**: Link to specific stored pages
3. **Batch operations**: Process multiple pages by ID
4. **Deduplication**: Check if page exists before re-fetching

## Client Isolation

IDs are globally unique but client isolation still applies:

```
GET /pages/abc123?client=my-app
```

If the page belongs to a different client (or has no client when request has one), return 404.

## Implementation Steps

1. Add `id` column to schema
2. Update `storePage()` to generate ID
3. Add `getPageById()` to DatabaseService
4. Add `getPagesByIds()` to DatabaseService
5. Add `GET /pages/:id` route
6. Add `POST /pages` route for batch
7. Update `/get` to support `id` parameter
8. Update CLI `get` command
9. Include `id` in all storage responses
