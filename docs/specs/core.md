# WebContent Specifications

## Overview

WebContent is a web content fetching API that provides both CLI and HTTP server interfaces for fetching and parsing web page content.

## Requirements

### Core Functionality

1. **Content Extraction**: Support two content scope modes:
   - `full`: Extract the entire page body
   - `main`: Extract only the main content (articles, primary content areas)

2. **Output Formats**: Support three output formats:
   - `html`: Raw HTML content
   - `markdown`: Converted to Markdown (default)
   - `text`: Plain text extraction

3. **Metadata Extraction**: Parse and return page metadata:
   - Title, description, keywords
   - Canonical URL
   - Robots directives and indexability
   - H1 heading
   - Hreflang links
   - Open Graph data (title, description, image, url, type, siteName)

4. **Elements Extraction** (planned): Extract structured page elements:
   - All links, internal links, external links
   - Headings hierarchy
   - Images with alt text

5. **No Auto-Follow Redirects**: Do not automatically follow redirects. If the HTTP response contains a redirect status (3xx) with a Location header, return the redirect URL in the `redirect` field.

### Response Format

All responses use a request/response envelope structure:

```json
{
  "request": {
    "url": "https://example.com",
    "options": {
      "scope": "main",
      "format": "markdown"
    }
  },
  "response": {
    "timestamp": 1600000000000,
    "url": "https://example.com",
    "status": 200,
    "redirect": null,
    "headers": {},
    "body": "",
    "meta": {},
    "content": "",
    "elements": {
      "links": [],
      "internalLinks": [],
      "externalLinks": [],
      "headings": [],
      "images": []
    }
  }
}
```

**Always Returned Fields** (in response):
- `timestamp`: Unix timestamp in milliseconds
- `url`: Final URL (after any server-side processing)
- `status`: HTTP status code
- `redirect`: Location header value if redirect response (3xx), otherwise null

**Selectable Fields** (via `include` parameter):
| Field | Description | Default |
|-------|-------------|---------|
| `meta` | Page metadata object | included |
| `content` | Extracted content in requested format | included |
| `headers` | Raw HTTP response headers | not included |
| `body` | Raw HTML body | not included |
| `elements` | Extracted page elements (not yet implemented) | not included |

### Commands

#### `fetch`

Always fetches fresh content from the source, bypassing any caching mechanisms.

#### `get` (planned)

Looks in the cache first before fetching from the source.

### CLI Interface

**Command**: `webcontent <command> <url> [options]`

#### `webcontent fetch <url> [options]`

**Options**:
| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--scope` | `-s` | Content scope: `full` or `main` | `main` |
| `--format` | `-f` | Output format: `html`, `markdown`, or `text` | `markdown` |
| `--include` | `-i` | Response fields to include | `meta,content` |
| `--output` | `-o` | Write output to file | stdout |
| `--help` | `-h` | Show help | - |

**Include Parameter Formats**:
- Comma-separated: `"meta,content,headers"`
- JSON object: `'{"meta":true,"content":true,"headers":true}'`

### HTTP Server Interface

**Port**:
- Local development: 233 (configurable via `PORT` environment variable)
- Cloud deployments: Use standard port configuration for the platform

**Endpoints**:

#### `GET /health`
Health check endpoint returning `{ "status": "ok" }`.

#### `GET /fetch`
Query parameters:
| Parameter | Description | Default |
|-----------|-------------|---------|
| `url` | URL to fetch (required) | - |
| `scope` | `full` or `main` | `main` |
| `format` | `html`, `markdown`, or `text` | `markdown` |
| `include` | Comma-separated fields | `meta,content` |

#### `POST /fetch`
JSON body:
```json
{
  "url": "https://example.com",
  "scope": "main",
  "format": "markdown",
  "include": "meta,content"
}
```

Or with include as object:
```json
{
  "url": "https://example.com",
  "scope": "main",
  "format": "markdown",
  "include": {
    "meta": true,
    "content": true,
    "headers": false
  }
}
```

**CORS**: Full CORS support for browser-based clients.

### Error Handling

- Return appropriate HTTP status codes (400 for bad requests, 500 for server errors)
- Include descriptive error messages in response body
- Validate URL format (must start with `http://` or `https://`)
- Validate scope and format parameters

## Non-Functional Requirements

1. **Runtime**: Bun (for native TypeScript and performance)
2. **Portable**: Can be compiled to standalone binary
