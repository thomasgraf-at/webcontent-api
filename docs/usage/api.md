# API Usage Guide

The WebContent API allows you to fetch and parse web content via HTTP `GET` and `POST` requests.

## Endpoints

### `GET /fetch`

Fetch content using query parameters.

**Parameters**:

| Parameter | Description                                       | Default        |
|-----------|---------------------------------------------------|----------------|
| `url`     | URL to fetch (required)                           | -              |
| `scope`   | Content scope (see below)                         | `main`         |
| `format`  | `html`, `markdown`, or `text`                     | `markdown`     |
| `include` | Comma-separated core fields                       | `meta,content` |
| `data`    | Comma-separated plugin names                      | none           |
| `debug`   | Set to `true` to include debug info               | `false`        |
| `store`   | Boolean or TTL duration to enable storage         | `false`        |
| `client`  | Client/Shard identifier for the record            | none           |

**Scope Options**:
- `main` - Extract main content using Readability-like algorithm
- `full` - Full page body
- `auto` - Auto-detect based on site handlers
- JSON object for selector/function scope (must be URL-encoded)

**Example**:
```bash
curl "http://localhost:233/fetch?url=https://example.com&format=markdown"
```

**With Data Plugins**:
```bash
curl "http://localhost:233/fetch?url=https://example.com&data=headings,links"
```

---

### `POST /fetch`

Fetch content using a JSON body. This is preferred for complex requests or when configuring plugin options.

**Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "url": "https://example.com",
  "include": "meta,content",
  "debug": true,
  "options": {
    "scope": "main",
    "format": "markdown"
  }
}
```

The `debug` field can be at the top level or inside `options`.

**Scope Options**:

Simple scopes:
```json
{ "scope": "main" }
{ "scope": "full" }
{ "scope": "auto" }
```

Selector scope:
```json
{
  "scope": {
    "type": "selector",
    "include": ["article", ".content"],
    "exclude": [".ads", "nav"]
  }
}
```

Function scope (sandboxed JavaScript):
```json
{
  "scope": {
    "type": "function",
    "code": "(doc, url) => doc.getText('h1')"
  }
}
```

Function API:
- `doc.html` - Raw HTML string
- `doc.getText(sel)` - Get text from matching tags
- `doc.getInnerHTML(sel)` - Get innerHTML of first match
- `doc.getAllInnerHTML(sel)` - Get all matches' innerHTML as array
- `doc.getAttribute(sel, attr)` - Get attribute value

**Include as Object**:
```json
{
  "url": "https://example.com",
  "include": {
    "meta": true,
    "content": true,
    "headers": true
  },
  "options": {
    "scope": "main",
    "format": "markdown"
  }
}
```

**With Data Plugins**:
```json
{
  "url": "https://example.com",
  "options": {
    "scope": "main",
    "format": "markdown",
    "data": {
      "headings": { "minLevel": 1, "maxLevel": 3 },
      "links": true
    }
  }
}
```

**With Database Storage**:
```json
{
  "url": "https://example.com",
  "options": {
    "scope": "main",
    "format": "markdown",
    "store": {
      "ttl": "7d",
      "client": "my-client-id"
    }
  }
}
```

**TTL Duration Formats**:
- Seconds: `3600` or `"3600"`
- Minutes: `"60min"`, `"60m"`
- Hours: `"6hours"`, `"6h"`
- Days: `"7days"`, `"7d"`
- Months: `"3months"`, `"3mo"`
- Years: `"1year"`, `"1y"`

---

### `POST /store`

Store page data directly in the database without fetching.

**Headers**:
- `Content-Type: application/json`

**Request Body**:
```json
{
  "url": "https://example.com",
  "content": "Page content here",
  "title": "Example Page",
  "ttl": "7d",
  "client": "my-app"
}
```

**Required Fields**:
- `url`: URL for the record (must start with http:// or https://)
- At least one of: `body`, `content`, or `data`

**Optional Fields**:

| Field     | Type          | Description           | Default |
|-----------|---------------|-----------------------|---------|
| `status`  | number        | HTTP status code      | `200`   |
| `title`   | string        | Page title            | none    |
| `content` | string        | Extracted content     | none    |
| `body`    | string        | Raw HTML body         | none    |
| `meta`    | object        | Page metadata         | `{}`    |
| `data`    | object        | Plugin data           | `{}`    |
| `options` | object        | Request options       | `{}`    |
| `ttl`     | string/number | TTL duration          | `30d`   |
| `client`  | string        | Client/shard identifier | none  |

**Response**:
```json
{
  "stored": true,
  "id": "V1StGXR8_Z5j",
  "url": "https://example.com",
  "timestamp": 1700000000000,
  "deleteAt": 1700604800000
}
```

---

### `GET /pages/:id`

Get a stored page by its ID.

**Parameters**:

| Parameter | Description | Required |
|-----------|-------------|----------|
| `client` | Client/shard identifier (for isolation) | No |

**Example**:
```bash
curl "http://localhost:233/pages/V1StGXR8_Z5j"
```

**With Client Isolation**:
```bash
curl "http://localhost:233/pages/V1StGXR8_Z5j?client=my-app"
```

**Response**:
```json
{
  "request": { "id": "V1StGXR8_Z5j" },
  "response": {
    "id": "V1StGXR8_Z5j",
    "timestamp": 1700000000000,
    "url": "https://example.com",
    "status": 200,
    "meta": { ... },
    "content": "...",
    "data": { ... },
    "options": { ... },
    "cached": true
  }
}
```

---

### `POST /get`

Alternative endpoint to get a stored page by ID using JSON body.

**Request Body**:
```json
{
  "id": "V1StGXR8_Z5j",
  "client": "my-app"
}
```

**Response**: Same as `GET /pages/:id`

---

### `POST /gets`

Get multiple stored pages by their IDs.

**Request Body**:
```json
{
  "ids": ["V1StGXR8_Z5j", "abc123def456", "xyz789"],
  "client": "my-app"
}
```

**Constraints**:
- Maximum 100 IDs per request
- Results are returned in the same order as input IDs
- Missing IDs are omitted from results

**Response**:
```json
{
  "count": 2,
  "results": [
    {
      "id": "V1StGXR8_Z5j",
      "url": "https://example.com",
      "title": "Example Page",
      "domain": "example.com",
      "hostname": "www.example.com",
      "timestamp": 1700000000000,
      "status": 200,
      "meta": { ... },
      "content": "...",
      "data": { ... },
      "options": { ... }
    },
    ...
  ]
}
```

---

## Response Structure

All responses use a standard envelope format:

```json
{
  "request": {
    "url": "https://example.com",
    "options": {
      "scope": "main",
      "format": "markdown",
      "data": {
        "headings": { "minLevel": 1, "maxLevel": 3 }
      }
    }
  },
  "result": {
    "id": "V1StGXR8_Z5j",
    "timestamp": 1700000000000,
    "url": "https://example.com",
    "status": 200,
    "redirect": null,
    "meta": { ... },
    "content": "...",
    "data": {
      "headings": [
        { "level": 1, "text": "Page Title" },
        { "level": 2, "text": "Section" }
      ]
    }
  },
  "debug": {
    "scope": {
      "requested": "main",
      "used": "main",
      "resolved": false
    }
  }
}
```

> **Note**: The `debug` field is only included when `debug=true` is requested.

### Core Result Fields

**Always returned** (in `result`):
- `timestamp`: Unix timestamp in milliseconds.
- `url`: The final URL fetched.
- `status`: HTTP status code from the target server.
- `redirect`: If the response was a redirect (3xx), contains the `Location` header value.

**Returned when storing**:
- `id`: Unique 12-character page ID (only present when `store` option is used).

**Controlled by `include`**:
- `meta`: Metadata about the page (title, description, opengraph, etc.).
- `content`: The parsed content in the requested format.
- `headers`: Raw HTTP response headers (not included by default).
- `body`: Raw HTML body (not included by default).

**Controlled by `data`**:
- `data`: Object containing output from requested data plugins.

### Debug Info

When `debug=true` is requested, the response includes a top-level `debug` object:
- `debug.scope.requested`: The scope originally requested.
- `debug.scope.used`: The actual scope that was applied (may differ for `auto`).
- `debug.scope.resolved`: Boolean indicating whether the scope was auto-resolved.
- `debug.scope.handlerId`: Site handler ID if a handler was matched (for `auto` scope).

---

## Data Plugins

Data plugins extract additional structured information from the page. They are requested via the `data` parameter.

### Available Plugins

| Plugin | Description |
|--------|-------------|
| `headings` | Extract heading hierarchy (h1-h6) |
| `links` | Extract internal/external links (planned) |
| `images` | Extract image URLs and alt text (planned) |

### Plugin Options

Plugins can be enabled with `true` (default options) or configured with an options object:

```json
{
  "data": {
    "headings": true,
    "links": { "internal": true, "external": false }
  }
}
```

### Headings Plugin

Extracts all headings from the page content.

**Options**:
| Option | Description | Default |
|--------|-------------|---------|
| `minLevel` | Minimum heading level (1-6) | 1 |
| `maxLevel` | Maximum heading level (1-6) | 6 |

**Output**:
```json
{
  "data": {
    "headings": [
      { "level": 1, "text": "Main Title" },
      { "level": 2, "text": "Section One" }
    ]
  }
}
```

---

## Error Handling

Errors are returned with appropriate HTTP status codes and a JSON body containing the error message.

- **400 Bad Request**: Invalid URL, missing parameters, invalid options, or unknown plugin.
- **500 Internal Server Error**: Network failures or parsing errors.

```json
{
  "error": "URL is required"
}
```

> **Note**: Error responses use a flat structure with just an `error` field, not the `request`/`response` envelope used for successful responses.
