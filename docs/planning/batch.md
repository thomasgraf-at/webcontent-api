# Batch Fetch

Fetch multiple URLs with configurable delay between requests.

## Endpoint

### `POST /batch`

```json
{
  "urls": [
    "https://example.com/page1",
    "https://example.com/page2",
    "https://example.com/page3"
  ],
  "options": {
    "scope": "main",
    "format": "markdown",
    "store": {
      "ttl": "7d",
      "client": "my-app"
    }
  },
  "delay": 1000
}
```

## Parameters

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `urls` | string[] | URLs to fetch (required) | - |
| `options` | object | Shared options for all fetches | `{}` |
| `delay` | number | Delay between fetches in ms | `1000` |
| `include` | string/object | Response fields to include | `meta,content` |

### URL Limit

- Maximum URLs per request: 100
- Return error if exceeded

### Delay

- Default: `1000` ms (1 second)
- Minimum: `0` (no delay)
- Maximum: `60000` (60 seconds)

The delay is applied **between** fetches, not before the first one.

## Response

### Streaming vs Complete

**Option 1: Complete response** (simpler, recommended for v1)

Wait for all fetches, return complete results:

```json
{
  "results": [
    {
      "url": "https://example.com/page1",
      "status": 200,
      "success": true,
      "response": {
        "timestamp": 1700000000000,
        "url": "https://example.com/page1",
        "status": 200,
        "meta": { ... },
        "content": "..."
      }
    },
    {
      "url": "https://example.com/page2",
      "status": 500,
      "success": false,
      "error": "Connection timeout"
    }
  ],
  "summary": {
    "total": 3,
    "success": 2,
    "failed": 1,
    "duration": 5234
  }
}
```

**Option 2: Streaming (NDJSON)** (for long batches)

Stream results as they complete:

```
{"index":0,"url":"...","success":true,"response":{...}}
{"index":1,"url":"...","success":false,"error":"..."}
{"index":2,"url":"...","success":true,"response":{...}}
{"summary":{"total":3,"success":2,"failed":1}}
```

Start with Option 1, add streaming later if needed.

## Result Structure

Each result includes:
- `url`: Original URL from input
- `success`: boolean
- `status`: HTTP status (or null if failed before request)
- `response`: Full response object (if success)
- `error`: Error message (if failed)

Results are returned in the same order as input URLs.

## Storage

If `options.store` is provided:
- Each successful fetch is stored individually
- Failed fetches are not stored
- All use the same TTL and client

## Error Handling

### Partial Failures

Batch continues even if individual URLs fail:
- Network errors: `success: false`, include error message
- HTTP errors (4xx, 5xx): `success: true`, include response with status
- Invalid URL format: `success: false`, error before fetch

### Request-Level Errors

These fail the entire request:
- Missing `urls` field
- `urls` not an array
- Empty `urls` array
- Exceeds URL limit

## CLI Command

```bash
webcontent batch [options]

Options:
  --urls <file>         File with URLs (one per line)
  -u, --url <url>       URL to fetch (can be repeated)
  -s, --scope <type>    Content scope: full | main (default: main)
  -f, --format <fmt>    Output format: html | markdown | text (default: markdown)
  --delay <ms>          Delay between fetches (default: 1000)
  --store               Store results in database
  --ttl <duration>      TTL for stored records (default: 30d)
  --client <name>       Client identifier
  -o, --output <file>   Write output to file

Examples:
  webcontent batch --urls urls.txt --delay 2000
  webcontent batch -u https://a.com -u https://b.com --store
```

### URL File Format

```
https://example.com/page1
https://example.com/page2
# Comments start with #
https://example.com/page3
```

## Implementation

### Server

```typescript
// POST /batch handler
const urls = body.urls;
const delay = body.delay ?? 1000;
const results = [];

for (let i = 0; i < urls.length; i++) {
  if (i > 0 && delay > 0) {
    await sleep(delay);
  }

  try {
    const result = await fetchAndProcess(urls[i], options);
    results.push({ url: urls[i], success: true, response: result });
  } catch (error) {
    results.push({ url: urls[i], success: false, error: error.message });
  }
}

return { results, summary: computeSummary(results) };
```

### Shared Logic

Extract common fetch logic from `/fetch` handler to reusable function:

```typescript
async function fetchAndProcess(
  url: string,
  options: FetchOptions,
  include: ResponseFields
): Promise<ApiResponse>
```

## Test HTML

Add batch section to `tests/fetch.html` or create `tests/batch.html`:
- Textarea for URLs (one per line)
- Delay input
- Progress indicator
- Results table

## Implementation Steps

1. Extract shared fetch logic to reusable function
2. Add `POST /batch` route
3. Add `batchCommand` to CLI
4. Add batch test UI
5. Update documentation
