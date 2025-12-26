# List Route

Retrieve multiple stored entries with filtering.

## Endpoints

### `GET /list`

Query parameters for simple filtering.

### `POST /list`

Full filtering capabilities via JSON body.

```json
{
  "client": "my-app",
  "filter": {
    "url": "https://example.com/page",
    "hostname": "example.com",
    "domain": "example.com",
    "title": "Example",
    "since": "7d",
    "before": "1d",
    "search": "keyword"
  },
  "order": "timestamp",
  "desc": true,
  "limit": 50,
  "offset": 0,
  "full": false
}
```

## Client Requirement

**Important**: Client matching is enforced.

- If request has `client`: only return records with matching `client`
- If request has no `client`: only return records with `client = NULL`

This prevents data leakage between clients.

## Filter Options

| Field | Type | Description | SQL |
|-------|------|-------------|-----|
| `url` | string | Exact URL match | `url = ?` |
| `hostname` | string | Filter by hostname | `hostname = ?` |
| `domain` | string | Filter by domain | `domain = ?` |
| `title` | string | Partial title match | `title LIKE ?` |
| `since` | duration | Records newer than | `timestamp > ?` |
| `before` | duration | Records older than | `timestamp < ?` |
| `search` | string | Relevance search | See below |

### Duration Filter

Reuse duration parsing for `since` and `before`:

```typescript
// "7d" -> timestamp must be > (now - 7 days)
const sinceMs = parseDuration(filter.since);
const sinceTimestamp = Date.now() - sinceMs;
```

### Search Filter

Full-text search across multiple fields:

```sql
WHERE (
  url LIKE '%keyword%' OR
  title LIKE '%keyword%' OR
  json_extract(meta, '$.description') LIKE '%keyword%'
)
```

For SQLite/Turso, use LIKE. Consider FTS5 for better performance later.

## Ordering

| Value | Description | SQL |
|-------|-------------|-----|
| `timestamp` | By fetch time (default) | `ORDER BY timestamp` |
| `url` | Alphabetically by URL | `ORDER BY url` |
| `title` | Alphabetically by title | `ORDER BY title` |
| `domain` | By domain | `ORDER BY domain` |

With `desc: true`, add `DESC` to order clause.

## Pagination

- `limit`: Max results (default: 50, max: 1000)
- `offset`: Skip first N results (default: 0)

## Response

```json
{
  "count": 25,
  "total": 150,
  "limit": 50,
  "offset": 0,
  "results": [
    {
      "id": "abc123",
      "url": "https://example.com/page1",
      "title": "Page Title",
      "domain": "example.com",
      "hostname": "www.example.com",
      "timestamp": 1700000000000,
      "status": 200
    }
  ]
}
```

By default, results are **summaries**. Use `full: true` for complete data.

### Summary Fields (default)

Each result includes:
- `id` - unique page identifier
- `url`
- `title`
- `domain`
- `hostname`
- `timestamp`
- `status`
- `optionsHash`

### Full Response

Request with `full: true` to get complete page data:

```json
{
  "client": "my-app",
  "full": true,
  "limit": 10
}
```

Response with full data:

```json
{
  "count": 10,
  "total": 150,
  "results": [
    {
      "id": "abc123",
      "url": "https://example.com/page1",
      "title": "Page Title",
      "domain": "example.com",
      "hostname": "www.example.com",
      "timestamp": 1700000000000,
      "status": 200,
      "meta": { ... },
      "content": "...",
      "data": { ... },
      "options": { ... }
    }
  ]
}
```

This matches the structure of `/get` response, wrapped in a list.

## Duration Parsing Refactor

Rename `parseTtl` to `parseDuration` and move to reusable util:

```typescript
// src/utils/duration.ts
export function parseDuration(value?: string | number): number | null {
  // Returns milliseconds (or seconds, decide on convention)
  // Supports: 60, "60", "60m", "6h", "7d", "3mo", "1y"
}

export const DEFAULT_TTL = 30 * 24 * 60 * 60; // 30 days in seconds
```

Update all existing usages of `parseTtl`.

## DatabaseService

Add method:

```typescript
interface ListOptions {
  client?: string;
  filter?: {
    url?: string;
    hostname?: string;
    domain?: string;
    title?: string;
    since?: number;  // timestamp ms
    before?: number; // timestamp ms
    search?: string;
  };
  order?: "timestamp" | "url" | "title" | "domain";
  desc?: boolean;
  limit?: number;
  offset?: number;
}

interface ListResult {
  count: number;
  total: number;
  results: PageSummary[];
}

async listPages(options: ListOptions): Promise<ListResult>
```

## CLI Command

```bash
webcontent list [options]

Options:
  --client <name>       Client identifier (required for filtering)
  --url <url>           Exact URL match
  --hostname <host>     Filter by hostname
  --domain <domain>     Filter by domain
  --title <text>        Partial title match
  --since <duration>    Records newer than (e.g., 7d, 24h)
  --before <duration>   Records older than
  --search <text>       Search across url, title, description
  --order <field>       Order by: timestamp, url, title, domain
  --desc                Descending order
  --limit <n>           Max results (default: 50)
  --offset <n>          Skip first N results
  -o, --output <file>   Write output to file
```

## Test HTML

Create `tests/list.html` with:
- Client input (required)
- Filter inputs for each field
- Order/limit/offset controls
- Results table with clickable rows (open in fetch test)

## Implementation Steps

1. Refactor `parseTtl` to `parseDuration` in `src/utils/duration.ts`
2. Update all existing usages
3. Add `listPages()` to DatabaseService
4. Add `GET /list` and `POST /list` routes
5. Add `listCommand` to CLI
6. Create `tests/list.html`
7. Update documentation
