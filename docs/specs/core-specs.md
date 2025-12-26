# WebContent Specifications

## Product Overview

WebContent is a web content fetching API that provides both CLI and HTTP server interfaces for extracting content from web pages.

### Core Features

- **Dual Interface**: Available as both a command-line tool and HTTP server
- **Content Extraction**: Intelligent main content detection or full page extraction
- **Format Conversion**: Output as HTML, Markdown, or plain text
- **Metadata Extraction**: Title, description, Open Graph, hreflang, and more
- **Plugin System**: Extensible data extraction via plugins

### Use Cases

- Content scraping and extraction
- Web page analysis and metadata collection
- Content format conversion (HTML to Markdown)
- API integration for content processing workflows
- SEO analysis and link checking

### Key Design Principles

- Simple, focused API with minimal configuration
- Consistent response format across CLI and server
- Type-safe TypeScript implementation
- Extensible via plugin architecture

---

## Technical Requirements

### Runtime

- **Bun**: Primary runtime for native TypeScript support and performance
- Compiles to standalone binaries for deployment without Bun installed

### Response Format

All responses use a request/response envelope structure:

```json
{
  "request": {
    "url": "https://example.com",
    "options": {
      "scope": "main",
      "format": "markdown"
    },
    "data": {
      "headings": true
    }
  },
  "response": {
    "timestamp": 1600000000000,
    "url": "https://example.com",
    "status": 200,
    "redirect": null,
    "meta": {},
    "content": "",
    "data": {
      "headings": []
    }
  }
}
```

**Always Returned Fields**:
- `timestamp`: Unix timestamp in milliseconds
- `url`: Final URL (after any server-side processing)
- `status`: HTTP status code
- `redirect`: Location header value if redirect (3xx), otherwise null

**Core Fields** (via `include` parameter):

| Field     | Description                           | Default      |
|-----------|---------------------------------------|--------------|
| `meta`    | Page metadata object                  | included     |
| `content` | Extracted content in requested format | included     |
| `headers` | Raw HTTP response headers             | not included |
| `body`    | Raw HTML body                         | not included |

**Data Plugins** (via `data` parameter):

| Plugin     | Description                       | Status    |
|------------|-----------------------------------|-----------|
| `headings` | Extract heading hierarchy (h1-h6) | Available |
| `links`    | Extract internal/external links   | Planned   |
| `images`   | Extract image URLs and alt text   | Planned   |

---

## Functional Requirements

### Content Extraction

Support two content scope modes:
- `full`: Extract the entire page body
- `main` (default): Extract only the main content (articles, primary content areas)

### Output Formats

Support three output formats:
- `markdown` (default): Converted to Markdown - ideal for LLM consumption
- `html`: Raw HTML content
- `text`: Plain text extraction

### Metadata Extraction

Parse and return page metadata:
- Title, description, keywords
- Canonical URL
- Robots directives and indexability
- H1 heading
- Hreflang links
- Open Graph data (title, description, image, url, type, siteName)

### Redirect Handling

Do not automatically follow redirects. If the HTTP response contains a redirect status (3xx) with a Location header, return the redirect URL in the `redirect` field. This gives clients visibility into redirect chains.

### Error Handling

- Return appropriate HTTP status codes (400 for bad requests, 500 for server errors)
- Include descriptive error messages in response body
- Validate URL format (must start with `http://` or `https://`)
- Unknown data plugins return an error

---

## Interface Specifications

### CLI Interface

**Command**: `webcontent <command> <url> [options]`

#### `webcontent fetch <url> [options]`

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--scope` | `-s` | Content scope: `full` or `main` | `main` |
| `--format` | `-f` | Output format: `html`, `markdown`, or `text` | `markdown` |
| `--include` | `-i` | Core response fields to include | `meta,content` |
| `--data` | `-d` | Data plugins to run | none |
| `--output` | `-o` | Write output to file | stdout |
| `--help` | `-h` | Show help | - |

### HTTP Server Interface

**Default Port**: 233 (configurable via `PORT` environment variable)

#### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check, returns `{ "status": "ok" }` |
| GET | `/fetch` | Fetch with query parameters |
| POST | `/fetch` | Fetch with JSON body |

#### Query Parameters (GET /fetch)

| Parameter | Description | Default |
|-----------|-------------|---------|
| `url` | URL to fetch (required) | - |
| `scope` | `full` or `main` | `main` |
| `format` | `html`, `markdown`, or `text` | `markdown` |
| `include` | Comma-separated core fields | `meta,content` |
| `data` | Comma-separated plugin names | none |

#### JSON Body (POST /fetch)

```json
{
  "url": "https://example.com",
  "scope": "main",
  "format": "markdown",
  "include": { "meta": true, "content": true },
  "data": { "headings": { "minLevel": 1, "maxLevel": 3 } }
}
```

**CORS**: Full CORS support for browser-based clients.

---

## Future Directions

### Planned Commands

- `get`: Check cache before fetching (vs `fetch` which always retrieves fresh)

### Plugin Expansion

See [plugins.md](../planning/plugins.md) for the full plugin roadmap including:
- `links`, `images`, `words`, `tables`
- `seo`, `schema`, `feeds`
- AI-powered: `summary`, `entities`, `sentiment`
