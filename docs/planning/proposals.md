# WebContent Proposals

Future enhancements and next steps for the WebContent API.

## Next Steps

### 1. Elements Extraction

Implement the `elements` response field to extract structured page elements.

**Fields**:
```typescript
interface ResponseElements {
  links: string[];           // All href values
  internalLinks: string[];   // Links to same domain
  externalLinks: string[];   // Links to other domains
  headings: string[];        // H1-H6 text content
  images: string[];          // Image src values (excluding data: URIs)
}
```

**Implementation**:
- Add `extractElements()` function to `html-parser.ts`
- Parse `<a href>` elements, classify as internal/external based on URL
- Extract all `<h1>`-`<h6>` text content
- Extract `<img src>` values, filter data: URIs

### 2. `get` Command with Caching

Implement the `get` command that checks cache before fetching.

**Cache Strategy**:
- File-based cache in `~/.webcontent/cache/`
- Cache key: SHA256 hash of URL
- Store response JSON with TTL metadata
- Respect `Cache-Control` headers from responses

**CLI Options**:
```
webcontent get <url> [options]
  --max-age <seconds>    Maximum cache age (default: 3600)
  --force-refresh        Bypass cache, fetch fresh
```

### 3. Batch Fetching

Support fetching multiple URLs in a single request.

**CLI**:
```bash
webcontent fetch --urls urls.txt
webcontent fetch url1 url2 url3
```

**HTTP API**:
```json
POST /fetch/batch
{
  "urls": ["https://example1.com", "https://example2.com"],
  "scope": "main",
  "format": "markdown"
}
```

**Response**: Array of results in same order as input URLs.

### 4. Streaming Response

For large pages or batch requests, support streaming JSON responses.

**Implementation**:
- Use NDJSON (newline-delimited JSON) format
- Stream each result as it completes
- Useful for batch operations and large pages

### 5. Screenshot Capture

Optional screenshot of the rendered page.

**Options**:
```json
{
  "url": "https://example.com",
  "screenshot": {
    "width": 1280,
    "height": 800,
    "fullPage": true,
    "format": "png"
  }
}
```

**Response**:
```json
{
  "response": {
    "screenshot": "base64-encoded-image-data"
  }
}
```

**Implementation**: Requires headless browser (Puppeteer/Playwright).

### 6. JavaScript Rendering

Option to render JavaScript before extracting content.

**Options**:
```json
{
  "url": "https://example.com",
  "render": true,
  "waitFor": "networkidle"
}
```

**Implementation**: Requires headless browser integration.

### 7. Custom User-Agent and Headers

Allow clients to specify custom request headers.

**Options**:
```json
{
  "url": "https://example.com",
  "headers": {
    "User-Agent": "CustomBot/1.0",
    "Accept-Language": "en-US"
  }
}
```

### 8. Proxy Support

Support HTTP/HTTPS/SOCKS proxies for requests.

**Options**:
```json
{
  "url": "https://example.com",
  "proxy": "http://proxy.example.com:8080"
}
```

**CLI**:
```bash
webcontent fetch https://example.com --proxy http://proxy:8080
```

### 9. Rate Limiting

Built-in rate limiting for batch operations.

**Options**:
- Requests per second limit
- Concurrent request limit
- Per-domain delays

### 10. Webhook Callbacks

For async batch operations, support webhook callbacks.

**Options**:
```json
{
  "urls": ["..."],
  "webhook": "https://myserver.com/callback",
  "webhookSecret": "hmac-secret"
}
```

## Stretch Goals

### Schema.org / JSON-LD Extraction

Extract structured data from pages.

```typescript
interface ResponseElements {
  // ... existing fields
  structuredData: object[];  // JSON-LD, Microdata
}
```

### PDF Generation

Convert page content to PDF.

### RSS/Atom Feed Detection

Detect and return feed URLs from pages.

### Performance Metrics

Return timing information for the request.

```typescript
interface ResponseMeta {
  timing: {
    dns: number;
    connect: number;
    ttfb: number;
    download: number;
    total: number;
  };
}
```
