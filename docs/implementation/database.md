# Database Implementation

Technical details for the Turso/libSQL database integration.

## Technology

- **Database**: Turso (managed libSQL)
- **Client**: `@libsql/client`
- **ID Generation**: `nanoid` (12-character URL-safe IDs)

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `TURSO_URL` | Database connection URL | Yes |
| `TURSO_AUTH_TOKEN` | Authentication token | No (local dev) |

## Schema

### Table: `pages`

```sql
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  hostname TEXT NOT NULL,
  path TEXT NOT NULL,
  client TEXT,
  title TEXT,
  status INTEGER NOT NULL,
  content TEXT,
  meta JSONB,
  data JSONB,
  options JSONB,
  timestamp INTEGER NOT NULL,
  deleteAt INTEGER NOT NULL
);
```

### Indexes

```sql
CREATE INDEX idx_pages_domain ON pages(domain);
CREATE INDEX idx_pages_hostname ON pages(hostname);
CREATE INDEX idx_pages_path ON pages(path);
CREATE INDEX idx_pages_url ON pages(url);
CREATE INDEX idx_pages_title ON pages(title);
CREATE INDEX idx_pages_client ON pages(client);
```

## Column Details

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT | 12-character nanoid (URL-safe) |
| `url` | TEXT | Full original URL |
| `domain` | TEXT | Base domain (e.g., `example.com`) |
| `hostname` | TEXT | Full hostname (e.g., `www.example.com`) |
| `path` | TEXT | URL path (e.g., `/page`) |
| `client` | TEXT | Optional partition identifier |
| `title` | TEXT | Page title from metadata |
| `status` | INTEGER | HTTP status code |
| `content` | TEXT | Extracted content in requested format |
| `meta` | JSONB | PageMeta object (OpenGraph, hreflang, etc.) |
| `data` | JSONB | Plugin results (headings, links, etc.) |
| `options` | JSONB | Request options (scope, format) |
| `timestamp` | INTEGER | Creation time (ms since epoch) |
| `deleteAt` | INTEGER | Expiration time for TTL cleanup |

## DatabaseService

Location: `src/services/database.ts`

### Methods

```typescript
class DatabaseService {
  constructor()                                    // Reads TURSO_URL and TURSO_AUTH_TOKEN
  async init()                                     // Creates table and indexes if not exist
  async storePage(data: PageData): StoredPage     // Inserts and returns with generated ID
  async getPageById(id, client?): StoredPage|null // Get single page by ID
  async getPagesByIds(ids[], client?): StoredPage[] // Get multiple pages (preserves order)
}

function generatePageId(): string                  // Returns 12-char nanoid
```

### PageData Interface

```typescript
interface PageData {
  id?: string;           // Optional - generated if not provided
  url: string;
  domain: string;
  hostname: string;
  path: string;
  client: string | null;
  title: string | null;
  status: number;
  content: string | null;
  meta: object;
  data: object;
  options: object;
  timestamp: number;
  deleteAt: number;
}

interface StoredPage extends PageData {
  id: string;            // Always present after storage
}
```

## ID Generation

IDs are generated using `nanoid(12)`:
- 12 characters
- URL-safe alphabet: `A-Za-z0-9_-`
- ~62^12 = 3.2×10²¹ possible values
- Example: `V1StGXR8_Z5j`

## Client Isolation

When retrieving pages by ID, client isolation is enforced:
- If `client` parameter provided, only returns pages matching that client
- If page belongs to different client, returns null/404
- Prevents cross-client data access

## Storage Behavior

- **No deduplication**: Each fetch creates a new row
- **TTL**: Stored as `deleteAt = timestamp + ttl * 1000`
- **Default TTL**: 30 days (2,592,000 seconds)
- **Domain extraction**: Last two parts of hostname (e.g., `www.example.com` → `example.com`)

## Error Handling

Database errors are logged but do not fail the fetch operation. The fetch result is still returned to the client even if storage fails.
