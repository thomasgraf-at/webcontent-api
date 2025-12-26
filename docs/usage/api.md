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
| `include` | Comma-separated fields | `meta,content` |

**Example**:
```bash
curl "http://localhost:233/fetch?url=https://example.com&scope=full&format=markdown"
```

---

### `POST /fetch`

Fetch content using a JSON body. This is preferred for complex requests or when the URL is very long.

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
You can also specify `include` as a boolean object:
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

---

## Response Structure

All responses use a standard envelope format:

```json
{
  "request": {
    "url": "https://example.com",
    "options": { ... }
  },
  "response": {
    "timestamp": 1700000000000,
    "url": "https://example.com",
    "status": 200,
    "redirect": null,
    "meta": { ... },
    "content": "..."
  }
}
```

### Response Fields
- `timestamp`: Unix timestamp in milliseconds.
- `url`: The final URL fetched.
- `status`: HTTP status code from the target server.
- `redirect`: If the response was a redirect (3xx), this contains the `Location` header value.
- `meta`: Metadata about the page (title, description, etc.).
- `content`: The parsed content in the requested format.

---

## Error Handling

Errors are returned with appropriate HTTP status codes and a JSON body containing the error message.

- **400 Bad Request**: Invalid URL, missing parameters, or invalid options.
- **500 Internal Server Error**: Network failures or parsing errors.

```json
{
  "error": "Invalid URL"
}
```
