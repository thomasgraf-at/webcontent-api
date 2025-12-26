# GET Route

Retrieve stored page data from the database, or fetch fresh if not cached.

## Endpoints

### `GET /get`

Query parameters:
- `url` (required): URL to retrieve
- `scope`: Scope used when stored (default: `main`)
- `format`: Format used when stored (default: `markdown`)
- `data`: Data plugins used when stored (JSON string)
- `client`: Client identifier

### `POST /get`

**By URL** (cached fetch):
```json
{
  "url": "https://example.com",
  "options": {
    "scope": "main",
    "format": "markdown",
    "data": { "headings": true }
  },
  "client": "my-app"
}
```

**By ID** (direct retrieval):
```json
{
  "id": "abc123def456",
  "client": "my-app"
}
```

When using `id`, no options are needed - returns the stored page directly.

## Matching Logic

### Options Hash

Introduce an `optionsHash` column stored with each page record.

**Whitelist** - only these options affect content and are included in hash:

| Option | Affects | Reason |
|--------|---------|--------|
| `scope` | Content extraction | Determines main vs full body |
| `format` | Content format | html/markdown/text output |
| `include` | Response fields | Which fields are populated |
| `data` | Plugin output | Which plugins run and their config |

**Excluded** - these do not affect content:

| Option | Reason |
|--------|--------|
| `store.ttl` | Storage duration only |
| `store.client` | Ownership only |

### Match Requirements

A record matches when:
1. URL matches exactly
2. `optionsHash` matches
3. `client` matches (or both are null)

### Hash Computation

```typescript
// Whitelist of options that affect content
const HASH_OPTIONS = ['scope', 'format', 'include', 'data'] as const;

function computeOptionsHash(options: ApiRequestOptions): string {
  const hashable: Record<string, unknown> = {};

  for (const key of HASH_OPTIONS) {
    if (options[key] !== undefined) {
      hashable[key] = options[key];
    }
  }

  // Sort keys for deterministic output
  const normalized = sortKeys(hashable);
  return hash(JSON.stringify(normalized));
}
```

Use a fast hash (e.g., `Bun.hash` or djb2) - collision resistance not critical.

### Include Field Handling

The `include` field affects what's stored:
- If `include` doesn't have `content: true`, content won't be stored
- Hash must include `include` to match correctly

```typescript
// These would have different hashes:
{ scope: "main", format: "markdown", include: { meta: true, content: true } }
{ scope: "main", format: "markdown", include: { meta: true, content: false } }
```

## Behavior

1. Check database for matching record (URL + optionsHash + client)
2. If found: return cached data
3. If not found: fetch fresh, store, and return

This makes `/get` the primary endpoint for most use cases - it returns cached data when available and fetches when needed.

### Comparison

| Endpoint | Cache Check | Fetch | Store |
|----------|-------------|-------|-------|
| `/fetch` | No | Always | If `store` option |
| `/get` | Yes | If miss | Always |

## Response

Same envelope as `/fetch`:

```json
{
  "request": {
    "url": "https://example.com",
    "options": { "scope": "main", "format": "markdown" }
  },
  "response": {
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

- `cached: true` - returned from storage
- `cached: false` - fetched fresh (cache miss)

## Database Changes

### Schema

Add `optionsHash` column:

```sql
ALTER TABLE pages ADD COLUMN optionsHash TEXT;
CREATE INDEX idx_pages_url_hash ON pages(url, optionsHash);
```

### DatabaseService

Add methods:

```typescript
interface GetPageOptions {
  url: string;
  optionsHash: string;
  client?: string;
}

async getPage(options: GetPageOptions): Promise<PageData | null>
```

## CLI Command

```bash
webcontent get <url> [options]
webcontent get --id <id> [options]

Options:
  --id <id>             Get by page ID (bypasses URL matching)
  -s, --scope <type>    Content scope: full | main (default: main)
  -f, --format <fmt>    Output format: html | markdown | text (default: markdown)
  -d, --data <plugins>  Data plugins configuration
  --ttl <duration>      TTL for stored record if fetched (default: 30d)
  --client <name>       Client identifier
  -o, --output <file>   Write output to file

Examples:
  webcontent get https://example.com
  webcontent get https://example.com --client my-app
  webcontent get --id abc123def456
```

The `get` command becomes the recommended default for most use cases.

## Test HTML

Add "Get (Cached)" button to `tests/fetch.html` that calls `/get` with same options.

## Implementation Steps

1. Add `id` and `optionsHash` columns to schema
2. Add `generatePageId()` utility
3. Add `computeOptionsHash()` utility with whitelist
4. Update `storePage()` to generate ID and hash
5. Add `getPage()` to DatabaseService (by URL+hash or ID)
6. Add `GET /get` and `POST /get` routes
7. Add `getCommand` to CLI
8. Update test HTML
9. Update documentation

See also: [ids.md](./ids.md) for ID-related details.
