# Miscellaneous Ideas

Low-priority ideas and future enhancements. These may be promoted to dedicated proposal files if they gain traction.

## Ideas

### Custom Headers

Allow clients to specify custom request headers for authenticated requests, locale-specific content, or bot identification.

```json
{
  "url": "https://example.com",
  "headers": {
    "Authorization": "Bearer token",
    "Accept-Language": "de-DE"
  }
}
```

Use cases: accessing paywalled content, setting user-agent for specific sites, passing cookies.

### Proxy Support

Support HTTP/HTTPS/SOCKS proxies for requests. Useful for:
- Bypassing geo-restrictions
- Rotating IPs for rate limit avoidance
- Accessing internal networks

Configuration via request parameter or environment variable (`HTTP_PROXY`, `HTTPS_PROXY`).

### JavaScript Rendering

Option to render JavaScript before extracting content using a headless browser (Playwright/Puppeteer). Required for SPAs and dynamically-loaded content.

Adds significant overhead (~2-5s per request) and resource requirements. Consider as opt-in mode with separate endpoint or `render: true` option.

### Screenshot Capture

Capture screenshot of the rendered page. Requires headless browser integration.

Options: full page vs viewport, format (PNG/JPEG/WebP), quality, dimensions. Return as base64 or store to object storage with URL reference.

### PDF Generation

Convert page content to PDF for archival or offline reading. Options:
- Headless browser print-to-PDF
- External service like Gotenberg
- HTML-to-PDF library (limited CSS support)

Consider page size, margins, headers/footers configuration.

### Webhook Callbacks

For async batch operations, support webhook callbacks when jobs complete:

```json
{
  "urls": ["..."],
  "webhook": "https://myapp.com/webhook",
  "webhookSecret": "hmac-secret"
}
```

Include HMAC signature for verification. Retry failed deliveries with exponential backoff.

### Streaming Response (NDJSON)

For batch requests, stream results as they complete using newline-delimited JSON. Allows clients to process results incrementally without waiting for entire batch.

```
{"url": "https://a.com", "status": 200, ...}\n
{"url": "https://b.com", "status": 200, ...}\n
```

### Diff/Change Detection

Compare current page with previously stored version. Return:
- Boolean: has content changed?
- Diff: what specifically changed?
- Percentage: how much changed?

Useful for monitoring pages for updates, price changes, content modifications.

### Sitemap Crawling

Fetch and parse XML sitemaps, then crawl all URLs with configurable:
- Concurrency limit
- Per-request delay
- URL filters (include/exclude patterns)
- Priority ordering

Return aggregated results or stream via NDJSON.

### Performance Metrics

Return timing information in response:
- DNS lookup time
- TCP connection time
- TLS handshake time
- Time to first byte (TTFB)
- Content download time
- Total request time

Useful for performance monitoring and debugging slow requests.

### Rate Limiting

Built-in rate limiting to prevent overwhelming target servers:
- Per-domain limits (e.g., max 2 req/sec to same domain)
- Global limits (e.g., max 10 concurrent requests)
- Configurable via environment or per-request

Queue requests that exceed limits rather than rejecting.

### Delete Endpoint

Delete stored pages from database:
- By ID: `DELETE /pages/:id`
- By filter: `DELETE /pages?domain=example.com&before=2024-01-01`

Supports immediate deletion or soft-delete with cleanup job.

### Refresh Endpoint

Force refresh a cached page while preserving its record ID:
- `POST /pages/:id/refresh`

Keeps historical record linkage while updating content. Optionally compare with previous version.

## Rejected / Deferred

### File-based Cache

**Status**: Rejected

Use Turso database instead for:
- Remote access from multiple instances
- Better querying and filtering
- Shared deployments without filesystem sync
- Automatic TTL expiration
