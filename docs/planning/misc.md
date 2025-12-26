# Miscellaneous Ideas

Future enhancements and ideas for the WebContent API.

## Planned Features

See dedicated planning docs:
- [get.md](./get.md) - Cached fetch with database lookup
- [list.md](./list.md) - List and filter stored pages
- [batch.md](./batch.md) - Batch fetching multiple URLs
- [ids.md](./ids.md) - Page IDs for direct retrieval
- [scope.md](./scope.md) - Extended scope options (selector, function, auto)
- [site-rules.md](./site-rules.md) - Site-specific extraction rules
- [plugins.md](./plugins.md) - Data plugin roadmap
- [database.md](./database.md) - Database feature plans

---

## Technical Notes

### QuickJS for Sandboxing

For executing user-defined extraction functions safely:

**Recommended**: [`@sebastianwessel/quickjs`](https://www.npmjs.com/package/quickjs-emscripten)
- Pure JavaScript + WebAssembly (no native dependencies)
- Works with Bun out of the box ([native WASM support](https://bun.sh/docs/runtime/loaders))
- Works on Google Cloud Run (just WASM, no special runtime)
- [Version 2.0 (2024)](https://sebastianwessel.github.io/quickjs/blog/2024-09-01-version-2.html) adds async support and context reuse

**Alternatives considered**:
- `isolated-vm` - V8 isolates, requires native compilation
- `vm2` - Deprecated, security issues
- `SES` - Less isolation than QuickJS

See [site-rules.md](./site-rules.md) for full sandboxing details.

---

## Ideas

### Custom Headers

Allow clients to specify custom request headers.

```json
{
  "options": {
    "headers": {
      "User-Agent": "CustomBot/1.0",
      "Accept-Language": "en-US",
      "Cookie": "session=abc123"
    }
  }
}
```

**Use cases**:
- Authenticated requests
- Locale-specific content
- Bot identification

---

### Proxy Support

Support HTTP/HTTPS/SOCKS proxies for requests.

```json
{
  "options": {
    "proxy": "http://proxy.example.com:8080"
  }
}
```

---

### JavaScript Rendering

Option to render JavaScript before extracting content.

```json
{
  "options": {
    "render": true,
    "waitFor": "networkidle"
  }
}
```

**Implementation**: Requires headless browser (Puppeteer/Playwright).

**Consideration**: Significant complexity and resource usage. Could be a separate service or optional container.

---

### Screenshot Capture

Capture screenshot of the rendered page.

```json
{
  "options": {
    "screenshot": {
      "width": 1280,
      "height": 800,
      "fullPage": true,
      "format": "png"
    }
  }
}
```

**Requires**: Headless browser. Bundle with JS rendering.

---

### PDF Generation

Convert page content to PDF.

```json
{
  "options": {
    "pdf": {
      "format": "A4",
      "margin": "1cm"
    }
  }
}
```

**Requires**: Headless browser or service like Gotenberg.

---

### Webhook Callbacks

For async batch operations, support webhook callbacks.

```json
{
  "urls": ["..."],
  "webhook": {
    "url": "https://myserver.com/callback",
    "secret": "hmac-secret"
  }
}
```

**Use case**: Long-running batch jobs.

---

### Streaming Response (NDJSON)

For batch requests, stream results as they complete.

```
{"index":0,"url":"...","response":{...}}
{"index":1,"url":"...","response":{...}}
{"summary":{"total":2,"success":2}}
```

---

### Diff/Change Detection

Compare current page with stored version.

```json
{
  "options": {
    "diff": true
  }
}
```

**Response**:
```json
{
  "response": {
    "changed": true,
    "diff": {
      "addedLines": 5,
      "removedLines": 3
    }
  }
}
```

**Use case**: Monitoring pages for changes.

---

### Sitemap Crawling

Fetch all URLs from a sitemap.

```bash
webcontent crawl --sitemap https://example.com/sitemap.xml --delay 2000
```

---

### Performance Metrics

Return timing information for requests.

```json
{
  "response": {
    "timing": {
      "dns": 45,
      "connect": 120,
      "ttfb": 230,
      "download": 150,
      "total": 545
    }
  }
}
```

---

### Rate Limiting

Built-in rate limiting per domain.

Options:
- Per-domain request limits
- Global concurrent request limits
- Configurable delays

---

### Delete Endpoint

Delete stored pages by ID or filter.

```
DELETE /pages/:id
DELETE /pages?client=my-app&before=30d
```

---

### Refresh Endpoint

Force refresh a cached page.

```json
{
  "url": "https://example.com",
  "refresh": true
}
```

Fetches fresh, updates existing record (same ID), returns new content.

---

## Rejected / Deferred

### File-based Cache

Originally proposed file-based caching in `~/.webcontent/cache/`.

**Decision**: Use Turso database instead. Provides:
- Remote access
- Better querying
- Shared across deployments

---

## Priority

1. **High**: get, list, batch, IDs (core database features)
2. **Medium**: custom headers, proxy support, scope options
3. **Low**: JS rendering, screenshots, PDF (require headless browser)
4. **Future**: webhooks, streaming, sitemap crawling, diff detection
