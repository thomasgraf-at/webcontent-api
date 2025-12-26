# WebContent Specifications

## Overview

WebContent is a web content fetching API that provides both CLI and HTTP server interfaces for fetching and parsing web page content.

## Requirements

### Core Functionality

1. **Content Extraction**: Support two content extraction modes:
   - `full`: Extract the entire page body
   - `main`: Extract only the main content (articles, primary content areas)

2. **Output Formats**: Support three output formats:
   - `html`: Raw HTML content
   - `markdown`: Converted to Markdown
   - `text`: Plain text extraction

3. **Metadata Extraction**: Parse and return page metadata:
   - Title, description, keywords
   - Canonical URL
   - Robots directives and indexability
   - H1 heading
   - Hreflang links
   - Open Graph data (title, description, image, url, type, siteName)

4. **No Auto-Follow Redirects**: Do not automatically follow redirects. If the HTTP response contains a redirect status (3xx) with a Location header, return the redirect URL in the `redirect` field.

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
| `--content` | `-c` | Content type: `full` or `main` | `main` |
| `--format` | `-f` | Output format: `html`, `markdown`, or `text` | `html` |
| `--output` | `-o` | Write output to file | stdout |
| `--help` | `-h` | Show help | - |

**Output**: JSON object containing:
- `url`: Requested URL
- `statusCode`: HTTP status code
- `redirect`: Location header value if redirect response (3xx), otherwise null
- `timestamp`: ISO 8601 timestamp
- `meta`: Extracted metadata object (only if content was fetched, not on redirect)
- `content`: Extracted content in requested format (only if content was fetched)

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
| `content` | `full` or `main` | `main` |
| `format` | `html`, `markdown`, or `text` | `html` |

#### `POST /fetch`
JSON body:
```json
{
  "url": "https://example.com",
  "content": "main",
  "format": "markdown"
}
```

**Response Format**: Same as CLI output.

**CORS**: Full CORS support for browser-based clients.

### Error Handling

- Return appropriate HTTP status codes (400 for bad requests, 500 for server errors)
- Include descriptive error messages in response body
- Validate URL format (must start with `http://` or `https://`)
- Validate content type and format parameters

## Non-Functional Requirements

1. **Runtime**: Bun (for native TypeScript and performance)
2. **Portable**: Can be compiled to standalone binary
