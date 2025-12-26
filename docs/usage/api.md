# API Usage Guide

The WebContent API allows you to fetch and parse web content via HTTP `GET` and `POST` requests.

## Endpoints

### `GET /fetch`

Fetch content using query parameters.

**Parameters**:
| Parameter | Description | Default |
|-----------|-------------|---------|
| `url` | URL to fetch (required) | - |
| `scope` | `full` or `main` | `main` |
| `format` | `html`, `markdown`, or `text` | `markdown` |
| `include` | Comma-separated core fields | `meta,content` |
| `data` | Comma-separated plugin names | none |
| `store` | Boolean or TTL in seconds to enable storage | `false` |
| `client` | Client/Shard identifier for the record | none |

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
  "scope": "main",
  "format": "markdown",
  "include": "meta,content"
}
```

**Include as Object**:
```json
{
  "url": "https://example.com",
  "include": {
    "meta": true,
    "content": true,
    "headers": true
  }
}
```

**With Data Plugins**:
```json
{
  "url": "https://example.com",
  "data": {
    "headings": { "minLevel": 1, "maxLevel": 3 },
    "links": true
  }
}
```

**With Database Storage**:
```json
{
  "url": "https://example.com",
  "store": {
    "ttl": 3600,
    "client": "my-client-id"
  }
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
      "format": "markdown"
    },
    "data": {
      "headings": { "minLevel": 1, "maxLevel": 3 }
    }
  },
  "response": {
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
  }
}
```

### Core Response Fields

**Always returned**:
- `timestamp`: Unix timestamp in milliseconds.
- `url`: The final URL fetched.
- `status`: HTTP status code from the target server.
- `redirect`: If the response was a redirect (3xx), contains the `Location` header value.

**Controlled by `include`**:
- `meta`: Metadata about the page (title, description, opengraph, etc.).
- `content`: The parsed content in the requested format.
- `headers`: Raw HTTP response headers (not included by default).
- `body`: Raw HTML body (not included by default).

**Controlled by `data`**:
- `data`: Object containing output from requested data plugins.

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
